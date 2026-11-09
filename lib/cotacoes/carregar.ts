import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, CotacaoStatus } from "@/lib/types/database.types";
import { urlsAssinadas } from "@/lib/storage/urls-assinadas";
import type { PropostaParaComparar } from "@/components/cotacoes/comparativo-propostas";

type Client = SupabaseClient<Database>;

export type CotacaoCarregada = {
  id: string;
  obraId: string;
  descricao: string;
  orcamentoEtapa: string | null;
  prazoDecisao: string | null;
  observacoes: string | null;
  status: CotacaoStatus;
  motivoRecusa: string | null;
  decididaEm: string | null;
  propostas: PropostaParaComparar[];
  /** A ordem de compra gerada, quando já foi decidida. */
  compraId: string | null;
};

/**
 * A cotação inteira, pronta para as duas telas que a mostram.
 *
 * Carregador único para o engenheiro e para o portal porque as duas telas
 * comparam as MESMAS propostas — só os botões diferem. Duas consultas
 * separadas divergiriam na primeira vez que alguém acrescentasse um campo, e a
 * divergência apareceria como "o cliente está vendo um valor diferente do meu",
 * que é o pior defeito possível numa tela de decisão.
 *
 * Em consultas separadas, e não com embed do PostgREST: os tipos deste projeto
 * são escritos à mão e declaram `Relationships: []`, então embed não atravessa
 * o TypeScript sem virar `any` — já custou caro duas vezes (ver 0073). As
 * quatro consultas de filhos vão juntas, numa espera só.
 *
 * O que a RLS esconder, este carregador não vê: o cliente em cotação `rascunho`
 * recebe `null`, e a tela dele trata como não encontrada.
 */
export async function carregarCotacao(
  supabase: Client,
  cotacaoId: string
): Promise<CotacaoCarregada | null> {
  const [{ data: cotacao }, { data: propostas }] = await Promise.all([
    supabase
      .from("cotacoes")
      .select(
        "id, obra_id, descricao, orcamento_etapa, prazo_decisao, observacoes, status, motivo_recusa, decidida_em"
      )
      .eq("id", cotacaoId)
      .maybeSingle(),
    supabase
      .from("cotacao_propostas")
      .select(
        "id, fornecedor_id, valor_total, forma_pagamento, data_entrega_prevista, observacoes, status, compra_id"
      )
      .eq("cotacao_id", cotacaoId)
      // Mais barata primeiro: é a ordem em que a comparação se lê.
      .order("valor_total", { ascending: true }),
  ]);

  if (!cotacao) return null;

  const linhas = propostas ?? [];
  const ids = linhas.map((p) => p.id);
  const fornecedorIds = [...new Set(linhas.map((p) => p.fornecedor_id))];

  const [{ data: fornecedores }, { data: itens }, { data: parcelas }, { data: anexos }] =
    await Promise.all([
      fornecedorIds.length
        ? supabase.from("fornecedores").select("id, nome").in("id", fornecedorIds)
        : Promise.resolve({ data: [] as { id: string; nome: string }[] }),
      ids.length
        ? supabase
            .from("cotacao_proposta_itens")
            .select(
              "proposta_id, descricao, unidade, quantidade, preco_unitario, desconto_tipo, desconto_valor, total_liquido, ordem"
            )
            .in("proposta_id", ids)
            .order("ordem", { ascending: true })
        : Promise.resolve({ data: [] }),
      ids.length
        ? supabase
            .from("cotacao_proposta_parcelas")
            .select("proposta_id, numero_parcela, valor, data_vencimento")
            .in("proposta_id", ids)
            .order("numero_parcela", { ascending: true })
        : Promise.resolve({ data: [] }),
      ids.length
        ? supabase
            .from("cotacao_proposta_anexos")
            .select("proposta_id, path, nome")
            .in("proposta_id", ids)
        : Promise.resolve({ data: [] }),
    ]);

  const nomeDoFornecedor = new Map((fornecedores ?? []).map((f) => [f.id, f.nome]));

  // Uma assinatura para todos os arquivos da tela, em vez de uma por anexo.
  const urls = await urlsAssinadas(
    supabase,
    "cotacoes",
    (anexos ?? []).map((a) => a.path),
    60 * 60
  );

  const comparaveis: PropostaParaComparar[] = linhas.map((p) => ({
    id: p.id,
    fornecedor: nomeDoFornecedor.get(p.fornecedor_id) ?? "Fornecedor removido",
    valorTotal: Number(p.valor_total),
    formaPagamento: p.forma_pagamento,
    entregaPrevista: p.data_entrega_prevista,
    observacoes: p.observacoes,
    status: p.status,
    itens: (itens ?? [])
      .filter((i) => i.proposta_id === p.id)
      .map((i) => ({
        descricao: i.descricao,
        unidade: i.unidade,
        quantidade: Number(i.quantidade),
        precoUnitario: Number(i.preco_unitario),
        descontoTipo: i.desconto_tipo,
        descontoValor: i.desconto_valor === null ? null : Number(i.desconto_valor),
        totalLiquido: Number(i.total_liquido),
      })),
    parcelas: (parcelas ?? [])
      .filter((x) => x.proposta_id === p.id)
      .map((x) => ({
        numero: x.numero_parcela,
        valor: Number(x.valor),
        vencimento: x.data_vencimento,
      })),
    anexos: (anexos ?? [])
      .filter((a) => a.proposta_id === p.id)
      .map((a) => ({ nome: a.nome, url: urls.get(a.path) ?? null })),
  }));

  return {
    id: cotacao.id,
    obraId: cotacao.obra_id,
    descricao: cotacao.descricao,
    orcamentoEtapa: cotacao.orcamento_etapa,
    prazoDecisao: cotacao.prazo_decisao,
    observacoes: cotacao.observacoes,
    status: cotacao.status,
    motivoRecusa: cotacao.motivo_recusa,
    decididaEm: cotacao.decidida_em,
    propostas: comparaveis,
    compraId: linhas.find((p) => p.status === "escolhida")?.compra_id ?? null,
  };
}

/**
 * Quantas cotações desta obra esperam decisão do cliente.
 *
 * É o ÚNICO número desta feature que entra em painel, e de propósito: valor
 * cotado não é gasto da obra, e somá-lo em qualquer lugar misturaria dinheiro
 * comprometido com dinheiro que talvez nunca saia. O que o painel precisa dizer
 * é que existe uma decisão parada, não quanto ela custa.
 */
export async function cotacoesAguardandoCliente(
  supabase: Client,
  obraId: string
): Promise<number> {
  const { count } = await supabase
    .from("cotacoes")
    .select("id", { count: "exact", head: true })
    .eq("obra_id", obraId)
    .eq("status", "aguardando_cliente");

  return count ?? 0;
}
