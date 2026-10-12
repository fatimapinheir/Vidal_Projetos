import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { POR_PAGINA_PADRAO, totalDePaginas } from "@/lib/paginacao";

/**
 * Quais páginas aparecem na barra: as vizinhas da atual, a primeira e a
 * última, com reticências no que foi pulado.
 *
 * Listar todas quebraria a barra numa obra com cinquenta páginas, e mostrar só
 * "anterior / próxima" obriga a clicar quarenta vezes para chegar ao começo.
 */
function paginasVisiveis(atual: number, ultima: number): (number | "...")[] {
  if (ultima <= 7) return Array.from({ length: ultima }, (_, i) => i + 1);

  const vizinhas = [atual - 1, atual, atual + 1].filter((p) => p > 1 && p < ultima);
  const paginas: (number | "...")[] = [1];

  if (vizinhas[0] && vizinhas[0] > 2) paginas.push("...");
  paginas.push(...vizinhas);
  if (vizinhas[vizinhas.length - 1] < ultima - 1) paginas.push("...");
  paginas.push(ultima);

  return paginas;
}

const BOTAO =
  "inline-flex h-8 min-w-8 items-center justify-center gap-1 rounded-lg border px-2 text-sm transition-colors";

/**
 * Barra de paginação de uma listagem.
 *
 * São links, não botões com estado: a página mora na URL (ver lib/paginacao),
 * então voltar no navegador funciona e o link leva alguém à mesma página.
 *
 * Some sozinha quando só há uma página — uma barra dizendo "1 de 1" é ruído.
 */
export function Paginacao({
  pagina,
  total,
  porPagina = POR_PAGINA_PADRAO,
  caminho,
  parametros,
  rotulo = "registros",
  className,
}: {
  pagina: number;
  /** Quantos registros existem ao todo, não quantos estão nesta página. */
  total: number;
  porPagina?: number;
  /** Caminho da tela, sem query. */
  caminho: string;
  /** Outros filtros da URL, para a paginação não apagá-los ao navegar. */
  parametros?: Record<string, string | undefined>;
  /** Nome do que está sendo listado, para o resumo: "31–45 de 312 ordens". */
  rotulo?: string;
  className?: string;
}) {
  const ultima = totalDePaginas(total, porPagina);
  if (ultima <= 1) return null;

  const primeiro = (pagina - 1) * porPagina + 1;
  const ultimo = Math.min(pagina * porPagina, total);

  function href(destino: number) {
    const busca = new URLSearchParams();
    for (const [chave, valor] of Object.entries(parametros ?? {})) {
      if (valor) busca.set(chave, valor);
    }
    if (destino > 1) busca.set("pagina", String(destino));
    const query = busca.toString();
    return query ? `${caminho}?${query}` : caminho;
  }

  return (
    <nav
      aria-label="Paginação"
      className={cn("flex flex-wrap items-center justify-between gap-3", className)}
    >
      <p className="text-xs text-muted-foreground tabular-nums">
        {primeiro}–{ultimo} de {total} {rotulo}
      </p>

      <div className="flex items-center gap-1">
        {pagina > 1 ? (
          <Link href={href(pagina - 1)} aria-label="Página anterior" className={cn(BOTAO, "hover:bg-muted")}>
            <ChevronLeft className="size-4" aria-hidden />
          </Link>
        ) : (
          <span aria-hidden className={cn(BOTAO, "opacity-40")}>
            <ChevronLeft className="size-4" />
          </span>
        )}

        {paginasVisiveis(pagina, ultima).map((p, i) =>
          p === "..." ? (
            <span key={`vao-${i}`} className="px-1 text-sm text-muted-foreground">
              …
            </span>
          ) : (
            <Link
              key={p}
              href={href(p)}
              aria-label={`Página ${p}`}
              aria-current={p === pagina ? "page" : undefined}
              className={cn(
                BOTAO,
                "tabular-nums",
                p === pagina
                  ? "border-primary bg-primary font-medium text-primary-foreground"
                  : "hover:bg-muted"
              )}
            >
              {p}
            </Link>
          )
        )}

        {pagina < ultima ? (
          <Link href={href(pagina + 1)} aria-label="Próxima página" className={cn(BOTAO, "hover:bg-muted")}>
            <ChevronRight className="size-4" aria-hidden />
          </Link>
        ) : (
          <span aria-hidden className={cn(BOTAO, "opacity-40")}>
            <ChevronRight className="size-4" />
          </span>
        )}
      </div>
    </nav>
  );
}
