"use client";

import { useRef } from "react";
import { useFormularioDeDialogo } from "@/lib/hooks/usar-formulario-de-dialogo";
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
  const valorInputRef = useRef<HTMLInputElement>(null);
  const action = alocarTrabalhadorNaObra.bind(null, obraId);
  const { aberto, mudarAberto, enviar, erro, enviando } = useFormularioDeDialogo({
    acao: action,
    estadoInicial: initialState
  });

  function handleTrabalhadorChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const selected = trabalhadoresDisponiveis.find((t) => t.id === e.target.value);
    if (selected?.valor_diaria_padrao && valorInputRef.current) {
      valorInputRef.current.value = String(selected.valor_diaria_padrao);
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={mudarAberto}>
      <DialogTrigger
        render={
          <Button disabled={!trabalhadoresDisponiveis.length}>Alocar trabalhador</Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Alocar trabalhador nessa obra</DialogTitle>
        </DialogHeader>
        <form action={enviar}>
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
            {erro && <FieldError>{erro}</FieldError>}
            <Button type="submit" disabled={enviando}>
              {enviando ? "Alocando..." : "Alocar"}
            </Button>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
