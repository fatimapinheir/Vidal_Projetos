import { cn } from "@/lib/utils";

export type LinhaBarra = {
  rotulo: string;
  planejado: number;
  executado: number;
};

function formatarBRL(valor: number) {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

/**
 * Planejado × executado, em barras horizontais.
 *
 * As duas séries dividem **um único eixo** (reais), o que é o ponto: dois eixos
 * com escalas diferentes no mesmo gráfico inventam uma relação que não existe
 * no dado. Por isso aqui só entra o que está em reais — percentual de avanço
 * físico é outra grandeza e vive no medidor, separado.
 */
export function BarrasPlanejadoExecutado({
  linhas,
  className,
}: {
  linhas: LinhaBarra[];
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-4 rounded-[3px] bg-grafico-trilho" /> Planejado
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-4 rounded-[3px] bg-grafico-pago" /> Executado
        </span>
      </div>

      <div className="flex flex-col gap-3">
        {linhas.map((linha) => {
          const acima = linha.executado > linha.planejado;
          return (
            <div key={linha.rotulo} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="truncate">{linha.rotulo}</span>
                <span className="shrink-0 tabular-nums">
                  <span className={cn("font-medium", acima && "text-grafico-vencido")}>
                    {formatarBRL(linha.executado)}
                  </span>
                  <span className="text-muted-foreground"> / {formatarBRL(linha.planejado)}</span>
                </span>
              </div>

              {/* Trilho = o planejado DAQUELA linha; preenchimento = executado.
                  Cada linha é uma medida contra o próprio plano.
                  A proporção é por linha, não contra o maior valor da tabela:
                  numa escala compartilhada, uma linha pequena que estourou
                  desenharia uma barra menor que uma linha grande dentro do
                  orçamento — a leitura sairia invertida. */}
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-grafico-trilho">
                <div
                  className={cn(
                    "h-full rounded-full",
                    acima ? "bg-grafico-vencido" : "bg-grafico-pago"
                  )}
                  style={{
                    width: `${
                      linha.planejado > 0
                        ? Math.min((linha.executado / linha.planejado) * 100, 100)
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
