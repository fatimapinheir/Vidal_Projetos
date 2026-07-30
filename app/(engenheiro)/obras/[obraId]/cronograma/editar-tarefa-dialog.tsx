"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldContent,
  FieldGroup,
  FieldLabel,
  FieldDescription,
  FieldError,
  FieldSeparator,
} from "@/components/ui/field";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Trash2 } from "lucide-react";
import {
  atualizarTarefa,
  adicionarDependencia,
  removerDependencia,
  type CronogramaFormState,
} from "@/app/actions/cronograma";
import type { DependenciaTipo } from "@/lib/types/database.types";

const initialState: CronogramaFormState = { error: null };

const tipoLabel: Record<DependenciaTipo, string> = {
  termino_inicio: "Término → Início",
  inicio_inicio: "Início → Início",
  termino_termino: "Término → Término",
  inicio_termino: "Início → Término",
};

type Tarefa = {
  id: string;
  nome: string;
  duracao_dias: number;
  restricao_inicio_nao_antes_de: string | null;
  data_inicio_real: string | null;
  data_fim_real: string | null;
  lembrete_dias_antes: number | null;
};

type DependenciaAtual = {
  id: string;
  predecessoraNome: string;
  tipo: DependenciaTipo;
  lagDias: number;
};

export function EditarTarefaDialog({
  obraId,
  tarefa,
  outrasTarefas,
  dependenciasAtuais,
}: {
  obraId: string;
  tarefa: Tarefa;
  outrasTarefas: { id: string; nome: string }[];
  dependenciasAtuais: DependenciaAtual[];
}) {
  const [open, setOpen] = useState(false);
  const [lembreteAtivo, setLembreteAtivo] = useState(tarefa.lembrete_dias_antes !== null);
  const router = useRouter();

  useEffect(() => {
    if (open) setLembreteAtivo(tarefa.lembrete_dias_antes !== null);
  }, [open, tarefa.lembrete_dias_antes]);

  const atualizarAction = atualizarTarefa.bind(null, obraId, tarefa.id);
  const [atualizarState, atualizarFormAction, atualizarPending] = useActionState(
    atualizarAction,
    initialState
  );

  const dependenciaAction = adicionarDependencia.bind(null, obraId);
  const [depState, depFormAction, depPending] = useActionState(dependenciaAction, initialState);

  useEffect(() => {
    if (atualizarState.success) router.refresh();
  }, [atualizarState.success, router]);

  useEffect(() => {
    if (depState.success) router.refresh();
  }, [depState.success, router]);

  function handleRemoverDependencia(dependenciaId: string) {
    removerDependencia(obraId, dependenciaId).then(() => router.refresh());
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm">Editar</Button>} />
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{tarefa.nome}</DialogTitle>
        </DialogHeader>

        <form action={atualizarFormAction}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="duracao_dias">Duração (dias)</FieldLabel>
              <Input
                id="duracao_dias"
                name="duracao_dias"
                type="number"
                min="1"
                step="1"
                defaultValue={tarefa.duracao_dias}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="restricao_inicio_nao_antes_de">Início não antes de</FieldLabel>
              <Input
                id="restricao_inicio_nao_antes_de"
                name="restricao_inicio_nao_antes_de"
                type="date"
                defaultValue={tarefa.restricao_inicio_nao_antes_de ?? ""}
              />
            </Field>
            <Field orientation="responsive">
              <div className="w-full">
                <FieldLabel htmlFor="data_inicio_real">Início real</FieldLabel>
                <Input
                  id="data_inicio_real"
                  name="data_inicio_real"
                  type="date"
                  defaultValue={tarefa.data_inicio_real ?? ""}
                />
              </div>
              <div className="w-full">
                <FieldLabel htmlFor="data_fim_real">Fim real</FieldLabel>
                <Input
                  id="data_fim_real"
                  name="data_fim_real"
                  type="date"
                  defaultValue={tarefa.data_fim_real ?? ""}
                />
              </div>
            </Field>
            <FieldDescription>
              Preencher o fim real atualiza automaticamente as datas das tarefas que dependem desta.
            </FieldDescription>

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
                  Avisa dentro do sistema alguns dias antes do início — útil pra agendar
                  fornecedor ou equipamento com antecedência.
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
                  defaultValue={tarefa.lembrete_dias_antes ?? 15}
                  required
                />
              </Field>
            )}

            {atualizarState.error && <FieldError>{atualizarState.error}</FieldError>}
            <Button type="submit" disabled={atualizarPending}>
              {atualizarPending ? "Salvando..." : "Salvar"}
            </Button>
          </FieldGroup>
        </form>

        <FieldSeparator>Predecessoras</FieldSeparator>

        <div className="flex flex-col gap-2">
          {dependenciasAtuais.map((dep) => (
            <div key={dep.id} className="flex items-center justify-between rounded-lg border p-2 text-sm">
              <span>
                {dep.predecessoraNome} <Badge variant="outline">{tipoLabel[dep.tipo]}</Badge>
                {dep.lagDias !== 0 && (
                  <span className="ml-1 text-muted-foreground">
                    ({dep.lagDias > 0 ? "+" : ""}
                    {dep.lagDias}d)
                  </span>
                )}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => handleRemoverDependencia(dep.id)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
          {!dependenciasAtuais.length && (
            <p className="text-sm text-muted-foreground">
              Nenhuma predecessora — essa tarefa usa a data "início não antes de" como âncora.
            </p>
          )}
        </div>

        {!!outrasTarefas.length && (
          <form action={depFormAction}>
            <input type="hidden" name="sucessora_id" value={tarefa.id} readOnly />
            <FieldGroup>
              <Field orientation="responsive">
                <div className="w-full">
                  <FieldLabel htmlFor="predecessora_id">Adicionar predecessora</FieldLabel>
                  <select
                    id="predecessora_id"
                    name="predecessora_id"
                    required
                    className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                  >
                    <option value="">Selecione...</option>
                    {outrasTarefas.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.nome}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="w-full">
                  <FieldLabel htmlFor="tipo">Tipo</FieldLabel>
                  <select
                    id="tipo"
                    name="tipo"
                    defaultValue="termino_inicio"
                    className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                  >
                    {(Object.keys(tipoLabel) as DependenciaTipo[]).map((tipo) => (
                      <option key={tipo} value={tipo}>
                        {tipoLabel[tipo]}
                      </option>
                    ))}
                  </select>
                </div>
              </Field>
              <Field>
                <FieldLabel htmlFor="lag_dias">Margem — lag (dias, pode ser negativo)</FieldLabel>
                <Input id="lag_dias" name="lag_dias" type="number" step="1" defaultValue="0" />
              </Field>
              {depState.error && <FieldError>{depState.error}</FieldError>}
              <Button type="submit" variant="outline" disabled={depPending}>
                {depPending ? "Adicionando..." : "Adicionar predecessora"}
              </Button>
            </FieldGroup>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
