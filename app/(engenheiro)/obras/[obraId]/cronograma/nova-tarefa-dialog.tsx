"use client";

import { useActionState, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldContent,
  FieldGroup,
  FieldLabel,
  FieldDescription,
  FieldError,
} from "@/components/ui/field";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { criarTarefa, type CronogramaFormState } from "@/app/actions/cronograma";

const initialState: CronogramaFormState = { error: null };

export function NovaTarefaDialog({
  obraId,
  etapaId,
  itensOrcamento,
  ultimaTarefaNome,
}: {
  obraId: string;
  etapaId: string;
  itensOrcamento: { id: string; descricao: string }[];
  /** Nome da última tarefa cadastrada na obra (qualquer etapa) — null se essa for a primeira. */
  ultimaTarefaNome: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [dependeDaAnterior, setDependeDaAnterior] = useState(!!ultimaTarefaNome);
  const [lembreteAtivo, setLembreteAtivo] = useState(false);
  const action = criarTarefa.bind(null, obraId, etapaId);
  const [state, formAction, pending] = useActionState(action, initialState);

  useEffect(() => {
    if (state.success) setOpen(false);
  }, [state.success]);

  // Reidrata o padrão toda vez que o diálogo abre — evita ficar com o valor
  // inicial "congelado" de quando o componente montou (ex: obra sem nenhuma
  // tarefa ainda, e depois a primeira tarefa foi criada).
  useEffect(() => {
    if (open) {
      setDependeDaAnterior(!!ultimaTarefaNome);
      setLembreteAtivo(false);
    }
  }, [open, ultimaTarefaNome]);

  const precisaDeAncora = !ultimaTarefaNome || !dependeDaAnterior;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm">Nova tarefa</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova tarefa</DialogTitle>
        </DialogHeader>
        <form action={formAction}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="nome">Nome da tarefa</FieldLabel>
              <Input id="nome" name="nome" placeholder="Escavação e sapatas" required />
            </Field>
            <Field>
              <FieldLabel htmlFor="duracao_dias">Duração (dias)</FieldLabel>
              <Input id="duracao_dias" name="duracao_dias" type="number" min="1" step="1" defaultValue="1" required />
            </Field>

            {ultimaTarefaNome && (
              <Field orientation="horizontal">
                <Checkbox
                  id="depende_da_anterior"
                  name="depende_da_anterior"
                  checked={dependeDaAnterior}
                  onCheckedChange={(checked) => setDependeDaAnterior(checked === true)}
                />
                <FieldContent>
                  <FieldLabel htmlFor="depende_da_anterior">
                    Iniciar automaticamente após &quot;{ultimaTarefaNome}&quot; terminar
                  </FieldLabel>
                  <FieldDescription>
                    Desmarque se essa tarefa roda em paralelo (não depende da anterior) — aí você
                    informa a data de início manualmente.
                  </FieldDescription>
                </FieldContent>
              </Field>
            )}

            {precisaDeAncora && (
              <Field>
                <FieldLabel htmlFor="restricao_inicio_nao_antes_de">Início</FieldLabel>
                <Input id="restricao_inicio_nao_antes_de" name="restricao_inicio_nao_antes_de" type="date" required />
                <FieldDescription>
                  {ultimaTarefaNome
                    ? "Data de início dessa tarefa (ela não depende de nenhuma outra)."
                    : "Data de início do cronograma — as próximas tarefas vão se encadear a partir daqui."}
                </FieldDescription>
              </Field>
            )}

            <Field orientation="horizontal">
              <Checkbox
                id="lembrete_ativo"
                name="lembrete_ativo"
                checked={lembreteAtivo}
                onCheckedChange={(checked) => setLembreteAtivo(checked === true)}
              />
              <FieldContent>
                <FieldLabel htmlFor="lembrete_ativo">Lembrete</FieldLabel>
                <FieldDescription>
                  Avisa dentro do sistema alguns dias antes do início — útil pra agendar fornecedor
                  ou equipamento com antecedência (ex: concretagem avisando 15 dias antes).
                </FieldDescription>
              </FieldContent>
            </Field>

            {lembreteAtivo && (
              <Field>
                <FieldLabel htmlFor="lembrete_dias_antes">Avisar quantos dias antes</FieldLabel>
                <Input
                  id="lembrete_dias_antes"
                  name="lembrete_dias_antes"
                  type="number"
                  min="1"
                  step="1"
                  defaultValue="15"
                  required
                />
              </Field>
            )}

            {!!itensOrcamento.length && (
              <Field>
                <FieldLabel htmlFor="orcamento_item_id">Item do planejamento (opcional)</FieldLabel>
                <select
                  id="orcamento_item_id"
                  name="orcamento_item_id"
                  className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
                >
                  <option value="">Nenhum</option>
                  {itensOrcamento.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.descricao}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            {state.error && <FieldError>{state.error}</FieldError>}
            <Button type="submit" disabled={pending}>
              {pending ? "Criando..." : "Criar tarefa"}
            </Button>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
