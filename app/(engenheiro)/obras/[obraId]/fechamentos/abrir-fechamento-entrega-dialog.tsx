"use client";

import { useState } from "react";
import { useFormularioDeDialogo } from "@/lib/hooks/usar-formulario-de-dialogo";
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
import { abrirFechamentoEntrega, type FechamentoEntregaFormState } from "@/app/actions/fechamentos";

const initialState: FechamentoEntregaFormState = { error: null };

type Equipe = { id: string; nome: string; unidade_medida: string | null; valor_unidade: number | null };

export function AbrirFechamentoEntregaDialog({
  obraId,
  equipes,
}: {
  obraId: string;
  equipes: Equipe[];
}) {
  const [equipeId, setEquipeId] = useState("");
  const action = abrirFechamentoEntrega.bind(null, obraId, equipeId);
  const { aberto, mudarAberto, enviar, erro, enviando } = useFormularioDeDialogo({
    acao: action,
    estadoInicial: initialState
  });

  const equipeSelecionada = equipes.find((eq) => eq.id === equipeId);

  return (
    <Dialog open={aberto} onOpenChange={mudarAberto}>
      <DialogTrigger
        render={<Button variant="outline" disabled={!equipes.length}>Fechar por entrega</Button>}
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Fechar pagamento por entrega (empreitada)</DialogTitle>
        </DialogHeader>
        <form action={enviar}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="equipe_id">Equipe</FieldLabel>
              <select
                id="equipe_id"
                value={equipeId}
                onChange={(e) => setEquipeId(e.target.value)}
                required
                className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
              >
                <option value="">Selecione...</option>
                {equipes.map((eq) => (
                  <option key={eq.id} value={eq.id}>
                    {eq.nome} ({eq.unidade_medida} a{" "}
                    {(eq.valor_unidade ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })})
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
            <Field>
              <FieldLabel htmlFor="quantidade_entregue">
                Quantidade entregue no período{equipeSelecionada ? ` (${equipeSelecionada.unidade_medida})` : ""}
              </FieldLabel>
              <Input
                id="quantidade_entregue"
                name="quantidade_entregue"
                type="number"
                step="0.01"
                min="0"
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="observacoes">Observações (opcional)</FieldLabel>
              <Textarea id="observacoes" name="observacoes" rows={2} />
            </Field>
            {erro && <FieldError>{erro}</FieldError>}
            <Button type="submit" disabled={enviando || !equipeId}>
              {enviando ? "Calculando..." : "Fechar por entrega"}
            </Button>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
