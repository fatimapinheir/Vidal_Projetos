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
import { createTrabalhador, type TrabalhadorFormState } from "@/app/actions/trabalhadores";

const initialState: TrabalhadorFormState = { error: null };

export function NovoTrabalhadorDialog() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createTrabalhador, initialState);

  useEffect(() => {
    if (state.success) setOpen(false);
  }, [state.success]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>Novo trabalhador</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo trabalhador</DialogTitle>
        </DialogHeader>
        <form action={formAction}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="nome">Nome</FieldLabel>
              <Input id="nome" name="nome" required />
            </Field>
            <Field>
              <FieldLabel htmlFor="funcao">Função</FieldLabel>
              <Input id="funcao" name="funcao" placeholder="Pedreiro, servente, eletricista..." />
            </Field>
            <Field>
              <FieldLabel htmlFor="valor_diaria_padrao">Diária padrão (R$)</FieldLabel>
              <Input
                id="valor_diaria_padrao"
                name="valor_diaria_padrao"
                type="number"
                step="0.01"
                min="0"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="cpf">CPF</FieldLabel>
              <Input id="cpf" name="cpf" />
            </Field>
            <Field>
              <FieldLabel htmlFor="telefone">Telefone</FieldLabel>
              <Input id="telefone" name="telefone" />
            </Field>
            {state.error && <FieldError>{state.error}</FieldError>}
            <Button type="submit" disabled={pending}>
              {pending ? "Salvando..." : "Salvar trabalhador"}
            </Button>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
