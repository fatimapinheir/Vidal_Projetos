import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { PresencaForm } from "./presenca-form";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default async function PresencasObraPage({
  params,
  searchParams,
}: {
  params: Promise<{ obraId: string }>;
  searchParams: Promise<{ data?: string }>;
}) {
  const { obraId } = await params;
  const { data: dataParam } = await searchParams;
  const data = dataParam || todayIso();

  const supabase = await createClient();

  const [{ data: alocados }, { data: presencasDoDia }] = await Promise.all([
    supabase
      .from("obra_trabalhadores")
      .select("trabalhador_id, trabalhadores(id, nome, funcao)")
      .eq("obra_id", obraId)
      .eq("ativo", true),
    supabase
      .from("presencas")
      .select("trabalhador_id, status, observacoes")
      .eq("obra_id", obraId)
      .eq("data", data),
  ]);

  const presencaPorTrabalhador = new Map(
    presencasDoDia?.map((p) => [p.trabalhador_id, p]) ?? []
  );

  const linhas = (alocados ?? []).map((a) => {
    const t = a.trabalhadores as unknown as { id: string; nome: string; funcao: string | null };
    const existente = presencaPorTrabalhador.get(a.trabalhador_id);
    return {
      id: t.id,
      nome: t.nome,
      funcao: t.funcao,
      status: existente?.status ?? "presente",
      observacoes: existente?.observacoes ?? "",
    } as const;
  });

  return (
    <div className="flex flex-col gap-4">
      <form className="flex items-end gap-2" method="GET">
        <div className="flex flex-col gap-1">
          <label htmlFor="data" className="text-xs text-muted-foreground">
            Data
          </label>
          <input
            id="data"
            name="data"
            type="date"
            defaultValue={data}
            max={todayIso()}
            className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
          />
        </div>
        <Button type="submit" variant="outline" size="sm">
          Ver
        </Button>
      </form>

      <PresencaForm obraId={obraId} data={data} trabalhadores={linhas} />
    </div>
  );
}
