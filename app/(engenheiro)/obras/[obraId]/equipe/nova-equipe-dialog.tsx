"use client";

import { useActionState, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldGroup, FieldLabel, FieldError } from "@/components/ui/field";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { criarEquipe, type EquipeFormState } from "@/app/actions/equipes";

const initialState: EquipeFormState = { error: null };

type Trabalhador = { id: string; nome: string; funcao: string | null };

export function NovaEquipeDialog({
  obraId,
  trabalhadoresAlocados,
}: {
  obraId: string;
  trabalhadoresAlocados: Trabalhador[];
}) {
  const [open, setOpen] = useState(false);
  const [tipoContrato, setTipoContrato] = useState<"diaria" | "empreitada">("diaria");
  const [membros, setMembros] = useState<Set<string>>(new Set());
  const action = criarEquipe.bind(null, obraId);
  const [state, formAction, pending] = useActionState(action, initialState);

  useEffect(() => {
    if (state.success) {
      setOpen(false);
      setMembros(new Set());
      setTipoContrato("diaria");
    }
  }, [state.success]);

  function toggleMembro(id: string) {
    setMembros((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const candidatosResponsavel = trabalhadoresAlocados.filter((t) => membros.has(t.id));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button disabled={!trabalhadoresAlocados.length}>Nova equipe</Button>}
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova equipe</DialogTitle>
        </DialogHeader>
        <form action={formAction}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="nome">Nome da equipe</FieldLabel>
              <Input id="nome" name="nome" placeholder="Equipe de alvenaria" required />
            </Field>

            <Field>
              <FieldLabel htmlFor="tipo_contrato">Tipo de contrato</FieldLabel>
              <select
                id="tipo_contrato"
                name="tipo_contrato"
                value={tipoContrato}
                onChange={(e) => setTipoContrato(e.target.value as "diaria" | "empreitada")}
                className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
              >
                <option value="diaria">Diária (por dias trabalhados)</option>
                <option value="empreitada">Empreitada (por entrega/metragem)</option>
              </select>
            </Field>

            {tipoContrato === "empreitada" && (
              <Field orientation="responsive">
                <div className="w-full">
                  <FieldLabel htmlFor="unidade_medida">Unidade de medida</FieldLabel>
                  <Input id="unidade_medida" name="unidade_medida" placeholder="m²" required />
                </div>
                <div className="w-full">
                  <FieldLabel htmlFor="valor_unidade">Valor por unidade (R$)</FieldLabel>
                  <Input
                    id="valor_unidade"
                    name="valor_unidade"
                    type="number"
                    step="0.01"
                    min="0"
                    required
                  />
                </div>
              </Field>
            )}

            <Field>
              <FieldLabel>Membros da equipe</FieldLabel>
              <div className="flex flex-col gap-1.5 rounded-lg border p-2.5">
                {trabalhadoresAlocados.map((t) => (
                  <label key={t.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="membros"
                      value={t.id}
                      checked={membros.has(t.id)}
                      onChange={() => toggleMembro(t.id)}
                    />
                    {t.nome}
                    {t.funcao ? ` — ${t.funcao}` : ""}
                  </label>
                ))}
                {!trabalhadoresAlocados.length && (
                  <p className="text-sm text-muted-foreground">
                    Nenhum trabalhador alocado nessa obra ainda.
                  </p>
                )}
              </div>
            </Field>

            <Field>
              <FieldLabel htmlFor="responsavel_id">Responsável (recebe o pagamento consolidado)</FieldLabel>
              <select
                id="responsavel_id"
                name="responsavel_id"
                required
                disabled={!candidatosResponsavel.length}
                className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
              >
                <option value="">Selecione...</option>
                {candidatosResponsavel.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nome}
                  </option>
                ))}
              </select>
            </Field>

            {state.error && <FieldError>{state.error}</FieldError>}
            <Button type="submit" disabled={pending}>
              {pending ? "Criando..." : "Criar equipe"}
            </Button>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
