"use client";

import { useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Check, CheckCheck } from "lucide-react";
import { registrarAvancoTarefa, concluirEtapa } from "@/app/actions/avanco";

/**
 * Percentual de uma tarefa, editado na própria linha.
 *
 * Sem diálogo e sem select de tarefa: o cronograma desta obra tem 136 tarefas,
 * e escolher uma numa lista dessas antes de digitar um número era o atrito que
 * fazia o avanço nunca ser registrado. Aqui o engenheiro percorre a tela e
 * digita.
 *
 * Salva ao sair do campo (ou no Enter), e `useOptimistic` mostra o valor novo
 * na hora: o número verdadeiro é o do servidor, e quando o refresh chega o
 * campo volta a segui-lo sozinho — inclusive quando quem mudou foi o botão de
 * concluir a etapa inteira.
 */
export function PercentualTarefa({
  obraId,
  tarefaId,
  percentual,
  dataMedicao,
}: {
  obraId: string;
  tarefaId: string;
  percentual: number;
  dataMedicao: string;
}) {
  const [pending, startTransition] = useTransition();
  const [valor, setValor] = useOptimistic(percentual);
  const [erro, setErro] = useState<string | null>(null);
  const router = useRouter();

  function salvar(novo: number) {
    if (novo === percentual) return;

    startTransition(async () => {
      setValor(novo);
      setErro(null);
      const resultado = await registrarAvancoTarefa(obraId, {
        tarefaId,
        percentual: novo,
        dataMedicao,
      });
      if (resultado.error) setErro(resultado.error);
      router.refresh();
    });
  }

  function handleBlur(evento: React.FocusEvent<HTMLInputElement>) {
    const bruto = Number(evento.target.value);
    if (Number.isNaN(bruto)) return;
    salvar(Math.min(100, Math.max(0, Math.round(bruto))));
  }

  return (
    <div className="flex items-center gap-1">
      <input
        type="number"
        min={0}
        max={100}
        step={5}
        value={valor}
        disabled={pending}
        aria-label="Percentual executado"
        aria-invalid={!!erro}
        title={erro ?? undefined}
        onChange={(e) => setValor(Number(e.target.value))}
        onBlur={handleBlur}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        className={`h-8 w-16 rounded-lg border bg-transparent px-2 text-right text-sm tabular-nums disabled:opacity-60 ${
          erro ? "border-destructive" : "border-input"
        }`}
      />
      <span className="text-xs text-muted-foreground">%</span>
      {valor < 100 && (
        <Button
          onClick={() => salvar(100)}
          disabled={pending}
          variant="ghost"
          size="icon-sm"
          aria-label="Marcar como concluída"
          title="Marcar como concluída (100%)"
        >
          <Check className="size-4" />
        </Button>
      )}
    </div>
  );
}

/** Põe em 100% todas as tarefas da etapa que ainda não estão lá. */
export function ConcluirEtapaButton({
  obraId,
  etapaId,
  quantas,
  dataMedicao,
}: {
  obraId: string;
  etapaId: string;
  quantas: number;
  dataMedicao: string;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick() {
    if (!confirm(`Marcar ${quantas} tarefa(s) desta etapa como 100% concluídas?`)) return;

    startTransition(async () => {
      const resultado = await concluirEtapa(obraId, etapaId, dataMedicao);
      if (resultado.error) alert(resultado.error);
      router.refresh();
    });
  }

  return (
    <Button onClick={handleClick} disabled={pending} variant="outline" size="sm">
      <CheckCheck className="size-4" />
      {pending ? "Concluindo..." : "Concluir etapa"}
    </Button>
  );
}
