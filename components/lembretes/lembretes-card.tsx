import Link from "next/link";
import { Bell, Wallet, CalendarClock, AlertTriangle } from "lucide-react";
import { Card, CardHeader, CardTitle, CardAction, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDateBR } from "@/lib/format-date";
import {
  type Lembrete,
  DIAS_AVISO_PAGAMENTO,
  DIAS_AVISO_TAREFA,
} from "@/lib/lembretes";

function moeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/**
 * Quanto falta, em palavras.
 *
 * "em 3 dias" se lê mais rápido que a data, e é o que decide se a coisa é
 * para hoje ou para a semana que vem. A data continua ali ao lado, porque é
 * ela que se usa para agendar.
 */
function prazo(dias: number): { texto: string; urgente: boolean } {
  if (dias < 0) {
    const atraso = Math.abs(dias);
    return { texto: `há ${atraso} ${atraso === 1 ? "dia" : "dias"}`, urgente: true };
  }
  if (dias === 0) return { texto: "hoje", urgente: true };
  if (dias === 1) return { texto: "amanhã", urgente: true };
  return { texto: `em ${dias} dias`, urgente: dias <= 3 };
}

const ICONE = {
  pagamento: Wallet,
  tarefa: CalendarClock,
} as const;

/** Quantos cartões cabem antes de virar paredão. O resto vira uma linha. */
const LIMITE_VISIVEL = 6;

/**
 * O que está chegando: pagamentos a vencer e tarefas a começar.
 *
 * Substitui o card que mostrava só tarefas com lembrete configurado à mão —
 * que ninguém configurava, e por isso vivia vazio. Agora os lembretes saem das
 * datas que já existem no sistema.
 */
export function LembretesCard({
  lembretes,
  tarefasAtrasadas = 0,
  obraId,
  mostrarObra = false,
}: {
  lembretes: Lembrete[];
  tarefasAtrasadas?: number;
  /** Quando há uma obra em foco, o link de atraso aponta para o Avanço dela. */
  obraId?: string;
  mostrarObra?: boolean;
}) {
  if (!lembretes.length && !tarefasAtrasadas) return null;

  const visiveis = lembretes.slice(0, LIMITE_VISIVEL);
  const ocultos = lembretes.length - visiveis.length;

  const vencidos = lembretes.filter((l) => l.diasRestantes < 0).length;
  const aPagar = lembretes
    .filter((l) => l.tipo === "pagamento")
    .reduce((soma, l) => soma + (l.valor ?? 0), 0);

  return (
    <Card className={vencidos ? "border-destructive/40" : "border-atencao/40"}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Bell className={vencidos ? "size-4 text-destructive" : "size-4 text-atencao"} />
          O que está chegando
        </CardTitle>
        <CardAction>
          <span className="text-sm text-muted-foreground">
            {aPagar > 0 && <span className="font-medium text-foreground">{moeda(aPagar)}</span>}
            {aPagar > 0 && " a pagar · "}
            pagamentos em {DIAS_AVISO_PAGAMENTO} dias, tarefas em {DIAS_AVISO_TAREFA}
          </span>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {visiveis.map((lembrete) => {
          const Icone = ICONE[lembrete.tipo];
          const { texto, urgente } = prazo(lembrete.diasRestantes);
          return (
            <Link
              key={lembrete.id}
              href={lembrete.href}
              className={`flex flex-col gap-1 rounded-lg border p-3 text-sm transition-colors sm:flex-row sm:items-center sm:justify-between sm:gap-3 ${
                urgente
                  ? "border-destructive/30 bg-destructive/5 hover:bg-destructive/10"
                  : "hover:bg-muted/50"
              }`}
            >
              <div className="flex min-w-0 items-start gap-2.5">
                <Icone
                  className={urgente ? "mt-0.5 size-4 shrink-0 text-destructive" : "mt-0.5 size-4 shrink-0 text-muted-foreground"}
                  aria-hidden
                />
                <div className="min-w-0">
                  <p className="truncate font-medium">{lembrete.titulo}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {mostrarObra && lembrete.obraNome ? `${lembrete.obraNome} · ` : ""}
                    {lembrete.detalhe}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-3 sm:justify-end">
                {lembrete.valor !== undefined && (
                  <span className="font-medium tabular-nums">{moeda(lembrete.valor)}</span>
                )}
                <span className="text-xs text-muted-foreground">
                  {lembrete.tipo === "pagamento" ? "vence" : "começa"}{" "}
                  {formatDateBR(lembrete.data)}
                </span>
                <Badge variant={urgente ? "destructive" : "outline"}>{texto}</Badge>
              </div>
            </Link>
          );
        })}

        {ocultos > 0 && (
          <p className="px-1 text-xs text-muted-foreground">
            + outros {ocultos} {ocultos === 1 ? "item" : "itens"} na janela.
          </p>
        )}

        {/*
          Tarefa atrasada não vira cartão: nos dados reais são dezenas, e
          dezenas de cartões deixam de ser aviso. Vai como uma linha, apontando
          para Avanço — que é onde se resolve, registrando o percentual.
        */}
        {tarefasAtrasadas > 0 && (
          <Link
            href={obraId ? `/obras/${obraId}/avanco` : "/obras"}
            className="flex items-center gap-2.5 rounded-lg border border-atencao/30 bg-atencao/5 p-3 text-sm transition-colors hover:bg-atencao/10"
          >
            <AlertTriangle className="size-4 shrink-0 text-atencao" aria-hidden />
            <span>
              <span className="font-medium">
                {tarefasAtrasadas} {tarefasAtrasadas === 1 ? "tarefa" : "tarefas"}
              </span>{" "}
              já {tarefasAtrasadas === 1 ? "deveria" : "deveriam"} ter começado e ainda{" "}
              {tarefasAtrasadas === 1 ? "não teve" : "não tiveram"} avanço registrado.
            </span>
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
