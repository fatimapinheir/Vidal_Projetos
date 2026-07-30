"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Trash2, PackageCheck, Undo2 } from "lucide-react";
import { alternarDevolucao, removerLocacao } from "@/app/actions/locacoes";

export function DevolverButton({
  obraId,
  locacaoId,
  devolvido,
}: {
  obraId: string;
  locacaoId: string;
  devolvido: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick() {
    const mensagem = devolvido
      ? "Reabrir essa locação? A contagem do valor volta a correr a partir de hoje."
      : "Marcar como devolvido? A contagem financeira encerra hoje e o valor congela.";
    if (!confirm(mensagem)) return;
    startTransition(() => {
      alternarDevolucao(obraId, locacaoId).then(() => router.refresh());
    });
  }

  return (
    <Button
      onClick={handleClick}
      disabled={pending}
      variant={devolvido ? "ghost" : "outline"}
      size="sm"
    >
      {devolvido ? <Undo2 className="size-4" /> : <PackageCheck className="size-4" />}
      {devolvido ? "Reabrir" : "Devolver"}
    </Button>
  );
}

export function RemoverLocacaoButton({
  obraId,
  locacaoId,
}: {
  obraId: string;
  locacaoId: string;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick() {
    if (!confirm("Remover essa locação? O histórico dela some junto.")) return;
    startTransition(() => {
      removerLocacao(obraId, locacaoId).then(() => router.refresh());
    });
  }

  return (
    <Button onClick={handleClick} disabled={pending} variant="ghost" size="icon-sm">
      <Trash2 className="size-4" />
    </Button>
  );
}
