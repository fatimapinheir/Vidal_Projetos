"use client";

import { useActionState, useState } from "react";
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
import { criarRascunho, type CriarRascunhoState } from "@/app/actions/orcamento";

const initialState: CriarRascunhoState = { error: null };

export function CriarRascunhoDialog({
  obraId,
  temAtiva,
  label,
}: {
  obraId: string;
  temAtiva: boolean;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const action = criarRascunho.bind(null, obraId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant={temAtiva ? "outline" : "default"}>{label}</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
        </DialogHeader>
        <form action={formAction}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="titulo">Título (opcional)</FieldLabel>
              <Input id="titulo" name="titulo" placeholder="Ex: Orçamento inicial" />
            </Field>
            {temAtiva && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="copiar_da_ativa" />
                Começar copiando os itens do orçamento ativo atual
              </label>
            )}
            {state.error && <FieldError>{state.error}</FieldError>}
            <Button type="submit" disabled={pending}>
              {pending ? "Criando..." : "Criar rascunho"}
            </Button>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
