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
import { criarEtapa, type CronogramaFormState } from "@/app/actions/cronograma";

const initialState: CronogramaFormState = { error: null };

export function NovaEtapaDialog({ obraId }: { obraId: string }) {
  const [open, setOpen] = useState(false);
  const action = criarEtapa.bind(null, obraId);
  const [state, formAction, pending] = useActionState(action, initialState);

  useEffect(() => {
    if (state.success) setOpen(false);
  }, [state.success]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>Nova etapa</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova etapa</DialogTitle>
        </DialogHeader>
        <form action={formAction}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="nome">Nome da etapa</FieldLabel>
              <Input id="nome" name="nome" placeholder="Fundação" required />
            </Field>
            {state.error && <FieldError>{state.error}</FieldError>}
            <Button type="submit" disabled={pending}>
              {pending ? "Criando..." : "Criar etapa"}
            </Button>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
