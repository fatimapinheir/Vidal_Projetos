import type { createClient } from "@/lib/supabase/server";
import type { DependenciaTipo } from "@/lib/types/database.types";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export type TarefaTimeline = {
  id: string;
  etapaId: string;
  nome: string;
  duracaoDias: number;
  inicio: string | null;
  fim: string | null;
  baselineInicio: string | null;
  baselineFim: string | null;
  inicioReal: string | null;
  fimReal: string | null;
  folgaDias: number | null;
  critica: boolean;
};

export type EtapaTimeline = { id: string; nome: string };

export type DependenciaTimeline = {
  predecessoraId: string;
  sucessoraId: string;
  tipo: DependenciaTipo;
};

export type FolgaTimeline = { dataInicio: string; dataFim: string };

export type DadosTimeline = {
  etapas: EtapaTimeline[];
  tarefas: TarefaTimeline[];
  dependencias: DependenciaTimeline[];
  folgas: FolgaTimeline[];
};

/**
 * Carrega e traduz para o formato da timeline tudo que ela precisa de uma obra.
 * Usado tanto na aba Cronograma quanto na visão geral da obra — as duas telas
 * mostram a mesma timeline, então a busca mora aqui pra não divergirem.
 */
export async function buscarDadosTimeline(
  supabase: SupabaseClient,
  obraId: string
): Promise<DadosTimeline> {
  const [{ data: etapas }, { data: tarefas }, { data: folgas }] = await Promise.all([
    supabase.from("cronograma_etapas").select("id, nome").eq("obra_id", obraId).order("ordem"),
    supabase.from("cronograma_tarefas").select("*").eq("obra_id", obraId).order("ordem"),
    supabase.from("cronograma_folgas").select("data_inicio, data_fim").eq("obra_id", obraId),
  ]);

  const tarefaIds = (tarefas ?? []).map((t) => t.id);
  const { data: dependencias } = tarefaIds.length
    ? await supabase
        .from("cronograma_dependencias")
        .select("tarefa_predecessora_id, tarefa_sucessora_id, tipo")
        .in("tarefa_sucessora_id", tarefaIds)
    : { data: [] };

  return {
    etapas: etapas ?? [],
    tarefas: (tarefas ?? []).map((t) => ({
      id: t.id,
      etapaId: t.etapa_id,
      nome: t.nome,
      duracaoDias: t.duracao_dias,
      inicio: t.data_inicio_cedo,
      fim: t.data_fim_cedo,
      baselineInicio: t.baseline_inicio,
      baselineFim: t.baseline_fim,
      inicioReal: t.data_inicio_real,
      fimReal: t.data_fim_real,
      folgaDias: t.folga_dias,
      critica: t.critica,
    })),
    dependencias: (dependencias ?? []).map((d) => ({
      predecessoraId: d.tarefa_predecessora_id,
      sucessoraId: d.tarefa_sucessora_id,
      tipo: d.tipo,
    })),
    folgas: (folgas ?? []).map((f) => ({ dataInicio: f.data_inicio, dataFim: f.data_fim })),
  };
}
