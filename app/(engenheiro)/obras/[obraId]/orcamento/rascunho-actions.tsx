"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { ativarOrcamento, descartarRascunho, removerItemOrcamento } from "@/app/actions/orcamento";

export function AtivarOrcamentoButton({ obraId, versaoId }: { obraId: string; versaoId: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick() {
    startTransition(async () => {
      try {
        await ativarOrcamento(obraId, versaoId);
        toast.success("Orçamento ativado.");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao ativar.");
      }
    });
  }

  return (
    <Button onClick={handleClick} disabled={pending}>
      {pending ? "Ativando..." : "Ativar este orçamento"}
    </Button>
  );
}

export function DescartarRascunhoButton({ obraId, versaoId }: { obraId: string; versaoId: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick() {
    if (!confirm("Descartar este rascunho? Os itens adicionados serão perdidos.")) return;
    startTransition(async () => {
      await descartarRascunho(obraId, versaoId);
      router.refresh();
    });
  }

  return (
    <Button onClick={handleClick} disabled={pending} variant="ghost">
      {pending ? "Descartando..." : "Descartar rascunho"}
    </Button>
  );
}

export function RemoverItemButton({ obraId, itemId }: { obraId: string; itemId: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick() {
    startTransition(async () => {
      await removerItemOrcamento(obraId, itemId);
      router.refresh();
    });
  }

  return (
    <Button onClick={handleClick} disabled={pending} variant="ghost" size="icon-sm">
      <Trash2 className="size-4" />
    </Button>
  );
}
