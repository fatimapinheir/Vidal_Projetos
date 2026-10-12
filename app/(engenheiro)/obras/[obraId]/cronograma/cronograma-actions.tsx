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
    startTransition(async () => {
      await removerEtapa(obraId, etapaId);
      router.refresh();
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
    startTransition(async () => {
      await fixarLinhaDeBase(obraId);
      router.refresh();
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

  /*
   * O `await` fica DENTRO da transição, e não num `.then` pendurado.
   *
   * Com `.then`, o callback da transição devolvia `undefined` e o React a
   * encerrava na hora; o `router.refresh()` disparava depois, fora de qualquer
   * transição, e às vezes era descartado — a linha excluída continuava na tela
   * até recarregar a página na mão. Com callback assíncrono a transição só
   * termina depois do refresh.
   */
  function handleClick() {
    if (!confirm("Remover essa tarefa?")) return;
    startTransition(async () => {
      const resultado = await removerTarefa(obraId, tarefaId);
      if (resultado?.error) alert(resultado.error);
      router.refresh();
    });
  }

  return (
    <Button onClick={handleClick} disabled={pending} variant="ghost" size="icon-sm">
      <Trash2 className="size-4" />
    </Button>
  );
}
