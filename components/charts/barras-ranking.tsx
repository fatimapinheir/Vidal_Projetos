import { cn } from "@/lib/utils";

export type LinhaRanking = {
  rotulo: string;
  valor: number;
  /** Texto à direita. Quando ausente, mostra o valor em reais. */
  detalhe?: string;
};

function formatarBRL(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/**
 * Ranking de categorias por valor, em barras horizontais.
 *
 * Existe porque a rosca e a barra empilhada só leem bem com poucas fatias, e
 * um orçamento tem 20 e tantas etapas: em rosca viram lascas indistinguíveis.
 * Em barra ordenada, o olho acha o maior na hora e o rótulo cabe por extenso.
 *
 * A barra é comparada com a MAIOR da lista, não com o total: com 23 etapas,
 * dividir pelo total deixaria quase todas as barras com 2% de largura e nada
 * se distinguiria. O peso sobre o total vai no texto, ao lado do valor.
 *
 * Uma cor só — é uma série só. Cor por linha aqui não carregaria informação
 * nenhuma e só competiria com o comprimento, que é o que se está lendo.
 */
export function BarrasRanking({
  linhas,
  className,
  limite,
}: {
  linhas: LinhaRanking[];
  className?: string;
  /** Mostra só as N maiores e resume o resto numa linha. */
  limite?: number;
}) {
  const comValor = linhas.filter((l) => l.valor > 0).sort((a, b) => b.valor - a.valor);
  if (!comValor.length) {
    return <p className="text-sm text-muted-foreground">Nada a distribuir ainda.</p>;
  }

  const total = comValor.reduce((s, l) => s + l.valor, 0);
  const maior = comValor[0].valor;

  const visiveis = limite ? comValor.slice(0, limite) : comValor;
  const resto = limite ? comValor.slice(limite) : [];
  const valorResto = resto.reduce((s, l) => s + l.valor, 0);

  return (
    <ul className={cn("flex flex-col gap-2.5", className)}>
      {visiveis.map((linha) => {
        const peso = (linha.valor / total) * 100;
        return (
          <li key={linha.rotulo} className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate">{linha.rotulo}</span>
              <span className="shrink-0 tabular-nums">
                <span className="font-medium">{linha.detalhe ?? formatarBRL(linha.valor)}</span>
                <span className="ml-2 text-muted-foreground">{peso.toFixed(1)}%</span>
              </span>
            </div>
            <div
              className="h-2 w-full overflow-hidden rounded-full bg-grafico-trilho"
              role="img"
              aria-label={`${linha.rotulo}: ${formatarBRL(linha.valor)}, ${peso.toFixed(1)} por cento do total`}
            >
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${Math.max((linha.valor / maior) * 100, 1)}%` }}
              />
            </div>
          </li>
        );
      })}

      {!!resto.length && (
        <li className="flex items-baseline justify-between gap-3 border-t pt-2 text-sm text-muted-foreground">
          <span>
            + outras {resto.length} {resto.length === 1 ? "etapa" : "etapas"}
          </span>
          <span className="shrink-0 tabular-nums">
            {formatarBRL(valorResto)}
            <span className="ml-2">{((valorResto / total) * 100).toFixed(1)}%</span>
          </span>
        </li>
      )}
    </ul>
  );
}
