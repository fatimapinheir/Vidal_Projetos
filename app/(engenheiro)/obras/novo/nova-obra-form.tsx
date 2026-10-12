"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { ObraFormCampos, type TipoObra } from "@/components/obras/obra-form-campos";
import { createObra, type ObraFormState } from "@/app/actions/obras";

const initialState: ObraFormState = { error: null };

export function NovaObraForm({ tipos }: { tipos: TipoObra[] }) {
  const [state, formAction, pending] = useActionState(createObra, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <ObraFormCampos tipos={tipos} />
      {state.error && <FieldError>{state.error}</FieldError>}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Criando..." : "Criar obra"}
        </Button>
      </div>
    </form>
  );
}
