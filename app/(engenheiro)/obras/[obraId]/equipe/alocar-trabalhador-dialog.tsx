"use client";

import { useActionState, useEffect, useRef, useState } from "react";
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
import { alocarTrabalhadorNaObra, type AlocacaoFormState } from "@/app/actions/trabalhadores";

const initialState: AlocacaoFormState = { error: null };

type Trabalhador = { id: string; nome: string; funcao: string | null; valor_diaria_padrao: number | null };

export function AlocarTrabalhadorDialog({
  obraId,
  trabalhadoresDisponiveis,
}: {
  obraId: string;
  trabalhadoresDisponiveis: Trabalhador[];
}) {
  const [open, setOpen] = useState(false);
  const valorInputRef = useRef<HTMLInputElement>(null);
  const action = alocarTrabalhadorNaObra.bind(null, obraId);
  const [state, formAction, pending] = useActionState(action, initialState);

  useEffect(() => {
    if (state.success) setOpen(false);
  }, [state.success]);

  function handleTrabalhadorChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const selected = trabalhadoresDisponiveis.find((t) => t.id === e.target.value);
    if (selected?.valor_diaria_padrao && valorInputRef.current) {
      valorInputRef.current.value = String(selected.valor_diaria_padrao);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button disabled={!trabalhadoresDisponiveis.length}>Alocar trabalhador</Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Alocar trabalhador nessa obra</DialogTitle>
        </DialogHeader>
        <form action={formAction}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="trabalhador_id">Trabalhador</FieldLabel>
              <select
                id="trabalhador_id"
                name="trabalhador_id"
                required
                onChange={handleTrabalhadorChange}
                className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
              >
                <option value="">Selecione...</option>
                {trabalhadoresDisponiveis.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nome} {t.funcao ? `— ${t.funcao}` : ""}
                  </option>
                ))}
              </select>
            </Field>
            <Field>
              <FieldLabel htmlFor="valor_diaria">Diária nessa obra (R$)</FieldLabel>
              <Input
                ref={valorInputRef}
                id="valor_diaria"
                name="valor_diaria"
                type="number"
                step="0.01"
                min="0"
                required
              />
            </Field>
            {state.error && <FieldError>{state.error}</FieldError>}
            <Button type="submit" disabled={pending}>
              {pending ? "Alocando..." : "Alocar"}
            </Button>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
