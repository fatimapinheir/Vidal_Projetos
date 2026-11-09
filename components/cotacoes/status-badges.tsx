import { Badge } from "@/components/ui/badge";
import type { CotacaoStatus, PropostaStatus } from "@/lib/types/database.types";

/**
 * Os rótulos falam do que FALTA, não do nome interno do estado.
 *
 * "Rascunho" diria ao engenheiro que o registro existe, e não que o cliente
 * ainda não o viu — que é a única coisa que ele precisa saber ali.
 */
const cotacaoLabel: Record<CotacaoStatus, string> = {
  rascunho: "Não enviada",
  aguardando_cliente: "Aguardando cliente",
  decidida: "Decidida",
  recusada: "Recusada",
};

const cotacaoVariant: Record<CotacaoStatus, "default" | "secondary" | "outline" | "destructive"> = {
  rascunho: "outline",
  aguardando_cliente: "secondary",
  decidida: "default",
  recusada: "destructive",
};

export function CotacaoStatusBadge({ status }: { status: CotacaoStatus }) {
  return <Badge variant={cotacaoVariant[status]}>{cotacaoLabel[status]}</Badge>;
}

const propostaLabel: Record<PropostaStatus, string> = {
  em_analise: "Em análise",
  escolhida: "Escolhida",
  nao_escolhida: "Não escolhida",
};

const propostaVariant: Record<PropostaStatus, "default" | "secondary" | "outline" | "destructive"> =
  {
    em_analise: "outline",
    escolhida: "default",
    nao_escolhida: "secondary",
  };

export function PropostaStatusBadge({ status }: { status: PropostaStatus }) {
  return <Badge variant={propostaVariant[status]}>{propostaLabel[status]}</Badge>;
}
