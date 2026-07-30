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
import { abrirFechamentoEquipeDiaria, type FechamentoEquipeFormState } from "@/app/actions/fechamentos";

const initialState: FechamentoEquipeFormState = { error: null };

export function AbrirFechamentoEquipeDialog({
  obraId,
  equipes,
}: {
  obraId: string;
  equipes: { id: string; nome: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [equipeId, setEquipeId] = useState("");
  const action = abrirFechamentoEquipeDiaria.bind(null, obraId, equipeId);
  const [state, formAction, pending] = useActionState(action, initialState);

  useEffect(() => {
    if (state.success) setOpen(false);
  }, [state.success]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button disabled={!equipes.length}>Fechar equipe (diária)</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Fechar equipe por período (diária)</DialogTitle>
        </DialogHeader>
        <form action={formAction}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="equipe_id">Equipe</FieldLabel>
              <select
                id="equipe_id"
                value={equipeId}
                onChange={(e) => setEquipeId(e.target.value)}
                required
                className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
              >
                <option value="">Selecione...</option>
                {equipes.map((eq) => (
                  <option key={eq.id} value={eq.id}>
                    {eq.nome}
                  </option>
                ))}
              </select>
            </Field>
            <Field orientation="responsive">
              <div className="w-full">
                <FieldLabel htmlFor="periodo_inicio">Início do período</FieldLabel>
                <Input id="periodo_inicio" name="periodo_inicio" type="date" required />
              </div>
              <div className="w-full">
                <FieldLabel htmlFor="periodo_fim">Fim do período</FieldLabel>
                <Input id="periodo_fim" name="periodo_fim" type="date" required />
              </div>
            </Field>
            {state.error && <FieldError>{state.error}</FieldError>}
            <Button type="submit" disabled={pending || !equipeId}>
              {pending ? "Calculando..." : "Fechar equipe"}
            </Button>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
