"use client";

import { type ReactNode } from "react";
import { Info } from "lucide-react";
import { Popover } from "@base-ui/react/popover";
import { cn } from "@/lib/utils";

/**
 * O texto que explica a tela, guardado atrás de um ícone ao lado do título.
 *
 * Cada tela de obra abria com um parágrafo de cinco linhas explicando como
 * aquilo funciona. O texto é bom e precisa existir — é ele que diz por que a
 * locação por mês não soma igual à por dia, ou o que acontece ao fechar o
 * dia —, mas ele é para a PRIMEIRA vez. Quem abre a tela todo dia já sabe, e
 * passa a rolar cinco linhas para chegar ao que veio fazer.
 *
 * No ícone, o texto fica a um clique de distância e sai do caminho. O título
 * volta a ser a primeira coisa, e o conteúdo da tela a segunda.
 */
export function AjudaDaPagina({
  titulo,
  children,
  className,
}: {
  /** Cabeçalho do balão. Normalmente o mesmo título da tela. */
  titulo: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Popover.Root>
      <Popover.Trigger
        className={cn(
          // Alvo de toque de 32px com ícone de 16: no celular, um ícone solto
          // de 16px é pequeno demais para acertar com o polegar.
          "inline-flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
          className
        )}
        aria-label={`Como funciona: ${titulo}`}
      >
        <Info className="size-[18px]" aria-hidden />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={8} align="start" className="z-50">
          <Popover.Popup
            className={cn(
              "max-w-[min(26rem,calc(100vw-2rem))] rounded-xl border bg-popover p-4 text-sm text-popover-foreground shadow-lg outline-none",
              // A animação segue o lado de onde o balão abriu — o atributo é
              // posto pelo próprio posicionador.
              "origin-[var(--transform-origin)] transition-[transform,opacity] data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0"
            )}
          >
            <Popover.Arrow className="data-[side=bottom]:top-[-6px] data-[side=left]:right-[-11px] data-[side=right]:left-[-11px] data-[side=top]:bottom-[-6px]">
              <svg width="14" height="7" viewBox="0 0 14 7" fill="none" aria-hidden>
                <path d="M7 0 14 7H0z" className="fill-popover" />
              </svg>
            </Popover.Arrow>
            <Popover.Title className="mb-1 font-heading text-sm font-semibold">
              {titulo}
            </Popover.Title>
            <Popover.Description
              render={<div className="flex flex-col gap-2 leading-snug text-muted-foreground" />}
            >
              {children}
            </Popover.Description>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
