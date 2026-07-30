import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { updateObraStatus } from "@/app/actions/obras";
import { formatDateBR } from "@/lib/format-date";
import { ProgressoOrcamento } from "@/components/obras/progresso-orcamento";
import { LembretesCard } from "@/components/cronograma/lembretes-card";
import { buscarLembretesAtivos } from "@/lib/cronograma/lembretes";
import { buscarDadosTimeline } from "@/lib/cronograma/timeline-dados";
import { CronogramaTimeline } from "./cronograma/cronograma-timeline";

const statusOptions = [
  { value: "planejamento", label: "Planejamento" },
  { value: "em_andamento", label: "Em andamento" },
  { value: "pausada", label: "Pausada" },
  { value: "concluida", label: "Concluída" },
];

export default async function ObraOverviewPage({
  params,
}: {
  params: Promise<{ obraId: string }>;
}) {
  const { obraId } = await params;
  const supabase = await createClient();

  const [
    { data: obra },
    { count: clientesCount },
    { count: equipeCount },
    { count: comprasCount },
    { data: progresso },
    { data: comprasAprovadas },
    timeline,
  ] = await Promise.all([
    supabase.from("obras").select("*").eq("id", obraId).single(),
    supabase
      .from("obra_clientes")
      .select("*", { count: "exact", head: true })
      .eq("obra_id", obraId),
    supabase
      .from("obra_trabalhadores")
      .select("*", { count: "exact", head: true })
      .eq("obra_id", obraId)
      .eq("ativo", true),
    supabase.from("compras").select("*", { count: "exact", head: true }).eq("obra_id", obraId),
    supabase.from("vw_progresso_obra").select("*").eq("obra_id", obraId).maybeSingle(),
    supabase
      .from("compras")
      .select("valor_total")
      .eq("obra_id", obraId)
      .in("status", ["aprovada", "paga"]),
    buscarDadosTimeline(supabase, obraId),
  ]);

  if (!obra) return null;

  // Só vale mostrar a timeline depois que o CPM rodou e as tarefas têm datas.
  const temTimeline = timeline.tarefas.some((t) => t.inicio && t.fim);

  const lembretes = await buscarLembretesAtivos(supabase, { obraId });

  const gastoAprovado = comprasAprovadas?.reduce((sum, c) => sum + c.valor_total, 0) ?? 0;
  const percentualFinanceiro =
    progresso && progresso.valor_orcado_total > 0
      ? (gastoAprovado / progresso.valor_orcado_total) * 100
      : 0;

  const updateStatusWithId = updateObraStatus.bind(null, obraId);

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {!!lembretes.length && (
        <div className="md:col-span-3">
          <LembretesCard lembretes={lembretes} />
        </div>
      )}

      {progresso && (
        <Card className="md:col-span-3">
          <CardHeader>
            <CardTitle>Orçado vs. realizado</CardTitle>
          </CardHeader>
          <CardContent>
            <ProgressoOrcamento
              percentualFisico={progresso.percentual_fisico}
              percentualFinanceiro={percentualFinanceiro}
            />
          </CardContent>
        </Card>
      )}

      {temTimeline && (
        <Card className="md:col-span-3">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
            <CardTitle>Cronograma</CardTitle>
            <Button
              nativeButton={false}
              variant="outline"
              size="sm"
              render={<Link href={`/obras/${obraId}/cronograma`}>Abrir cronograma</Link>}
            />
          </CardHeader>
          <CardContent>
            <CronogramaTimeline {...timeline} alturaMaxima={340} />
          </CardContent>
        </Card>
      )}

      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>Dados da obra</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <p className="text-muted-foreground">Tipo</p>
              <p className="font-medium capitalize">{obra.tipo}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Endereço</p>
              <p className="font-medium">{obra.endereco ?? "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Início previsto</p>
              <p className="font-medium">{formatDateBR(obra.data_inicio)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Fim previsto</p>
              <p className="font-medium">{formatDateBR(obra.data_fim_prevista)}</p>
            </div>
          </div>

          <form action={updateStatusWithId} className="flex flex-wrap items-end gap-2 pt-2">
            <div className="flex flex-col gap-1">
              <label htmlFor="status" className="text-xs text-muted-foreground">
                Status da obra
              </label>
              <select
                id="status"
                name="status"
                defaultValue={obra.status}
                className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
              >
                {statusOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" size="sm" variant="outline">
              Atualizar status
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-4">
        <Card>
          <CardContent className="flex items-center justify-between py-4">
            <p className="text-sm text-muted-foreground">Clientes vinculados</p>
            <p className="font-heading text-xl font-semibold">{clientesCount ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between py-4">
            <p className="text-sm text-muted-foreground">Equipe ativa</p>
            <p className="font-heading text-xl font-semibold">{equipeCount ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between py-4">
            <p className="text-sm text-muted-foreground">Compras registradas</p>
            <p className="font-heading text-xl font-semibold">{comprasCount ?? 0}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
