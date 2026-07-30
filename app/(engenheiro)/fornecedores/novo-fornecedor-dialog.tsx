"use client";

import { useActionState, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldGroup, FieldLabel, FieldError } from "@/components/ui/field";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createFornecedor, type FornecedorFormState } from "@/app/actions/fornecedores";

const initialState: FornecedorFormState = { error: null };

export function NovoFornecedorDialog() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createFornecedor, initialState);

  useEffect(() => {
    if (state.success) setOpen(false);
  }, [state.success]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>Novo fornecedor</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo fornecedor</DialogTitle>
        </DialogHeader>
        <form action={formAction}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="nome">Nome</FieldLabel>
              <Input id="nome" name="nome" required />
            </Field>
            <Field>
              <FieldLabel htmlFor="cnpj_cpf">CNPJ / CPF</FieldLabel>
              <Input id="cnpj_cpf" name="cnpj_cpf" />
            </Field>
            <Field>
              <FieldLabel htmlFor="telefone">Telefone</FieldLabel>
              <Input id="telefone" name="telefone" />
            </Field>
            <Field>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input id="email" name="email" type="email" />
            </Field>
            <Field>
              <FieldLabel htmlFor="observacoes">Observações</FieldLabel>
              <Textarea id="observacoes" name="observacoes" rows={3} />
            </Field>
            {state.error && <FieldError>{state.error}</FieldError>}
            <Button type="submit" disabled={pending}>
              {pending ? "Salvando..." : "Salvar fornecedor"}
            </Button>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
