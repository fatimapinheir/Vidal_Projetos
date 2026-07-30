"use client";

import { useActionState, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldGroup, FieldLabel, FieldDescription, FieldError } from "@/components/ui/field";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { criarFolga, type CronogramaFormState } from "@/app/actions/cronograma";

const initialState: CronogramaFormState = { error: null };

export function NovaFolgaDialog({ obraId }: { obraId: string }) {
  const [open, setOpen] = useState(false);
  const action = criarFolga.bind(null, obraId);
  const [state, formAction, pending] = useActionState(action, initialState);

  useEffect(() => {
    if (state.success) setOpen(false);
  }, [state.success]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline">Registrar intervalo</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar intervalo de folga</DialogTitle>
        </DialogHeader>
        <form action={formAction}>
          <FieldGroup>
            <Field orientation="responsive">
              <div className="w-full">
                <FieldLabel htmlFor="data_inicio">Data (início)</FieldLabel>
                <Input id="data_inicio" name="data_inicio" type="date" required />
              </div>
              <div className="w-full">
                <FieldLabel htmlFor="data_fim">Até (opcional)</FieldLabel>
                <Input id="data_fim" name="data_fim" type="date" />
              </div>
            </Field>
            <FieldDescription>
              Use isso para períodos maiores (uma semana de chuva, um recesso). Para um único dia,
              é mais rápido clicar direto no calendário abaixo.
            </FieldDescription>
            <Field>
              <FieldLabel htmlFor="descricao">Motivo (opcional)</FieldLabel>
              <Input id="descricao" name="descricao" placeholder="Chuva, feriado local, etc." />
            </Field>
            {state.error && <FieldError>{state.error}</FieldError>}
            <Button type="submit" disabled={pending}>
              {pending ? "Registrando..." : "Registrar folga"}
            </Button>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
