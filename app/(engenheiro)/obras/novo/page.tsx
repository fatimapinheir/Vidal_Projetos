"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel, FieldError, FieldSet, FieldLegend } from "@/components/ui/field";
import { createObra, type ObraFormState } from "@/app/actions/obras";

const initialState: ObraFormState = { error: null };

export default function NovaObraPage() {
  const [state, formAction, pending] = useActionState(createObra, initialState);

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle>Nova obra</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="nome">Nome da obra</FieldLabel>
              <Input id="nome" name="nome" required placeholder="Residência Silva" />
            </Field>
            <Field>
              <FieldLabel htmlFor="endereco">Endereço</FieldLabel>
              <Input id="endereco" name="endereco" />
            </Field>
            <FieldSet>
              <FieldLegend variant="label">Tipo</FieldLegend>
              <Field orientation="horizontal">
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" name="tipo" value="residencial" defaultChecked />
                  Residencial
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" name="tipo" value="comercial" />
                  Comercial
                </label>
              </Field>
            </FieldSet>
            <Field orientation="responsive">
              <div className="w-full">
                <FieldLabel htmlFor="data_inicio">Início previsto</FieldLabel>
                <Input id="data_inicio" name="data_inicio" type="date" />
              </div>
              <div className="w-full">
                <FieldLabel htmlFor="data_fim_prevista">Fim previsto</FieldLabel>
                <Input id="data_fim_prevista" name="data_fim_prevista" type="date" />
              </div>
            </Field>
            {state.error && <FieldError>{state.error}</FieldError>}
            <Button type="submit" disabled={pending}>
              {pending ? "Criando..." : "Criar obra"}
            </Button>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
