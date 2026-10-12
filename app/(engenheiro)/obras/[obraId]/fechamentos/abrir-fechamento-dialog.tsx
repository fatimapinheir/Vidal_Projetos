"use client";

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
import { abrirFechamento, type FechamentoFormState } from "@/app/actions/fechamentos";

const initialState: FechamentoFormState = { error: null };

export function AbrirFechamentoDialog({
  obraId,
  trabalhadores,
}: {
  obraId: string;
  trabalhadores: { id: string; nome: string }[];
}) {
  const action = abrirFechamento.bind(null, obraId);
  const { aberto, mudarAberto, enviar, erro, enviando } = useFormularioDeDialogo({
    acao: action,
    estadoInicial: initialState
  });

  return (
    <Dialog open={aberto} onOpenChange={mudarAberto}>
      <DialogTrigger render={<Button disabled={!trabalhadores.length}>Novo fechamento</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Abrir fechamento de período</DialogTitle>
        </DialogHeader>
        <form action={enviar}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="trabalhador_id">Trabalhador</FieldLabel>
              <select
                id="trabalhador_id"
                name="trabalhador_id"
                required
                className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
              >
                <option value="">Selecione...</option>
                {trabalhadores.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nome}
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
            {erro && <FieldError>{erro}</FieldError>}
            <Button type="submit" disabled={enviando}>
              {enviando ? "Calculando..." : "Abrir fechamento"}
            </Button>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
