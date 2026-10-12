"use client";

import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

const CHAVE = "vidal-tema";

/**
 * Alterna claro/escuro e grava a escolha.
 *
 * Sem estado de React de propósito. A verdade do tema é a classe `dark` no
 * <html>, que o script do <head> já aplicou antes deste componente existir —
 * um `useState` aqui teria valor inicial próprio, começaria errado metade das
 * vezes e piscaria o ícone trocado na hidratação.
 *
 * Então quem escolhe o ícone é o CSS, pela mesma classe (`dark:`), e o clique
 * lê o DOM na hora. Zero estado, zero divergência entre servidor e cliente.
 */
export function TemaToggle({ className }: { className?: string }) {
  function alternar() {
    const escuro = document.documentElement.classList.toggle("dark");
    try {
      localStorage.setItem(CHAVE, escuro ? "escuro" : "claro");
    } catch {
      // Navegação privada bloqueia o storage. O tema continua valendo nesta
      // aba; só não sobrevive ao recarregar.
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      onClick={alternar}
      // Rótulo único para os dois estados: ele descreve a ação, que não muda.
      // Um rótulo que alternasse junto com o ícone precisaria de estado, e é
      // exatamente isso que este componente evita.
      aria-label="Alternar entre tema claro e escuro"
      className={className}
    >
      <Moon className="size-4 dark:hidden" aria-hidden />
      <Sun className="hidden size-4 dark:block" aria-hidden />
    </Button>
  );
}
