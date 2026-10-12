"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";

const avancoSchema = z.object({
  cronograma_tarefa_id: z.uuid(),
  percentual: z.coerce
    .number()
    .min(0, "O percentual vai de 0 a 100.")
    .max(100, "O percentual vai de 0 a 100."),
  data_medicao: z.string().min(1, "Informe a data da medição."),
  observacoes: z.string().optional(),
});

export type AvancoFormState = { error: string | null; success?: boolean };

/**
 * Registra o percentual executado de uma tarefa do cronograma.
 *
 * É o engenheiro que diz o número — "limpeza do terreno, 30%" — e quando a
 * tarefa termina ele volta e põe 100%. Não há cálculo a partir de quantidade:
 * acompanhar obra é acompanhar tarefa, e exigir m² ou kg para dizer isso só
 * atrasava o registro.
 *
 * Cada chamada insere uma linha de histórico; a `vw_avanco_atual` expõe a mais
 * recente. Corrigir é registrar de novo, e a medição anterior fica no histórico.
 */
export async function registrarAvancoTarefa(
  obraId: string,
  entrada: {
    tarefaId: string;
    percentual: string | number;
    dataMedicao: string;
    observacoes?: string;
  }
): Promise<AvancoFormState> {
  const profile = await requireRole("engenheiro");

  const parsed = avancoSchema.safeParse({
    cronograma_tarefa_id: entrada.tarefaId,
    percentual: entrada.percentual,
    data_medicao: entrada.dataMedicao,
    observacoes: entrada.observacoes,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();

  // A tarefa tem de ser desta obra: o id vem do navegador, e sem isto uma
  // requisição forjada lançaria avanço no cronograma de outra obra.
  const { data: tarefa } = await supabase
    .from("cronograma_tarefas")
    .select("id, data_inicio_real, data_fim_real")
    .eq("id", parsed.data.cronograma_tarefa_id)
    .eq("obra_id", obraId)
    .maybeSingle();

  if (!tarefa) return { error: "Tarefa não encontrada nesta obra." };

  const { error } = await supabase.from("avanco_registros").insert({
    obra_id: obraId,
    cronograma_tarefa_id: parsed.data.cronograma_tarefa_id,
    percentual: parsed.data.percentual,
    data_medicao: parsed.data.data_medicao,
    observacoes: parsed.data.observacoes ?? null,
    registrado_por: profile.id,
  });

  if (error) return { error: "Não foi possível registrar o avanço." };

  /*
   * As datas reais da tarefa acompanham o percentual.
   *
   * São a mesma informação dita de dois jeitos, e quando cada tela escrevia a
   * sua, o cronograma mostrava tarefa em aberto enquanto o avanço dizia 100%.
   * Agora o percentual manda: o avanço é o único lugar onde se registra
   * conclusão, e daqui saem as datas que o cronograma e o atraso leem.
   */
  const concluida = parsed.data.percentual >= 100;
  const iniciada = parsed.data.percentual > 0;

  const datas: { data_inicio_real?: string | null; data_fim_real?: string | null } = {};

  if (iniciada && !tarefa.data_inicio_real) datas.data_inicio_real = parsed.data.data_medicao;
  if (!iniciada && tarefa.data_inicio_real) datas.data_inicio_real = null;
  if (concluida && !tarefa.data_fim_real) datas.data_fim_real = parsed.data.data_medicao;
  if (!concluida && tarefa.data_fim_real) datas.data_fim_real = null;

  if (Object.keys(datas).length) {
    await supabase
      .from("cronograma_tarefas")
      .update({ ...datas, updated_at: new Date().toISOString() })
      .eq("id", parsed.data.cronograma_tarefa_id)
      .eq("obra_id", obraId);
  }

  revalidarAvanco(obraId);
  return { error: null, success: true };
}

/**
 * Põe em 100% as tarefas da etapa que ainda não estão lá.
 *
 * Etapa concluída costuma ser lançada de uma vez — na prática o engenheiro só
 * passa no avanço depois que a frente de serviço terminou. Tarefa por tarefa,
 * numa etapa de dez, é digitação sem informação nova.
 *
 * Quem já está em 100% não é tocado, para não reescrever a data de conclusão
 * de algo medido semanas antes.
 */
export async function concluirEtapa(
  obraId: string,
  etapaId: string,
  dataMedicao: string
): Promise<AvancoFormState> {
  const profile = await requireRole("engenheiro");

  if (!dataMedicao) return { error: "Informe a data da medição." };

  const supabase = await createClient();

  const [{ data: tarefas }, { data: atuais }] = await Promise.all([
    supabase
      .from("cronograma_tarefas")
      .select("id, data_inicio_real")
      .eq("etapa_id", etapaId)
      // A etapa tem de ser desta obra: o id vem do navegador.
      .eq("obra_id", obraId),
    supabase
      .from("vw_avanco_atual")
      .select("cronograma_tarefa_id, percentual")
      .eq("obra_id", obraId),
  ]);

  if (!tarefas?.length) return { error: "Essa etapa não tem tarefas nesta obra." };

  const percentualPorTarefa = new Map(
    (atuais ?? []).map((a) => [a.cronograma_tarefa_id, a.percentual])
  );
  const pendentes = tarefas.filter((t) => (percentualPorTarefa.get(t.id) ?? 0) < 100);

  if (!pendentes.length) return { error: null, success: true };

  const { error } = await supabase.from("avanco_registros").insert(
    pendentes.map((tarefa) => ({
      obra_id: obraId,
      cronograma_tarefa_id: tarefa.id,
      percentual: 100,
      data_medicao: dataMedicao,
      registrado_por: profile.id,
    }))
  );

  if (error) return { error: "Não foi possível concluir a etapa." };

  await supabase
    .from("cronograma_tarefas")
    .update({ data_fim_real: dataMedicao, updated_at: new Date().toISOString() })
    .in(
      "id",
      pendentes.map((t) => t.id)
    )
    .eq("obra_id", obraId);

  // Tarefa concluída sem início registrado ganha o início na mesma data —
  // cronograma com fim real e sem início real não fecha conta de duração.
  const semInicio = pendentes.filter((t) => !t.data_inicio_real).map((t) => t.id);
  if (semInicio.length) {
    await supabase
      .from("cronograma_tarefas")
      .update({ data_inicio_real: dataMedicao })
      .in("id", semInicio)
      .eq("obra_id", obraId);
  }

  revalidarAvanco(obraId);
  return { error: null, success: true };
}

function revalidarAvanco(obraId: string) {
  revalidatePath(`/obras/${obraId}/avanco`);
  revalidatePath(`/obras/${obraId}/cronograma`);
  revalidatePath(`/obras/${obraId}/orcamento`);
  revalidatePath(`/obras/${obraId}`);
  revalidatePath(`/portal/obras/${obraId}`);
}
