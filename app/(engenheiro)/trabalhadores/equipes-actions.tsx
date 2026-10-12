"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { desativarEquipe } from "@/app/actions/equipes";

export function DesativarEquipeButton({ equipeId }: { equipeId: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick() {
    if (
      !confirm(
        "Desativar essa equipe? Ela some da lista e das obras, mas os fechamentos já feitos com ela continuam intactos."
      )
    )
      return;
    startTransition(() => {
      desativarEquipe(equipeId).then(() => router.refresh());
    });
  }

  return (
    <Button onClick={handleClick} disabled={pending} variant="ghost" size="sm">
      {pending ? "Desativando..." : "Desativar"}
    </Button>
  );
}
