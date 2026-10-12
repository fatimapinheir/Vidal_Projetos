import { Badge } from "@/components/ui/badge";
import { formatDateBR } from "@/lib/format-date";
import type { SituacaoFinanceira, SituacaoEntrega } from "@/lib/compras/situacao";

type Variante = "default" | "secondary" | "outline" | "destructive" | "atencao";

/**
 * Quatro níveis, e só quatro: cinza = resolvido, nada a fazer; contorno =
 * normal, ação no futuro; âmbar = saiu da sua mão e espera terceiro; vermelho =
 * problema hoje. Mais cores que isso e a listagem deixa de ser legível de
 * relance, que é a única razão de ela existir.
 */
const FINANCEIRO: Record<SituacaoFinanceira["chave"], { rotulo: string; variante: Variante }> = {
  pago: { rotulo: "Pago", variante: "secondary" },
  pagamento_enviado: { rotulo: "Pagamento enviado", variante: "atencao" },
  vencido: { rotulo: "Vencido", variante: "destructive" },
  em_dia: { rotulo: "Em dia", variante: "outline" },
  aguardando_recebimento: { rotulo: "Aguardando recebimento", variante: "outline" },
};

const ENTREGA: Record<SituacaoEntrega["chave"], { rotulo: string; variante: Variante }> = {
  recebida: { rotulo: "Recebida", variante: "secondary" },
  atrasada: { rotulo: "Atrasada", variante: "destructive" },
  prevista: { rotulo: "Prevista", variante: "outline" },
  sem_previsao: { rotulo: "—", variante: "outline" },
};

/**
 * Os mesmos estados, ditos sem apontar atraso — é o que o cliente vê.
 *
 * Vencido e atrasado desaparecem como juízo, não como dado: a parcela continua
 * "a pagar" com a data de vencimento ao lado, e a entrega continua "prevista"
 * para a data combinada. Quem abre o portal não negocia com fornecedor nem
 * remarca caminhão; marcar isso em vermelho para ele é preocupação sem ação
 * possível. Cobrança é tela do engenheiro.
 */
const FINANCEIRO_CLIENTE: Partial<
  Record<SituacaoFinanceira["chave"], { rotulo: string; variante: Variante }>
> = {
  vencido: { rotulo: "A pagar", variante: "outline" },
};

const ENTREGA_CLIENTE: Partial<
  Record<SituacaoEntrega["chave"], { rotulo: string; variante: Variante }>
> = {
  atrasada: { rotulo: "Prevista", variante: "outline" },
};

function plural(dias: number) {
  return dias === 1 ? "1 dia" : `${dias} dias`;
}

/**
 * O selo fica curto e a data vai numa linha abaixo, em cinza.
 *
 * Tudo dentro do selo ("Em dia (vence 18/10)") estoura a largura da coluna e
 * obriga a tabela a rolar na horizontal só para ler um status.
 */
function Selo({
  variante,
  rotulo,
  detalhe,
}: {
  variante: Variante;
  rotulo: string;
  detalhe?: string | null;
}) {
  return (
    <div className="flex flex-col items-start gap-0.5">
      <Badge variant={variante}>{rotulo}</Badge>
      {detalhe && <span className="text-xs text-muted-foreground">{detalhe}</span>}
    </div>
  );
}

export function SituacaoFinanceiraBadge({
  situacao,
  complemento,
  simplificado = false,
}: {
  situacao: SituacaoFinanceira | null;
  /** Texto extra na linha de baixo, ex. "2 de 3 parcelas pagas". */
  complemento?: string;
  /** Visão do cliente: sem vencido, sem contagem de dias de atraso. */
  simplificado?: boolean;
}) {
  if (!situacao) return <span className="text-muted-foreground">—</span>;

  const { rotulo, variante } =
    (simplificado ? FINANCEIRO_CLIENTE[situacao.chave] : undefined) ?? FINANCEIRO[situacao.chave];

  const detalhe =
    situacao.chave === "vencido"
      ? simplificado
        ? situacao.data
          ? `vence ${formatDateBR(situacao.data)}`
          : null
        : situacao.dias
          ? `há ${plural(situacao.dias)}`
          : null
      : situacao.chave === "em_dia" && situacao.data
        ? `vence ${formatDateBR(situacao.data)}`
        : situacao.chave === "pagamento_enviado" && situacao.data
          ? `em ${formatDateBR(situacao.data)}`
          : null;

  return (
    <Selo
      variante={variante}
      rotulo={rotulo}
      detalhe={[detalhe, complemento].filter(Boolean).join(" · ") || null}
    />
  );
}

export function SituacaoEntregaBadge({
  situacao,
  simplificado = false,
}: {
  situacao: SituacaoEntrega | null;
  /** Visão do cliente: sem entrega atrasada, sem "fora do prazo". */
  simplificado?: boolean;
}) {
  if (!situacao || situacao.chave === "sem_previsao") {
    return <span className="text-muted-foreground">—</span>;
  }

  const { rotulo, variante } =
    (simplificado ? ENTREGA_CLIENTE[situacao.chave] : undefined) ?? ENTREGA[situacao.chave];

  const detalhe =
    situacao.chave === "atrasada"
      ? situacao.data && simplificado
        ? formatDateBR(situacao.data)
        : situacao.dias
          ? `há ${plural(situacao.dias)}`
          : null
      : situacao.chave === "recebida"
        ? situacao.dias && !simplificado
          ? `${plural(situacao.dias)} fora do prazo`
          : situacao.data
            ? formatDateBR(situacao.data)
            : null
        : situacao.chave === "prevista" && situacao.data
          ? formatDateBR(situacao.data)
          : null;

  return <Selo variante={variante} rotulo={rotulo} detalhe={detalhe} />;
}
