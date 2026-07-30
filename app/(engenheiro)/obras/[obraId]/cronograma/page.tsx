import { createClient } from "@/lib/supabase/server";
import { buscarDadosTimeline } from "@/lib/cronograma/timeline-dados";
import { NovaEtapaDialog } from "./nova-etapa-dialog";
import { FixarLinhaDeBaseButton } from "./cronograma-actions";
import { CronogramaVisao } from "./cronograma-visao";
import { CronogramaTabela } from "./cronograma-tabela";
import { CronogramaTimeline } from "./cronograma-timeline";

export default async function CronogramaObraPage({
  params,
}: {
  params: Promise<{ obraId: string }>;
}) {
  const { obraId } = await params;
  const supabase = await createClient();

  const [{ data: etapas }, { data: tarefas }, { data: versaoAtiva }, { data: ultimaTarefa }, timeline] =
    await Promise.all([
      supabase.from("cronograma_etapas").select("*").eq("obra_id", obraId).order("ordem"),
      supabase.from("cronograma_tarefas").select("*").eq("obra_id", obraId).order("ordem"),
      supabase
        .from("orcamento_versoes")
        .select("id")
        .eq("obra_id", obraId)
        .eq("status", "ativa")
        .maybeSingle(),
      supabase
        .from("cronograma_tarefas")
        .select("id, nome")
        .eq("obra_id", obraId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      buscarDadosTimeline(supabase, obraId),
    ]);

  const tarefaIds = (tarefas ?? []).map((t) => t.id);

  const [{ data: dependencias }, { data: itensOrcamento }] = await Promise.all([
    tarefaIds.length
      ? supabase
          .from("cronograma_dependencias")
          .select("id, tarefa_predecessora_id, tarefa_sucessora_id, tipo, lag_dias")
          .in("tarefa_sucessora_id", tarefaIds)
      : Promise.resolve({ data: [] }),
    versaoAtiva
      ? supabase
          .from("orcamento_itens")
          .select("id, descricao")
          .eq("orcamento_versao_id", versaoAtiva.id)
          .order("ordem")
      : Promise.resolve({ data: [] }),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-heading text-lg font-semibold">Cronograma (EAP)</h1>
        <p className="text-sm text-muted-foreground">
          Organize a obra em etapas e tarefas com duração e dependências entre elas. O sistema
          calcula automaticamente o caminho crítico — tarefas em vermelho sem nenhuma margem, onde
          um atraso atrasa a obra inteira. Quando o cronograma estiver pronto, clique em{" "}
          <strong>Fixar linha de base</strong> — a partir daí, o atraso de cada tarefa passa a ser
          medido contra essas datas, e atrasos reais propagam automaticamente para as tarefas que
          dependem delas. Os dias de folga (feriados, chuva, etc.) são cadastrados na aba{" "}
          <strong>Folgas</strong>. Cada tarefa também pode ter um lembrete — avisa aqui dentro do
          sistema alguns dias antes do início, útil pra agendar fornecedor ou equipamento com
          antecedência. A visão <strong>Timeline</strong> mostra tudo isso em barras no calendário.
        </p>
      </div>

      <div className="flex justify-end gap-2">
        <FixarLinhaDeBaseButton obraId={obraId} />
        <NovaEtapaDialog obraId={obraId} />
      </div>

      <CronogramaVisao
        tabela={
          <CronogramaTabela
            obraId={obraId}
            etapas={etapas ?? []}
            tarefas={tarefas ?? []}
            dependencias={dependencias ?? []}
            itensOrcamento={itensOrcamento ?? []}
            ultimaTarefaNome={ultimaTarefa?.nome ?? null}
          />
        }
        timeline={<CronogramaTimeline {...timeline} />}
      />
    </div>
  );
}
