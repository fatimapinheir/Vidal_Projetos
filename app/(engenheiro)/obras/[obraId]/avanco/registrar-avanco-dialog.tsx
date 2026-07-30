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
import { registrarAvanco, type AvancoFormState } from "@/app/actions/avanco";

const initialState: AvancoFormState = { error: null };

type ItemOrcamento = { id: string; descricao: string; unidade: string; quantidade: number };

export function RegistrarAvancoDialog({
  obraId,
  itens,
}: {
  obraId: string;
  itens: ItemOrcamento[];
}) {
  const [open, setOpen] = useState(false);
  const action = registrarAvanco.bind(null, obraId);
  const [state, formAction, pending] = useActionState(action, initialState);

  useEffect(() => {
    if (state.success) setOpen(false);
  }, [state.success]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button disabled={!itens.length}>Registrar avanço</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar avanço físico</DialogTitle>
        </DialogHeader>
        <form action={formAction}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="orcamento_item_id">Item do orçamento</FieldLabel>
              <select
                id="orcamento_item_id"
                name="orcamento_item_id"
                required
                className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
              >
                <option value="">Selecione...</option>
                {itens.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.descricao} ({item.unidade}) — orçado: {item.quantidade}
                  </option>
                ))}
              </select>
            </Field>
            <Field orientation="responsive">
              <div className="w-full">
                <FieldLabel htmlFor="quantidade_executada_acumulada">
                  Quantidade executada (acumulada)
                </FieldLabel>
                <Input
                  id="quantidade_executada_acumulada"
                  name="quantidade_executada_acumulada"
                  type="number"
                  step="0.01"
                  min="0"
                  required
                />
              </div>
              <div className="w-full">
                <FieldLabel htmlFor="data_medicao">Data da medição</FieldLabel>
                <Input
                  id="data_medicao"
                  name="data_medicao"
                  type="date"
                  defaultValue={new Date().toISOString().slice(0, 10)}
                  required
                />
              </div>
            </Field>
            <Field>
              <FieldLabel htmlFor="observacoes">Observações</FieldLabel>
              <Textarea id="observacoes" name="observacoes" rows={2} />
            </Field>
            {state.error && <FieldError>{state.error}</FieldError>}
            <Button type="submit" disabled={pending}>
              {pending ? "Salvando..." : "Registrar"}
            </Button>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
