"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldGroup, FieldLabel, FieldDescription, FieldError } from "@/components/ui/field";
import { salvarDiario, type DiarioFormState } from "@/app/actions/diario";
import type { DiarioClima } from "@/lib/types/database.types";

const initialState: DiarioFormState = { error: null };

const periodos = [
  { campo: "clima_manha", label: "Manhã" },
  { campo: "clima_tarde", label: "Tarde" },
  { campo: "clima_noite", label: "Noite" },
] as const;

const opcoesClima: { valor: DiarioClima | ""; label: string }[] = [
  { valor: "", label: "—" },
  { valor: "praticavel", label: "Praticável" },
  { valor: "chuva", label: "Chuva" },
  { valor: "impraticavel", label: "Impraticável" },
];

export type DiarioValores = {
  clima_manha: DiarioClima | null;
  clima_tarde: DiarioClima | null;
  clima_noite: DiarioClima | null;
  atividades: string | null;
  ocorrencias: string | null;
  visitas: string | null;
};

export function DiarioForm({
  obraId,
  data,
  valores,
  somenteLeitura,
}: {
  obraId: string;
  data: string;
  valores: DiarioValores | null;
  somenteLeitura: boolean;
}) {
  const action = salvarDiario.bind(null, obraId, data);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction}>
      <FieldGroup>
        <Field>
          <FieldLabel>Condições do tempo</FieldLabel>
          <div className="grid gap-3 sm:grid-cols-3">
            {periodos.map((periodo) => (
              <div key={periodo.campo}>
                <FieldLabel htmlFor={periodo.campo} className="text-xs text-muted-foreground">
                  {periodo.label}
                </FieldLabel>
                <select
                  id={periodo.campo}
                  name={periodo.campo}
                  defaultValue={valores?.[periodo.campo] ?? ""}
                  disabled={somenteLeitura}
                  className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm disabled:opacity-70"
                >
                  {opcoesClima.map((opcao) => (
                    <option key={opcao.valor} value={opcao.valor}>
                      {opcao.label}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <FieldDescription>
            &quot;Impraticável&quot; é o registro que justifica parada por chuva numa discussão de
            prazo — vale marcar mesmo quando parece óbvio.
          </FieldDescription>
        </Field>

        <Field>
          <FieldLabel htmlFor="atividades">Atividades executadas</FieldLabel>
          <Textarea
            id="atividades"
            name="atividades"
            rows={4}
            defaultValue={valores?.atividades ?? ""}
            disabled={somenteLeitura}
            placeholder="O que foi feito hoje, em que frente, por qual equipe..."
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="ocorrencias">Ocorrências</FieldLabel>
          <Textarea
            id="ocorrencias"
            name="ocorrencias"
            rows={3}
            defaultValue={valores?.ocorrencias ?? ""}
            disabled={somenteLeitura}
            placeholder="Falta de material, paralisação, acidente, atraso de fornecedor..."
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="visitas">Visitas</FieldLabel>
          <Textarea
            id="visitas"
            name="visitas"
            rows={2}
            defaultValue={valores?.visitas ?? ""}
            disabled={somenteLeitura}
            placeholder="Fiscal, cliente, órgão, fornecedor..."
          />
        </Field>

        {state.error && <FieldError>{state.error}</FieldError>}

        {!somenteLeitura && (
          <Button type="submit" disabled={pending}>
            {pending ? "Salvando..." : "Salvar diário"}
          </Button>
        )}
      </FieldGroup>
    </form>
  );
}
