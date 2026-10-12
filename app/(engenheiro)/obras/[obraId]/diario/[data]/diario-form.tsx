"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldGroup, FieldLabel, FieldDescription, FieldError } from "@/components/ui/field";
import { salvarDiario, type DiarioFormState } from "@/app/actions/diario";
import type { DiarioCondicao } from "@/lib/types/database.types";
import { CONDICOES } from "@/lib/diario/condicao";
import { Input } from "@/components/ui/input";

const initialState: DiarioFormState = { error: null };

const opcoesClima: { valor: DiarioCondicao | ""; label: string }[] = [
  { valor: "", label: "—" },
  ...CONDICOES,
];

export type DiarioValores = {
  clima: DiarioCondicao | null;
  atividades: string | null;
  ocorrencias: string | null;
  visitas: string | null;
  temperatura: number | null;
  umidade: number | null;
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
        {/*
          Um campo de clima, não três.
          
          Eram manhã, tarde e noite — e o resultado foi ninguém preencher
          nenhum. O relatório sempre imprimiu UMA linha de condição, resumindo
          os três pela pior; pedir três respostas para imprimir uma era custo
          sem contrapartida. Havendo virada no tempo, ela cabe em ocorrências,
          que é onde a narrativa do dia mora.
        */}
        <Field>
          <FieldLabel htmlFor="clima">Condição do tempo</FieldLabel>
          <select
            id="clima"
            name="clima"
            defaultValue={valores?.clima ?? ""}
            disabled={somenteLeitura}
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm disabled:opacity-70 sm:max-w-56"
          >
            {opcoesClima.map((opcao) => (
              <option key={opcao.valor} value={opcao.valor}>
                {opcao.label}
              </option>
            ))}
          </select>
          <FieldDescription>
            Como o dia foi, no geral. &quot;Chuva forte&quot; é o registro que justifica parada
            numa discussão de prazo — vale marcar mesmo quando parece óbvio, porque é dele que
            sai a contagem de dias perdidos.
          </FieldDescription>
        </Field>

        <Field orientation="responsive">
          <div className="w-full">
            <FieldLabel htmlFor="temperatura">Temperatura (°C)</FieldLabel>
            <Input
              id="temperatura"
              name="temperatura"
              type="number"
              step="0.1"
              min="-20"
              max="60"
              defaultValue={valores?.temperatura ?? ""}
              disabled={somenteLeitura}
            />
          </div>
          <div className="w-full">
            <FieldLabel htmlFor="umidade">Umidade (%)</FieldLabel>
            <Input
              id="umidade"
              name="umidade"
              type="number"
              step="1"
              min="0"
              max="100"
              defaultValue={valores?.umidade ?? ""}
              disabled={somenteLeitura}
            />
          </div>
          <div className="w-full">
            {/* Opcionais: aparecem no relatório quando preenchidos e somem
                quando não — documento com temperatura zerada por omissão
                seria pior que documento sem o campo. */}
            <FieldDescription>
              Opcionais. Entram no relatório diário quando preenchidos.
            </FieldDescription>
          </div>
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
