"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logout } from "@/lib/auth/actions";
import { cn } from "@/lib/utils";
import type { NavItem } from "./app-shell";

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
}: {
  navItems: NavItem[];
  userName: string;
  userLabel: string;
}) {
  const [aberto, setAberto] = useState(false);
  const pathname = usePathname();

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
            className="absolute inset-0 bg-black/70"
          />

          <div
            role="dialog"
            aria-modal="true"
            aria-label="Menu de navegação"
            className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r bg-background shadow-xl"
          >
            <div className="flex items-start justify-between gap-2 border-b px-4 py-4">
              <div>
                <p className="font-heading text-sm font-semibold">Vidal Projetos</p>
                <p className="text-xs text-muted-foreground">Gestão de Obras</p>
              </div>
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

            <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2">
              {navItems.map((item) => {
                const ativo = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    // Fecha no clique, não reagindo à mudança de rota: o Link
                    // navega sem desmontar este componente, então a gaveta
                    // ficaria aberta por cima da página nova.
                    onClick={() => setAberto(false)}
                    className={cn(
                      // min-h-11 ≈ 44px, o alvo de toque mínimo confortável no iOS.
                      "flex min-h-11 items-center rounded-lg px-3 text-sm font-medium transition-colors",
                      ativo
                        ? "bg-muted text-foreground"
                        : "text-foreground/80 hover:bg-muted hover:text-foreground"
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <div className="border-t p-2">
              <div className="px-2 py-1.5">
                <p className="truncate text-sm font-medium">{userName}</p>
                <p className="text-xs text-muted-foreground">{userLabel}</p>
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
