import type { Tables } from "@/lib/types/database.types";

type ParcelaComStatusEfetivo = Tables<"compra_parcelas"> & {
  status_efetivo: "pendente" | "paga" | "vencida";
};

/** Vencida (0) > vence em até 7 dias (1) > pendente futura (2) > paga (3). */
function priorityBucket(parcela: ParcelaComStatusEfetivo): number {
  if (parcela.status_efetivo === "vencida") return 0;
  if (parcela.status_efetivo === "paga") return 3;

  const diasParaVencer =
    (new Date(parcela.data_vencimento).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  return diasParaVencer <= 7 ? 1 : 2;
}

export function ordenarParcelasPorPrioridade<T extends ParcelaComStatusEfetivo>(parcelas: T[]): T[] {
  return [...parcelas].sort((a, b) => {
    const bucketDiff = priorityBucket(a) - priorityBucket(b);
    if (bucketDiff !== 0) return bucketDiff;
    return new Date(a.data_vencimento).getTime() - new Date(b.data_vencimento).getTime();
  });
}
