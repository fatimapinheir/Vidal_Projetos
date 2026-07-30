import { Badge } from "@/components/ui/badge";
import type { CompraStatus, ParcelaStatus } from "@/lib/types/database.types";

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

const parcelaLabel: Record<ParcelaStatus, string> = {
  pendente: "Pendente",
  paga: "Paga",
  vencida: "Vencida",
};

const parcelaVariant: Record<ParcelaStatus, "default" | "secondary" | "outline" | "destructive"> = {
  pendente: "outline",
  paga: "secondary",
  vencida: "destructive",
};

export function ParcelaStatusBadge({ status }: { status: ParcelaStatus }) {
  return <Badge variant={parcelaVariant[status]}>{parcelaLabel[status]}</Badge>;
}
