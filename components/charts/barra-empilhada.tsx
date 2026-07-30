import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type SegmentoBarra = {
  rotulo: string;
  valor: number;
  /** Classe de fundo, ex: "bg-grafico-a-vencer". */
  cor: string;
  icone: ReactNode;
};

function formatarBRL(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/**
 * Parte-para-todo em barra horizontal. Preferida à rosca quando os rótulos são
 * longos ou os valores próximos — comprimento lado a lado se compara melhor que
 * ângulo.
 *
 * Os segmentos são separados por um vão de 2px na cor da superfície, não por
 * borda: borda engorda a marca e falseia a proporção.
 */
export function BarraEmpilhada({
  segmentos,
  className,
}: {
  segmentos: SegmentoBarra[];
  className?: string;
}) {
  const comValor = segmentos.filter((s) => s.valor > 0);
  const total = comValor.reduce((s, seg) => s + seg.valor, 0);

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full bg-grafico-trilho">
        {comValor.map((segmento) => (
          <div
            key={segmento.rotulo}
            className={cn("h-full first:rounded-l-full last:rounded-r-full", segmento.cor)}
            style={{ width: `${(segmento.valor / total) * 100}%` }}
          />
        ))}
      </div>

      <ul className="flex flex-col gap-2">
        {segmentos.map((segmento) => (
          <li key={segmento.rotulo} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <span className={cn("size-2.5 shrink-0 rounded-[3px]", segmento.cor)} />
              <span className="shrink-0 text-muted-foreground">{segmento.icone}</span>
              <span className="truncate">{segmento.rotulo}</span>
            </span>
            <span className="shrink-0 font-medium tabular-nums">{formatarBRL(segmento.valor)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
