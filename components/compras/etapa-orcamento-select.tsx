"use client";

import { useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";
import { definirEtapaOrcamento } from "@/app/actions/compras";

/**
 * Etapa do orçamento à qual esta ordem de compra pertence, editável na própria
 * tela da ordem.
 *
 * Fica aqui e não só no formulário de criação porque é o vínculo que alimenta
 * o comparativo orçado × comprado — e as ordens criadas antes do campo existir
 * precisam poder ser classificadas sem recriar nada.
 */
export function EtapaOrcamentoSelect({
  compraId,
  etapaAtual,
  etapas,
}: {
  compraId: string;
  etapaAtual: string | null;
  etapas: string[];
}) {
  const [pending, startTransition] = useTransition();
  const [valor, setValor] = useOptimistic(etapaAtual ?? "");
  const router = useRouter();

  function handleChange(evento: React.ChangeEvent<HTMLSelectElement>) {
    const escolhida = evento.target.value;

    startTransition(async () => {
      setValor(escolhida);
      try {
        await definirEtapaOrcamento(compraId, escolhida);
      } catch (erro) {
        alert(erro instanceof Error ? erro.message : "Não foi possível vincular a etapa.");
      }
      router.refresh();
    });
  }

  if (!etapas.length) {
    return (
      <p className="text-sm text-muted-foreground">
        {etapaAtual ?? "Essa obra não tem orçamento ativo com etapas."}
      </p>
    );
  }

  return (
    <select
      value={valor}
      onChange={handleChange}
      disabled={pending}
      aria-label="Etapa do orçamento"
      className={
        valor
          ? "h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm disabled:opacity-60"
          : "h-8 w-full rounded-lg border border-dashed border-input bg-transparent px-2 text-sm text-muted-foreground disabled:opacity-60"
      }
    >
      <option value="">Não vinculada</option>
      {etapas.map((etapa) => (
        <option key={etapa} value={etapa}>
          {etapa}
        </option>
      ))}
    </select>
  );
}
