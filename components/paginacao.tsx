import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Paginação por link, sem estado no cliente: a página vai na URL, então
 * recarregar ou compartilhar o endereço cai no mesmo lugar. `parametro` permite
 * mais de uma lista paginada na mesma tela sem uma atropelar a outra.
 */
export function Paginacao({
  pagina,
  totalPaginas,
  total,
  parametro = "pagina",
  rotuloItens = "itens",
}: {
  pagina: number;
  totalPaginas: number;
  total: number;
  parametro?: string;
  rotuloItens?: string;
}) {
  if (totalPaginas <= 1) return null;

  const anterior = Math.max(1, pagina - 1);
  const proxima = Math.min(totalPaginas, pagina + 1);

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-xs text-muted-foreground">
        Página {pagina} de {totalPaginas} · {total} {rotuloItens}
      </p>
      <div className="flex items-center gap-1">
        <Button
          nativeButton={false}
          variant="outline"
          size="sm"
          disabled={pagina === 1}
          render={
            <Link href={`?${parametro}=${anterior}`} aria-label="Página anterior" scroll={false}>
              <ChevronLeft className="size-4" />
              Anterior
            </Link>
          }
        />
        <Button
          nativeButton={false}
          variant="outline"
          size="sm"
          disabled={pagina === totalPaginas}
          render={
            <Link href={`?${parametro}=${proxima}`} aria-label="Próxima página" scroll={false}>
              Próxima
              <ChevronRight className="size-4" />
            </Link>
          }
        />
      </div>
    </div>
  );
}
