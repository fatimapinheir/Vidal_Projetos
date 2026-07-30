"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { registrarPresencas, type PresencaFormState } from "@/app/actions/presencas";

const initialState: PresencaFormState = { error: null };

type LinhaTrabalhador = {
  id: string;
  nome: string;
  funcao: string | null;
  status: "presente" | "falta" | "meia_diaria";
  observacoes: string;
};

export function PresencaForm({
  obraId,
  data,
  trabalhadores,
}: {
  obraId: string;
  data: string;
  trabalhadores: LinhaTrabalhador[];
}) {
  const action = registrarPresencas.bind(null, obraId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="data" value={data} />
      <div className="flex flex-col divide-y rounded-xl border">
        {trabalhadores.map((t) => (
          <div key={t.id} className="grid grid-cols-1 items-center gap-2 p-3 sm:grid-cols-3">
            <div>
              <p className="text-sm font-medium">{t.nome}</p>
              <p className="text-xs text-muted-foreground">{t.funcao ?? "—"}</p>
            </div>
            <select
              name={`status_${t.id}`}
              defaultValue={t.status}
              className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
            >
              <option value="presente">Presente</option>
              <option value="meia_diaria">Meia diária</option>
              <option value="falta">Falta</option>
            </select>
            <Input
              name={`obs_${t.id}`}
              defaultValue={t.observacoes}
              placeholder="Observação (opcional)"
            />
          </div>
        ))}
        {!trabalhadores.length && (
          <p className="p-6 text-center text-sm text-muted-foreground">
            Nenhum trabalhador alocado nessa obra ainda.
          </p>
        )}
      </div>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      {!pending && state.success && (
        <p className="text-sm text-sucesso">Presenças salvas.</p>
      )}

      <Button type="submit" disabled={pending || !trabalhadores.length} className="w-fit">
        {pending ? "Salvando..." : "Salvar presenças"}
      </Button>
    </form>
  );
}
