"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function ObraTabs({ obraId }: { obraId: string }) {
  const pathname = usePathname();
  const abaAtivaRef = useRef<HTMLAnchorElement>(null);
  const base = `/obras/${obraId}`;

  // São 12 abas: no celular a ativa quase sempre nasce fora da área visível, e
  // sem isso não há nenhuma pista de onde você está.
  useEffect(() => {
    abaAtivaRef.current?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [pathname]);

  const tabs = [
    { href: base, label: "Visão geral" },
    { href: `${base}/clientes`, label: "Clientes" },
    { href: `${base}/equipe`, label: "Equipe" },
    { href: `${base}/presencas`, label: "Presenças" },
    { href: `${base}/diario`, label: "Diário" },
    { href: `${base}/fechamentos`, label: "Fechamentos" },
    { href: `${base}/compras`, label: "Ordens de Compra" },
    { href: `${base}/locacoes`, label: "Locações" },
    { href: `${base}/orcamento`, label: "Planejamento" },
    { href: `${base}/cronograma`, label: "Cronograma" },
    { href: `${base}/folgas`, label: "Folgas" },
    { href: `${base}/avanco`, label: "Avanço" },
  ];

  return (
    <nav className="flex gap-1 overflow-x-auto border-b">
      {tabs.map((tab) => {
        const active = tab.href === base ? pathname === base : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            ref={active ? abaAtivaRef : undefined}
            className={cn(
              // min-h-11 ≈ 44px: alvo de toque confortável no celular.
              "flex min-h-11 shrink-0 items-center border-b-2 px-3 text-sm font-medium transition-colors",
              active
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
