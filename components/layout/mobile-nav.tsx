"use client";

import { useEffect, useState } from "react";
import { Menu, X, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logout } from "@/lib/auth/actions";
import { Logo } from "@/components/marca/logo";
import { NavEntries } from "./nav-entries";
import type { NavEntry } from "./app-shell";

/**
 * Navegação para telas estreitas. Sem isso, o celular ficava sem menu nenhum —
 * a sidebar é `md:flex` e o header móvel só tinha logo e "Sair".
 *
 * É uma gaveta própria em vez do DropdownMenu porque o popup do base-ui herda a
 * largura do gatilho (`w-(--anchor-width)`), e o gatilho aqui é um botão de
 * ícone.
 */
export function MobileNav({
  navItems,
  userName,
  userLabel,
  obraLembrada = null,
}: {
  navItems: NavEntry[];
  userName: string;
  userLabel: string;
  obraLembrada?: string | null;
}) {
  const [aberto, setAberto] = useState(false);

  // Trava a rolagem do fundo e devolve o Esc enquanto a gaveta está aberta.
  useEffect(() => {
    if (!aberto) return;

    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") setAberto(false);
    };
    document.addEventListener("keydown", aoTeclar);

    return () => {
      document.body.style.overflow = overflowAnterior;
      document.removeEventListener("keydown", aoTeclar);
    };
  }, [aberto]);

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={() => setAberto(true)}
        aria-label="Abrir menu"
        aria-expanded={aberto}
      >
        <Menu className="size-5" />
      </Button>

      {aberto && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="Fechar menu"
            onClick={() => setAberto(false)}
            className="absolute inset-0 bg-foreground/40 backdrop-blur-[2px]"
          />

          <div
            role="dialog"
            aria-modal="true"
            aria-label="Menu de navegação"
            className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-sidebar text-sidebar-foreground shadow-xl"
          >
            <div className="flex items-center justify-between gap-2 border-b border-sidebar-border px-4 py-4">
              <Logo />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => setAberto(false)}
                aria-label="Fechar menu"
              >
                <X className="size-5" />
              </Button>
            </div>

            <nav className="flex flex-1 flex-col gap-2 overflow-y-auto px-3 py-2">
              {/* Fecha no clique, não reagindo à rota: o Link navega sem
                  desmontar este componente, então a gaveta ficaria aberta por
                  cima da página nova. */}
              <NavEntries
                entradas={navItems}
                obraLembrada={obraLembrada}
                onNavegar={() => setAberto(false)}
              />
            </nav>

            <div className="border-t border-sidebar-border p-3">
              <div className="px-2 py-1.5">
                <p className="truncate text-sm font-medium">{userName}</p>
                <p className="text-xs text-sidebar-suave">{userLabel}</p>
              </div>
              <form action={logout}>
                <Button
                  type="submit"
                  variant="ghost"
                  className="min-h-11 w-full justify-start gap-2"
                >
                  <LogOut className="size-4" />
                  Sair
                </Button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
