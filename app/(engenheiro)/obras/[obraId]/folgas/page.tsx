import { createClient } from "@/lib/supabase/server";
import { formatDateBR } from "@/lib/format-date";
import { FolgasCalendario } from "./folgas-calendario";
import { NovaFolgaDialog } from "./nova-folga-dialog";
import { RemoverFolgaButton } from "./folgas-actions";

export default async function FolgasObraPage({
  params,
}: {
  params: Promise<{ obraId: string }>;
}) {
  const { obraId } = await params;
  const supabase = await createClient();

  const { data: folgas } = await supabase
    .from("cronograma_folgas")
    .select("*")
    .eq("obra_id", obraId)
    .order("data_inicio", { ascending: false });

  const folgasResumo = (folgas ?? []).map((f) => ({ dataInicio: f.data_inicio, dataFim: f.data_fim }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-lg font-semibold">Folgas</h1>
          <p className="text-sm text-muted-foreground">
            Dias que não contam como dia útil no cálculo do cronograma — cadastre qualquer data
            (chuva, feriado local, recesso, o que for), independente de fim de semana. Elas afetam
            automaticamente as datas de início/fim das tarefas em Cronograma.
          </p>
        </div>
        <NovaFolgaDialog obraId={obraId} />
      </div>

      <div className="rounded-xl border p-4">
        <FolgasCalendario obraId={obraId} folgas={folgasResumo} />
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="font-heading text-base font-semibold">Folgas registradas</h2>
        {folgas?.map((folga) => (
          <div key={folga.id} className="flex items-center justify-between rounded-lg border p-2.5 text-sm">
            <span>
              {folga.data_inicio === folga.data_fim
                ? formatDateBR(folga.data_inicio)
                : `${formatDateBR(folga.data_inicio)} – ${formatDateBR(folga.data_fim)}`}
              {folga.descricao ? ` — ${folga.descricao}` : ""}
            </span>
            <RemoverFolgaButton obraId={obraId} folgaId={folga.id} />
          </div>
        ))}
        {!folgas?.length && (
          <p className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">
            Nenhuma folga registrada.
          </p>
        )}
      </div>
    </div>
  );
}
