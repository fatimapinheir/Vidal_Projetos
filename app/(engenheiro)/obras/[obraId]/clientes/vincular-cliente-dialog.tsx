"use client";

import { useActionState, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldGroup, FieldLabel, FieldError, FieldDescription } from "@/components/ui/field";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { vincularCliente, type VincularClienteState } from "@/app/actions/obra-clientes";

const initialState: VincularClienteState = { error: null };

export function VincularClienteDialog({ obraId }: { obraId: string }) {
  const [open, setOpen] = useState(false);
  const action = vincularCliente.bind(null, obraId);
  const [state, formAction, pending] = useActionState(action, initialState);

  useEffect(() => {
    if (state.success) setOpen(false);
  }, [state.success]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>Vincular cliente</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Vincular cliente à obra</DialogTitle>
        </DialogHeader>
        <form action={formAction}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="email">Email do cliente</FieldLabel>
              <Input id="email" name="email" type="email" required />
              <FieldDescription>
                Se já existir uma conta com esse email, apenas vinculamos. Senão, criamos a
                conta e enviamos um link para o cliente definir a senha.
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="nome">Nome (se for um cliente novo)</FieldLabel>
              <Input id="nome" name="nome" />
            </Field>
            {state.error && <FieldError>{state.error}</FieldError>}
            <Button type="submit" disabled={pending}>
              {pending ? "Vinculando..." : "Vincular"}
            </Button>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
