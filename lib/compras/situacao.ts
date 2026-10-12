import type { ParcelaStatus } from "@/lib/types/database.types";

/**
 * Situação de uma ordem de compra em dois eixos: dinheiro e mercadoria.
 *
 * Eram a mesma coluna antes, e isso escondia os dois casos que mais importam —
 * material que não chegou com pagamento em ordem, e pagamento vencido de
 * material já recebido. Separar deixa a listagem dizer qual dos dois está
 * travado.
 *
 * A derivação vive aqui, e não nas telas, pelo mesmo motivo da visão geral:
 * listagem, detalhe da compra e visão geral da obra mostram a mesma parcela, e
 * quando cada uma calculava o próprio rótulo elas se contradiziam na tela.
 */

/** O que a view entrega e esta derivação consome. */
export type ParcelaSituacao = {
  status_efetivo: ParcelaStatus;
  liberada_para_pagamento: boolean;
  pagamento_enviado_em: string | null;
  data_vencimento: string;
  data_entrega_prevista: string | null;
  data_entrega_real: string | null;
};

export type ChaveFinanceira =
  | "vencido"
  | "em_dia"
  | "pagamento_enviado"
  | "aguardando_recebimento"
  | "pago";

export type ChaveEntrega = "atrasada" | "prevista" | "recebida" | "sem_previsao";

export type SituacaoFinanceira = {
  chave: ChaveFinanceira;
  /** Dias de atraso, em "vencido". */
  dias?: number;
  /** Vencimento em "em_dia"/"vencido"; data do envio em "pagamento_enviado". */
  data?: string | null;
};

export type SituacaoEntrega = {
  chave: ChaveEntrega;
  /** Dias de atraso, em "atrasada" e em "recebida" fora do prazo. */
  dias?: number;
  data?: string | null;
};

/**
 * Ordem de gravidade — a primeira é a que a ordem de compra inteira exibe.
 *
 * "Em dia" vem antes de "pagamento enviado" porque ainda exige ação depois;
 * enviado já saiu das mãos de quem olha a tela. É a mesma ordem de
 * `ordenarParcelasPorPrioridade`, de propósito: a lista de prioridades e o
 * selo da ordem não podem apontar para parcelas diferentes.
 */
const GRAVIDADE_FINANCEIRA: ChaveFinanceira[] = [
  "vencido",
  "em_dia",
  "pagamento_enviado",
  "aguardando_recebimento",
  "pago",
];

const GRAVIDADE_ENTREGA: ChaveEntrega[] = ["atrasada", "prevista", "recebida", "sem_previsao"];

function diasEntre(deIso: string, ateIso: string): number {
  const de = new Date(`${deIso}T00:00:00Z`).getTime();
  const ate = new Date(`${ateIso}T00:00:00Z`).getTime();
  return Math.round((ate - de) / 86_400_000);
}

/**
 * Situação financeira de uma parcela.
 *
 * "Vencido" sai de `status_efetivo`, calculado no banco com `current_date` — a
 * data é do servidor e não do navegador, e a view já sabe que parcela
 * aguardando mercadoria não vence.
 *
 * Pagamento enviado passa na frente de vencido: se o lançamento foi feito, não
 * é mais pendência de quem está olhando, mesmo que a data tenha passado.
 */
export function situacaoFinanceiraParcela(parcela: ParcelaSituacao): SituacaoFinanceira {
  if (parcela.status_efetivo === "paga") return { chave: "pago" };
  if (!parcela.liberada_para_pagamento) return { chave: "aguardando_recebimento" };
  if (parcela.pagamento_enviado_em) {
    return { chave: "pagamento_enviado", data: parcela.pagamento_enviado_em };
  }
  if (parcela.status_efetivo === "vencida") {
    return {
      chave: "vencido",
      dias: diasEntre(parcela.data_vencimento, hojeLocal()),
      data: parcela.data_vencimento,
    };
  }
  return { chave: "em_dia", data: parcela.data_vencimento };
}

/** Situação da mercadoria de uma parcela. Sem entrega prevista, não há o que dizer. */
export function situacaoEntregaParcela(parcela: ParcelaSituacao): SituacaoEntrega {
  if (parcela.data_entrega_real) {
    const atrasou =
      parcela.data_entrega_prevista && parcela.data_entrega_real > parcela.data_entrega_prevista;
    return {
      chave: "recebida",
      data: parcela.data_entrega_real,
      dias: atrasou
        ? diasEntre(parcela.data_entrega_prevista!, parcela.data_entrega_real)
        : undefined,
    };
  }
  if (!parcela.data_entrega_prevista) return { chave: "sem_previsao" };

  const hoje = hojeLocal();
  if (parcela.data_entrega_prevista < hoje) {
    return {
      chave: "atrasada",
      dias: diasEntre(parcela.data_entrega_prevista, hoje),
      data: parcela.data_entrega_prevista,
    };
  }
  return { chave: "prevista", data: parcela.data_entrega_prevista };
}

function hojeLocal(): string {
  const agora = new Date();
  const mes = String(agora.getMonth() + 1).padStart(2, "0");
  const dia = String(agora.getDate()).padStart(2, "0");
  return `${agora.getFullYear()}-${mes}-${dia}`;
}

function piorDe<C extends string, S extends { chave: C; dias?: number; data?: string | null }>(
  situacoes: S[],
  gravidade: C[]
): S | null {
  if (!situacoes.length) return null;

  const chave = gravidade.find((c) => situacoes.some((s) => s.chave === c));
  if (!chave) return null;

  const iguais = situacoes.filter((s) => s.chave === chave);
  // Entre parcelas no mesmo estado, a que dói mais: maior atraso, ou o
  // vencimento/entrega mais próximo. Mostrar outra qualquer faria a ordem
  // parecer mais folgada do que é.
  return iguais.reduce((pior, atual) => {
    if ((atual.dias ?? 0) !== (pior.dias ?? 0)) {
      return (atual.dias ?? 0) > (pior.dias ?? 0) ? atual : pior;
    }
    if (atual.data && pior.data && atual.data !== pior.data) {
      return atual.data < pior.data ? atual : pior;
    }
    return pior;
  });
}

/** Situação financeira da ordem de compra: a pior entre suas parcelas. */
export function situacaoFinanceiraCompra(parcelas: ParcelaSituacao[]): SituacaoFinanceira | null {
  return piorDe(parcelas.map(situacaoFinanceiraParcela), GRAVIDADE_FINANCEIRA);
}

/** Situação de entrega da ordem de compra: a pior entre suas parcelas. */
export function situacaoEntregaCompra(parcelas: ParcelaSituacao[]): SituacaoEntrega | null {
  return piorDe(parcelas.map(situacaoEntregaParcela), GRAVIDADE_ENTREGA);
}

/** Quantas de quantas já foram pagas — o complemento do selo quando há mais de uma. */
export function contagemPagas(parcelas: ParcelaSituacao[]) {
  return {
    total: parcelas.length,
    pagas: parcelas.filter((p) => p.status_efetivo === "paga").length,
  };
}
