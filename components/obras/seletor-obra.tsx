"use client";

import { useRouter, usePathname } from "next/navigation";
import { Building2 } from "lucide-react";
import { secaoDoCaminho } from "@/lib/obra-secoes";

export type ObraResumo = { id: string; nome: string };

/**
 * Troca a obra sem sair da tela em que você está.
 *
 * Reaproveita a seção do caminho atual em vez de sempre voltar para a visão
 * geral: quem está comparando o diário de duas obras quer o diário da outra,
 * não a capa dela.
 *
 * Telas internas (uma compra, um dia do diário) voltam para a lista da seção —
 * o id que está na URL pertence à obra antiga e não existe na nova.
 *
 * É `<select>` nativo de propósito: abre como o sistema operacional manda,
 * funciona no teclado e no toque sem nada da nossa parte, e numa obra com
 * dezenas de itens a busca por digitação do nativo é melhor que a nossa.
 */
export function SeletorObra({ obras, obraId }: { obras: ObraResumo[]; obraId: string }) {
  const router = useRouter();
  const pathname = usePathname();

  function trocar(novoId: string) {
    if (novoId === obraId) return;
    const secao = secaoDoCaminho(pathname);
    router.push(secao?.segmento ? `/obras/${novoId}/${secao.segmento}` : `/obras/${novoId}`);
  }

  return (
    <div className="flex items-center gap-2">
      <Building2 className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      <label htmlFor="seletor-obra" className="sr-only">
        Obra
      </label>
      <select
        id="seletor-obra"
        value={obraId}
        onChange={(e) => trocar(e.target.value)}
        className="h-9 max-w-full min-w-0 rounded-lg border border-input bg-card px-2.5 text-sm font-medium shadow-xs transition-colors hover:bg-muted focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        {obras.map((o) => (
          <option key={o.id} value={o.id}>
            {o.nome}
          </option>
        ))}
      </select>
    </div>
  );
}
