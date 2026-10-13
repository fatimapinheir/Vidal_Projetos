import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { buscarDadosTimeline } from "@/lib/cronograma/timeline-dados";
import { NovaEtapaDialog } from "./nova-etapa-dialog";
import {
  TemplateCronogramaDialog,
  ImportarOrcamentoButton,
} from "./importar-orcamento-button";
import { FixarLinhaDeBaseButton } from "./cronograma-actions";
import { CronogramaVisao } from "./cronograma-visao";
import { CronogramaTabela } from "./cronograma-tabela";
import { CronogramaTimeline } from "@/components/cronograma/cronograma-timeline";
import { CopiarDeOutraObraDialog } from "@/components/obras/copiar-de-outra-obra-dialog";
import { AjudaDaPagina } from "@/components/ui/ajuda-da-pagina";

export default async function CronogramaObraPage({
  params,
}: {
  params: Promise<{ obraId: string }>;
}) {
  const { obraId } = await params;
  const supabase = await createClient();

  const [
    { data: etapas },
    { data: tarefas },
    { data: versaoAtiva },
    timeline,
    { data: obra },
  ] = await Promise.all([
      supabase.from("cronograma_etapas").select("*").eq("obra_id", obraId).order("ordem"),
      supabase.from("cronograma_tarefas").select("*").eq("obra_id", obraId).order("ordem"),
      supabase
        .from("orcamento_versoes")
        .select("id")
        .eq("obra_id", obraId)
        .eq("status", "ativa")
        .maybeSingle(),
      buscarDadosTimeline(supabase, obraId),
      supabase.from("obras").select("faixa").eq("id", obraId).maybeSingle(),
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
        <h1 className="flex items-center gap-1 font-heading text-lg font-semibold">
          Cronograma (EAP)
          <AjudaDaPagina titulo="Cronograma (EAP)">
            <p>
              Aqui fica o <strong>planejado</strong>: a obra em etapas e tarefas, com datas e a
              ordem entre elas. O que foi de fato executado se registra em{" "}
              <Link
                href={`/obras/${obraId}/avanco`}
                className="text-primary-texto underline underline-offset-4"
              >
                Avanço
              </Link>
              , pelo percentual de cada tarefa.
            </p>
            <p>
              O sistema calcula o caminho crítico — tarefas em vermelho, sem folga, onde um atraso
              atrasa a obra inteira. Os dias de folga (feriados, chuva) são cadastrados em{" "}
              <strong>Folgas</strong>.
            </p>
            <p>
              Quando o cronograma estiver pronto, <strong>Fixar linha de base</strong> congela as
              datas atuais como referência de comparação. A visão <strong>Timeline</strong> mostra
              tudo em barras no calendário.
            </p>
          </AjudaDaPagina>
        </h1>
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        <CopiarDeOutraObraDialog
          obraId={obraId}
          padrao={{ orcamento: false, cronograma: true }}
        />
        <TemplateCronogramaDialog obraId={obraId} faixaDaObra={obra?.faixa ?? null} />
        <ImportarOrcamentoButton obraId={obraId} />
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
          />
        }
        timeline={<CronogramaTimeline {...timeline} alturaMaxima="70vh" />}
      />
    </div>
  );
}
