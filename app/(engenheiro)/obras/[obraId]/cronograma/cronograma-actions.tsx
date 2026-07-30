"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { removerEtapa, removerTarefa, fixarLinhaDeBase } from "@/app/actions/cronograma";

export function RemoverEtapaButton({ obraId, etapaId }: { obraId: string; etapaId: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick() {
    if (!confirm("Remover essa etapa e todas as tarefas dentro dela?")) return;
    startTransition(() => {
      removerEtapa(obraId, etapaId).then(() => router.refresh());
    });
  }

  return (
    <Button onClick={handleClick} disabled={pending} variant="ghost" size="sm">
      {pending ? "Removendo..." : "Remover etapa"}
    </Button>
  );
}

export function FixarLinhaDeBaseButton({ obraId }: { obraId: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick() {
    if (
      !confirm(
        "Fixar a linha de base agora? As datas atuais de todas as tarefas passam a ser a referência — o atraso de cada uma será medido a partir daqui. Só faça isso quando o cronograma estiver pronto."
      )
    )
      return;
    startTransition(() => {
      fixarLinhaDeBase(obraId).then(() => router.refresh());
    });
  }

  return (
    <Button onClick={handleClick} disabled={pending} variant="outline">
      {pending ? "Fixando..." : "Fixar linha de base"}
    </Button>
  );
}

export function RemoverTarefaButton({ obraId, tarefaId }: { obraId: string; tarefaId: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick() {
    if (!confirm("Remover essa tarefa?")) return;
    startTransition(() => {
      removerTarefa(obraId, tarefaId).then(() => router.refresh());
    });
  }

  return (
    <Button onClick={handleClick} disabled={pending} variant="ghost" size="icon-sm">
      <Trash2 className="size-4" />
    </Button>
  );
}
