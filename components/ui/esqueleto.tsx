import { cn } from "@/lib/utils";

/**
 * Bloco cinza que ocupa o lugar do conteúdo enquanto ele carrega.
 *
 * Existe para a navegação ter resposta imediata. Sem um `loading.tsx` — e o
 * projeto não tinha nenhum —, clicar numa seção deixava a tela ANTERIOR
 * congelada até a nova terminar de renderizar no servidor. Nada mudava na
 * tela por um segundo, e "não acontece nada" é indistinguível de travado.
 *
 * `aria-hidden`: é decoração. Quem usa leitor de tela recebe o aviso pelo
 * `role="status"` do contêiner, uma vez, em vez de ouvir a descrição de cada
 * retângulo.
 */
export function Esqueleto({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("animate-pulse rounded-md bg-muted", className)}
    />
  );
}
