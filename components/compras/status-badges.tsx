import { Badge } from "@/components/ui/badge";
import type { CompraStatus } from "@/lib/types/database.types";

const compraLabel: Record<CompraStatus, string> = {
  cotada: "Aguardando aprovação",
  aprovada: "Aprovada",
  recusada: "Recusada",
  paga: "Paga",
};

const compraVariant: Record<CompraStatus, "default" | "secondary" | "outline" | "destructive"> = {
  cotada: "outline",
  aprovada: "default",
  recusada: "destructive",
  paga: "secondary",
};

export function CompraStatusBadge({ status }: { status: CompraStatus }) {
  return <Badge variant={compraVariant[status]}>{compraLabel[status]}</Badge>;
}

/*
 * O selo da parcela mora em ./situacao-badges: ele passou a depender de
 * "pagamento enviado" e de dias de atraso, e manter dois componentes com a
 * mesma função era o caminho mais curto para a listagem e o detalhe dizerem
 * coisas diferentes sobre a mesma parcela.
 */
