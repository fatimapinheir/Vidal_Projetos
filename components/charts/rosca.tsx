import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type FatiaRosca = {
  rotulo: string;
  valor: number;
  /** Classe de cor do preenchimento, ex: "fill-grafico-vencido". */
  cor: string;
  /** Ícone da legenda. Status nunca é comunicado só por cor. */
  icone: ReactNode;
};

const RAIO = 70;
const ESPESSURA = 22;
const TAMANHO = (RAIO + ESPESSURA / 2) * 2 + 4;
const CENTRO = TAMANHO / 2;
/** Vão de 2px entre fatias, na cor da superfície — separa sem desenhar borda. */
const VAO_PX = 2;

function ponto(anguloGraus: number, raio: number) {
  const rad = ((anguloGraus - 90) * Math.PI) / 180;
  return { x: CENTRO + raio * Math.cos(rad), y: CENTRO + raio * Math.sin(rad) };
}

function arco(inicioGraus: number, fimGraus: number) {
  const raioExterno = RAIO + ESPESSURA / 2;
  const raioInterno = RAIO - ESPESSURA / 2;
  const grande = fimGraus - inicioGraus > 180 ? 1 : 0;

  const ie = ponto(inicioGraus, raioExterno);
  const fe = ponto(fimGraus, raioExterno);
  const fi = ponto(fimGraus, raioInterno);
  const ii = ponto(inicioGraus, raioInterno);

  return [
    `M ${ie.x} ${ie.y}`,
    `A ${raioExterno} ${raioExterno} 0 ${grande} 1 ${fe.x} ${fe.y}`,
    `L ${fi.x} ${fi.y}`,
    `A ${raioInterno} ${raioInterno} 0 ${grande} 0 ${ii.x} ${ii.y}`,
    "Z",
  ].join(" ");
}

function formatarBRL(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/**
 * Rosca de parte-para-todo. Só serve para leitura de relance com poucas fatias
 * — para comparar valores próximos, barra ou o número puro leem melhor.
 *
 * Toda fatia aparece também na legenda, com ícone, rótulo e valor em texto: a
 * cor nunca é o único jeito de ler o dado.
 */
export function Rosca({
  fatias,
  valorCentral,
  rotuloCentral,
  className,
}: {
  fatias: FatiaRosca[];
  valorCentral: string;
  rotuloCentral: string;
  className?: string;
}) {
  const comValor = fatias.filter((f) => f.valor > 0);
  const total = comValor.reduce((s, f) => s + f.valor, 0);

  let anguloAtual = 0;
  const arcos = comValor.map((fatia) => {
    const fatiaGraus = (fatia.valor / total) * 360;
    // Converte o vão de 2px em graus no raio médio; fatia minúscula não perde
    // a fatia inteira para o vão.
    const vaoGraus = Math.min((VAO_PX / (2 * Math.PI * RAIO)) * 360, fatiaGraus / 3);
    const inicio = anguloAtual;
    const fim = anguloAtual + fatiaGraus;
    anguloAtual = fim;
    return {
      rotulo: fatia.rotulo,
      cor: fatia.cor,
      d: arco(inicio + vaoGraus / 2, fim - vaoGraus / 2),
      percentual: (fatia.valor / total) * 100,
    };
  });

  return (
    <div className={cn("flex flex-col items-center gap-4 sm:flex-row sm:items-center", className)}>
      <svg
        viewBox={`0 0 ${TAMANHO} ${TAMANHO}`}
        className="h-40 w-40 shrink-0"
        role="img"
        aria-label={`${rotuloCentral}: ${valorCentral}. ${comValor
          .map((f) => `${f.rotulo} ${formatarBRL(f.valor)}`)
          .join(", ")}`}
      >
        {total === 0 ? (
          <circle
            cx={CENTRO}
            cy={CENTRO}
            r={RAIO}
            fill="none"
            strokeWidth={ESPESSURA}
            className="stroke-grafico-trilho"
          />
        ) : (
          arcos.map((a) => <path key={a.rotulo} d={a.d} className={a.cor} />)
        )}

        <text
          x={CENTRO}
          y={CENTRO - 4}
          textAnchor="middle"
          className="fill-foreground text-[15px] font-semibold"
        >
          {valorCentral}
        </text>
        <text
          x={CENTRO}
          y={CENTRO + 14}
          textAnchor="middle"
          className="fill-muted-foreground text-[10px]"
        >
          {rotuloCentral}
        </text>
      </svg>

      <ul className="flex w-full flex-col gap-2">
        {fatias.map((fatia) => (
          <li key={fatia.rotulo} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <span className={cn("size-2.5 shrink-0 rounded-[3px]", fatia.cor.replace("fill-", "bg-"))} />
              <span className="shrink-0 text-muted-foreground">{fatia.icone}</span>
              <span className="truncate">{fatia.rotulo}</span>
            </span>
            <span className="shrink-0 font-medium tabular-nums">{formatarBRL(fatia.valor)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
