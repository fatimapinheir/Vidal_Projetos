"use client";

import { useState } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { COOKIE_LATERAL, LATERAL_RECOLHIDA } from "@/lib/lateral";

/**
 * A lateral do desktop, que recolhe para uma régua de ícones.
 *
 * O estado vira um `data-recolhida` no elemento, e quem reage a ele é o CSS
 * dos filhos (`group-data-[recolhida]/lateral:...`). É de propósito: passar a
 * flag por props exigiria furá-la através da navegação inteira — itens,
 * grupos, rótulos de seção — e cada ponto desses seria um lugar a mais para
 * esquecer de tratar. Com atributo, quem precisa some sozinho.
 *
 * A escolha vai para um cookie, não para localStorage: é o servidor que
 * renderiza esta coluna, e lido só no cliente o menu nasceria aberto em toda
 * navegação e encolheria depois, piscando.
 */
export function LateralColapsavel({
  recolhidaInicial,
  children,
}: {
  recolhidaInicial: boolean;
  children: React.ReactNode;
}) {
  const [recolhida, setRecolhida] = useState(recolhidaInicial);

  function alternar() {
    const proxima = !recolhida;
    setRecolhida(proxima);
    // Um ano, caminho raiz: é preferência de interface, não sessão.
    document.cookie = `${COOKIE_LATERAL}=${proxima ? LATERAL_RECOLHIDA : "aberta"}; path=/; max-age=31536000; samesite=lax`;
  }

  return (
    <aside
      data-recolhida={recolhida || undefined}
      className={cn(
        "group/lateral sticky top-0 hidden h-svh shrink-0 flex-col bg-sidebar text-sidebar-foreground md:flex",
        // A largura é a única medida que muda; o resto reage por CSS.
        "transition-[width] duration-200 ease-out",
        recolhida ? "w-[68px]" : "w-[232px]"
      )}
    >
      {children}

      {/*
        O botão fica no pé, junto da assinatura da marca, e não no topo.
        
        No topo ele disputaria com o logotipo — o primeiro elemento da coluna
        passaria a ser um controle de interface em vez da marca. Embaixo ele
        some do caminho de quem só quer navegar, e continua óbvio para quem
        procura.
      */}
      <button
        type="button"
        onClick={alternar}
        aria-expanded={!recolhida}
        title={recolhida ? "Expandir menu" : "Recolher menu"}
        className={cn(
          "mx-3 mb-4 flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium text-sidebar-suave transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
          recolhida && "justify-center px-0"
        )}
      >
        {recolhida ? (
          <PanelLeftOpen className="size-[18px] shrink-0" aria-hidden />
        ) : (
          <PanelLeftClose className="size-[18px] shrink-0" aria-hidden />
        )}
        <span className="group-data-[recolhida]/lateral:hidden">Recolher menu</span>
        <span className="sr-only">{recolhida ? "Expandir menu" : "Recolher menu"}</span>
      </button>
    </aside>
  );
}
