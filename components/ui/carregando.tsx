import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * "Carregando", dito em voz alta — para quem olha, não só para quem ouve.
 *
 * O esqueleto que o `loading.tsx` mostra tinha a palavra "Carregando" apenas em
 * `sr-only`: o leitor de tela anunciava, e quem enxerga via três retângulos
 * cinza. Retângulo cinza parado lê como TELA VAZIA, não como "está vindo" — e a
 * diferença importa quando a espera é de mais de um segundo, que é o caso aqui
 * (medido: ~1,4 s de ida e volta ao banco, porque a função roda na Virgínia e o
 * banco está em São Paulo).
 *
 * O spinner resolve isso porque se MEXE: movimento é a única coisa que
 * distingue "carregando" de "quebrou" sem precisar de texto.
 */
export function Carregando({
  texto = "Carregando...",
  className,
}: {
  texto?: string;
  className?: string;
}) {
  return (
    <p
      className={cn("flex items-center gap-2 text-sm text-muted-foreground", className)}
      role="status"
      aria-live="polite"
    >
      <Loader2 className="size-4 animate-spin" aria-hidden />
      {texto}
    </p>
  );
}
