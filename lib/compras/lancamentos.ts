import type { createClient } from "@/lib/supabase/server";
import { hojeIso } from "@/lib/locacoes/calculo";
import { situacaoFinanceiraParcela, type ParcelaSituacao } from "@/lib/compras/situacao";
import type { FormaPagamento, TipoItemOrcamento } from "@/lib/types/database.types";
import { POR_PAGINA_PADRAO } from "@/lib/paginacao";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

/** Uma parcela de ordem de compra, já achatada para virar linha de tabela. */
export type LancamentoCliente = {
  id: string;
  compraId: string;
  descricao: string;
  fornecedor: string;
  valor: number;
  vencimento: string;
  /** Dias de hoje até o vencimento. Negativo quando já passou. */
  diasAte: number;
  tipo: TipoItemOrcamento | null;
  formaPagamento: FormaPagamento;
  numeroParcela: number;
  /** Lançamento financeiro (true) ou parcela de ordem de compra (false). */
  ehLancamento: boolean;
  /** Quem registrou. É o que decide se o cliente pode excluir. */
  criadoPor: string | null;
  /**
   * Situação simplificada, já sem nada que soe a atraso.
   *
   * "pendente" engloba o que o engenheiro vê como vencido: a conversa com o
   * fornecedor é dele, e marcar a linha em vermelho para o cliente gera
   * preocupação sobre algo em que ele não pode agir.
   */
  situacao: "pendente" | "agendado" | "apos_entrega" | "pago";
};

export type ResumoPorForma = {
  forma: FormaPagamento;
  total: number;
  percentual: number;
};

export type AbaLancamentos = "proximos" | "todos";

export type FiltroLancamentos = {
  busca?: string;
  tipo?: TipoItemOrcamento;
  aba?: AbaLancamentos;
  pagina?: number;
};

export type DadosLancamentos = {
  hoje: string;
  /** Só a página pedida, já filtrada — ver a nota em `carregarLancamentos`. */
  lancamentos: LancamentoCliente[];
  /** Quantas linhas o filtro encontrou na obra inteira. */
  total: number;
  pagina: number;
  resumoPorForma: ResumoPorForma[];
  /** Quanto já saiu de caixa em ordens de compra, por forma de pagamento. */
  totalLancado: number;
};

/** Dias da janela de "próximos pagamentos". Igual ao rótulo da aba. */
export const DIAS_JANELA_LANCAMENTOS = 15;

/*
 * O termo de busca entra numa expressão `or(...)` do PostgREST, cuja sintaxe é
 * separada por vírgula e delimitada por parênteses. Um desses caracteres vindo
 * do usuário quebraria a expressão — ou, pior, mudaria o filtro para outra
 * coisa. Fora eles, o resto do texto passa como está.
 */
function limparTermo(termo: string) {
  return termo.replace(/[,()\\*]/g, " ").trim();
}

const DIAS = 86_400_000;

function diasEntre(deIso: string, ateIso: string) {
  const de = new Date(`${deIso}T00:00:00Z`).getTime();
  const ate = new Date(`${ateIso}T00:00:00Z`).getTime();
  return Math.round((ate - de) / DIAS);
}

/**
 * Lançamentos financeiros da obra pelos olhos do cliente.
 *
 * Só ordens de compra — folha e locação de equipamento não entram. Não é
 * limitação técnica: é a mesma fronteira que o rodapé da tela declara. Salário
 * de equipe é dado de folha de pagamento, e a regra de acesso do banco não o
 * entrega ao cliente; prometer "todos os lançamentos" e mostrar só uma parte
 * seria pior do que dizer de qual parte se trata.
 */
export async function carregarLancamentos(
  supabase: SupabaseClient,
  obraId: string,
  filtro: FiltroLancamentos = {}
): Promise<DadosLancamentos> {
  const hoje = hojeIso();
  const pagina = Math.max(filtro.pagina ?? 1, 1);
  const aba: AbaLancamentos = filtro.aba ?? "proximos";

  /*
   * Busca e filtro valem para a OBRA INTEIRA, não para a página visível.
   *
   * É a diferença entre uma busca que serve e uma que engana: procurar um
   * fornecedor e só achá-lo se ele por acaso estiver nas vinte e cinco linhas
   * à vista responderia "não existe" para algo que existe. Por isso o filtro
   * desce para o banco — e é também o que permite paginar sem mentir.
   */
  let consulta = supabase
    .from("vw_lancamentos_cliente")
    .select("*", { count: "exact" })
    .eq("obra_id", obraId);

  if (filtro.tipo) consulta = consulta.eq("tipo_item", filtro.tipo);

  const termo = limparTermo(filtro.busca ?? "");
  if (termo) {
    consulta = consulta.or(`descricao.ilike.%${termo}%,fornecedor_nome.ilike.%${termo}%`);
  }

  if (aba === "proximos") {
    // A mesma janela da aba, agora como filtro de data no banco: o que vence
    // de hoje até o décimo quinto dia e ainda não foi pago.
    const limite = new Date(new Date(`${hoje}T00:00:00Z`).getTime() + DIAS_JANELA_LANCAMENTOS * DIAS)
      .toISOString()
      .slice(0, 10);
    consulta = consulta
      .neq("status_efetivo", "paga")
      .gte("data_vencimento", hoje)
      .lte("data_vencimento", limite);
  }

  const de = (pagina - 1) * POR_PAGINA_PADRAO;

  const [{ data: linhas, count }, { data: resumo }] = await Promise.all([
    consulta.order("data_vencimento").range(de, de + POR_PAGINA_PADRAO - 1),
    /*
     * O resumo fala da obra inteira e é somado no banco (view criada em 0050).
     * Trazer todas as parcelas só para somá-las aqui recriaria a consulta sem
     * limite que a paginação acabou de remover.
     */
    supabase.from("vw_lancamentos_resumo_forma").select("*").eq("obra_id", obraId),
  ]);

  const lancamentos: LancamentoCliente[] = (linhas ?? []).map((p) => {
    const chave = situacaoFinanceiraParcela(p as ParcelaSituacao).chave;

    return {
      id: p.id,
      compraId: p.compra_id,
      descricao: p.descricao,
      fornecedor: p.fornecedor_nome,
      valor: p.valor,
      vencimento: p.data_vencimento,
      diasAte: diasEntre(hoje, p.data_vencimento),
      tipo: p.tipo_item,
      formaPagamento: p.forma_pagamento,
      numeroParcela: p.numero_parcela,
      ehLancamento: p.eh_lancamento,
      criadoPor: p.criado_por,
      situacao:
        chave === "pago"
          ? "pago"
          : chave === "pagamento_enviado"
            ? "agendado"
            : chave === "aguardando_recebimento"
              ? "apos_entrega"
              : "pendente",
    };
  });

  /*
   * O resumo por forma de pagamento soma o PREVISTO, não só o pago.
   *
   * O cliente usa este bloco para saber o que precisa estar disponível em cada
   * meio — quanto vai sair em boleto, quanto em pix. Somar só o que já saiu
   * responderia uma pergunta de contabilidade, que não é a dele.
   */
  const totalLancado = (resumo ?? []).reduce((soma, r) => soma + Number(r.total), 0);
  const resumoPorForma = (resumo ?? [])
    .map((r) => ({
      forma: r.forma_pagamento as FormaPagamento,
      total: Number(r.total),
      percentual: totalLancado ? (Number(r.total) / totalLancado) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total);

  return { hoje, lancamentos, total: count ?? 0, pagina, resumoPorForma, totalLancado };
}
