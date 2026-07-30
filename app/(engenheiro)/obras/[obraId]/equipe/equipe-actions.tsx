"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { desativarEquipe } from "@/app/actions/equipes";

export function DesativarEquipeButton({ obraId, equipeId }: { obraId: string; equipeId: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick() {
    if (!confirm("Desativar essa equipe? Ela deixa de aparecer para novos fechamentos.")) return;
    startTransition(() => {
      desativarEquipe(obraId, equipeId).then(() => router.refresh());
    });
  }

  return (
    <Button onClick={handleClick} disabled={pending} variant="ghost" size="sm">
      {pending ? "Desativando..." : "Desativar"}
    </Button>
  );
}
