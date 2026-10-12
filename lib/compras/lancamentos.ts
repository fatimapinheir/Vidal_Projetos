import type { createClient } from "@/lib/supabase/server";
import { hojeIso } from "@/lib/locacoes/calculo";
import { situacaoFinanceiraParcela, type ParcelaSituacao } from "@/lib/compras/situacao";
import type { FormaPagamento, TipoItemOrcamento } from "@/lib/types/database.types";

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

export type DadosLancamentos = {
  hoje: string;
  /** Todas as parcelas da obra, da mais próxima de vencer para a mais distante. */
  lancamentos: LancamentoCliente[];
  resumoPorForma: ResumoPorForma[];
  /** Quanto já saiu de caixa em ordens de compra, por forma de pagamento. */
  totalLancado: number;
};

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
  obraId: string
): Promise<DadosLancamentos> {
  const hoje = hojeIso();

  const { data: parcelas } = await supabase
    .from("vw_compra_parcelas")
    .select(
      "*, compras!inner(obra_id, descricao, tipo_item, forma_pagamento, eh_lancamento, criado_por, fornecedores(nome))"
    )
    .eq("compras.obra_id", obraId)
    .order("data_vencimento");

  const lancamentos: LancamentoCliente[] = (parcelas ?? []).map((p) => {
    const compra = p.compras as unknown as {
      descricao: string;
      tipo_item: TipoItemOrcamento | null;
      forma_pagamento: FormaPagamento;
      eh_lancamento: boolean;
      criado_por: string | null;
      fornecedores: { nome: string } | null;
    };
    const chave = situacaoFinanceiraParcela(p as ParcelaSituacao).chave;

    return {
      id: p.id,
      compraId: p.compra_id,
      descricao: compra.descricao,
      fornecedor: compra.fornecedores?.nome ?? "—",
      valor: p.valor,
      vencimento: p.data_vencimento,
      diasAte: diasEntre(hoje, p.data_vencimento),
      tipo: compra.tipo_item,
      formaPagamento: compra.forma_pagamento,
      numeroParcela: p.numero_parcela,
      ehLancamento: compra.eh_lancamento,
      criadoPor: compra.criado_por,
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
  const porForma = new Map<FormaPagamento, number>();
  for (const l of lancamentos) {
    porForma.set(l.formaPagamento, (porForma.get(l.formaPagamento) ?? 0) + l.valor);
  }
  const totalLancado = [...porForma.values()].reduce((s, v) => s + v, 0);

  const resumoPorForma = [...porForma.entries()]
    .map(([forma, total]) => ({
      forma,
      total,
      percentual: totalLancado ? (total / totalLancado) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total);

  return { hoje, lancamentos, resumoPorForma, totalLancado };
}
