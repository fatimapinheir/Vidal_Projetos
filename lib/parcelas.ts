import type { Tables } from "@/lib/types/database.types";
import { situacaoFinanceiraParcela, type ParcelaSituacao } from "@/lib/compras/situacao";

type ParcelaComStatusEfetivo = Tables<"compra_parcelas"> & {
  status_efetivo: "pendente" | "paga" | "vencida";
  liberada_para_pagamento?: boolean;
};

/**
 * Vencida (0) > vence em até 7 dias (1) > pendente futura (2) >
 * pagamento enviado (3) > aguardando mercadoria (4) > paga (5).
 *
 * A faixa vem de `situacaoFinanceiraParcela`, a mesma que decide o selo da
 * parcela na tela. Quando a ordem era calculada aqui por conta própria, uma
 * parcela com pagamento já lançado encabeçava a lista de prioridades enquanto o
 * selo ao lado dela dizia "Pagamento enviado" — quem olhava não sabia se tinha
 * algo a fazer.
 *
 * Aguardando recebimento e pagamento enviado ficam depois das pendentes: em
 * nenhum dos dois há o que fazer agora, então não devem disputar atenção com o
 * que já pode ser pago.
 */
function priorityBucket(parcela: ParcelaComStatusEfetivo): number {
  const situacao = situacaoFinanceiraParcela({
    ...parcela,
    liberada_para_pagamento: parcela.liberada_para_pagamento ?? true,
  } as ParcelaSituacao);

  switch (situacao.chave) {
    case "vencido":
      return 0;
    case "em_dia": {
      const diasParaVencer =
        (new Date(parcela.data_vencimento).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      return diasParaVencer <= 7 ? 1 : 2;
    }
    case "pagamento_enviado":
      return 3;
    case "aguardando_recebimento":
      return 4;
    case "pago":
      return 5;
  }
}

export function ordenarParcelasPorPrioridade<T extends ParcelaComStatusEfetivo>(parcelas: T[]): T[] {
  return [...parcelas].sort((a, b) => {
    const bucketDiff = priorityBucket(a) - priorityBucket(b);
    if (bucketDiff !== 0) return bucketDiff;
    return new Date(a.data_vencimento).getTime() - new Date(b.data_vencimento).getTime();
  });
}
