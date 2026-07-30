"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { calcularCPM, type FolgaEntrada } from "@/lib/cronograma/cpm";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

/** Recarrega todas as tarefas/dependências da obra, roda o CPM e grava os campos calculados. */
async function recalcularCronograma(supabase: SupabaseClient, obraId: string) {
  const { data: tarefas } = await supabase
    .from("cronograma_tarefas")
    .select(
      "id, duracao_dias, restricao_inicio_nao_antes_de, data_inicio_real, data_fim_real, baseline_inicio, baseline_fim"
    )
    .eq("obra_id", obraId);

  if (!tarefas?.length) return;

  const { data: dependenciasRaw } = await supabase
    .from("cronograma_dependencias")
    .select("id, tarefa_predecessora_id, tarefa_sucessora_id, tipo, lag_dias")
    .in(
      "tarefa_predecessora_id",
      tarefas.map((t) => t.id)
    );

  const dependencias = (dependenciasRaw ?? []).map((d) => ({
    predecessoraId: d.tarefa_predecessora_id,
    sucessoraId: d.tarefa_sucessora_id,
    tipo: d.tipo,
    lagDias: d.lag_dias,
  }));

  const { data: folgasRaw } = await supabase
    .from("cronograma_folgas")
    .select("data_inicio, data_fim")
    .eq("obra_id", obraId);

  const folgas: FolgaEntrada[] = (folgasRaw ?? []).map((f) => ({
    dataInicio: f.data_inicio,
    dataFim: f.data_fim,
  }));

  const resultado = calcularCPM(
    tarefas.map((t) => ({
      id: t.id,
      duracaoDias: t.duracao_dias,
      restricaoInicioNaoAntesDe: t.restricao_inicio_nao_antes_de,
      dataInicioReal: t.data_inicio_real,
      dataFimReal: t.data_fim_real,
    })),
    dependencias,
    folgas
  );

  await Promise.all(
    resultado.map((r) => {
      return supabase
        .from("cronograma_tarefas")
        .update({
          data_inicio_cedo: r.dataInicioCedo,
          data_fim_cedo: r.dataFimCedo,
          data_inicio_tarde: r.dataInicioTarde,
          data_fim_tarde: r.dataFimTarde,
          folga_dias: r.folgaDias,
          critica: r.critica,
        })
        .eq("id", r.id);
    })
  );
}

export type CronogramaFormState = { error: string | null; success?: boolean };

const etapaSchema = z.object({ nome: z.string().min(1, "Informe o nome da etapa.") });

export async function criarEtapa(
  obraId: string,
  _prevState: CronogramaFormState,
  formData: FormData
): Promise<CronogramaFormState> {
  await requireRole("engenheiro");
  const parsed = etapaSchema.safeParse({ nome: formData.get("nome") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const supabase = await createClient();
  const { count } = await supabase
    .from("cronograma_etapas")
    .select("*", { count: "exact", head: true })
    .eq("obra_id", obraId);

  const { error } = await supabase
    .from("cronograma_etapas")
    .insert({ obra_id: obraId, nome: parsed.data.nome, ordem: (count ?? 0) + 1 });

  if (error) return { error: "Não foi possível criar a etapa." };

  revalidatePath(`/obras/${obraId}/cronograma`);
  return { error: null, success: true };
}

export async function removerEtapa(obraId: string, etapaId: string) {
  await requireRole("engenheiro");
  const supabase = await createClient();
  await supabase.from("cronograma_etapas").delete().eq("id", etapaId);
  await recalcularCronograma(supabase, obraId);
  revalidatePath(`/obras/${obraId}/cronograma`);
}

const tarefaSchema = z.object({
  nome: z.string().min(1, "Informe o nome da tarefa."),
  duracao_dias: z.coerce.number().int().positive("Duração deve ser um número de dias maior que zero."),
  restricao_inicio_nao_antes_de: z.string().optional(),
  orcamento_item_id: z.uuid().optional(),
  lembrete_dias_antes: z.coerce.number().int().positive("Informe quantos dias antes.").optional(),
});

/**
 * Cria uma tarefa. Por padrão, assume que ela só começa depois que a última
 * tarefa cadastrada na obra terminar (cria uma dependência término→início
 * automaticamente) — reflete o jeito mais comum de planejar, onde tarefas se
 * sucedem. Quando não há tarefa anterior (primeira da obra) ou o engenheiro
 * desmarca "depende da anterior" (tarefa em paralelo), exige uma data âncora
 * manual (`restricao_inicio_nao_antes_de`).
 */
export async function criarTarefa(
  obraId: string,
  etapaId: string,
  _prevState: CronogramaFormState,
  formData: FormData
): Promise<CronogramaFormState> {
  await requireRole("engenheiro");

  const dependeDaAnterior = !!formData.get("depende_da_anterior");

  const lembreteAtivo = !!formData.get("lembrete_ativo");

  const parsed = tarefaSchema.safeParse({
    nome: formData.get("nome"),
    duracao_dias: formData.get("duracao_dias"),
    restricao_inicio_nao_antes_de: formData.get("restricao_inicio_nao_antes_de") || undefined,
    orcamento_item_id: formData.get("orcamento_item_id") || undefined,
    lembrete_dias_antes: lembreteAtivo ? formData.get("lembrete_dias_antes") || undefined : undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  if (lembreteAtivo && !parsed.data.lembrete_dias_antes) {
    return { error: "Informe quantos dias antes o lembrete deve avisar." };
  }

  const supabase = await createClient();

  const { data: ultimaTarefa } = await supabase
    .from("cronograma_tarefas")
    .select("id")
    .eq("obra_id", obraId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const vaiEncadear = !!ultimaTarefa && dependeDaAnterior;

  if (!vaiEncadear && !parsed.data.restricao_inicio_nao_antes_de) {
    return {
      error: ultimaTarefa
        ? "Informe a data de início dessa tarefa (ela não depende da anterior)."
        : "Informe a data de início dessa tarefa (é a primeira do cronograma).",
    };
  }

  const { count } = await supabase
    .from("cronograma_tarefas")
    .select("*", { count: "exact", head: true })
    .eq("etapa_id", etapaId);

  const { data: novaTarefa, error } = await supabase
    .from("cronograma_tarefas")
    .insert({
      etapa_id: etapaId,
      obra_id: obraId,
      nome: parsed.data.nome,
      duracao_dias: parsed.data.duracao_dias,
      restricao_inicio_nao_antes_de: vaiEncadear ? null : parsed.data.restricao_inicio_nao_antes_de || null,
      orcamento_item_id: parsed.data.orcamento_item_id || null,
      lembrete_dias_antes: parsed.data.lembrete_dias_antes ?? null,
      ordem: (count ?? 0) + 1,
    })
    .select("id")
    .single();

  if (error || !novaTarefa) return { error: "Não foi possível criar a tarefa." };

  if (vaiEncadear) {
    await supabase.from("cronograma_dependencias").insert({
      tarefa_predecessora_id: ultimaTarefa.id,
      tarefa_sucessora_id: novaTarefa.id,
      tipo: "termino_inicio",
      lag_dias: 0,
    });
  }

  try {
    await recalcularCronograma(supabase, obraId);
  } catch (err) {
    return {
      error:
        err instanceof Error
          ? err.message
          : "Tarefa criada, mas não foi possível calcular o cronograma (verifique se ela precisa de uma data âncora).",
    };
  }

  revalidatePath(`/obras/${obraId}/cronograma`);
  return { error: null, success: true };
}

export async function removerTarefa(obraId: string, tarefaId: string) {
  await requireRole("engenheiro");
  const supabase = await createClient();
  await supabase.from("cronograma_tarefas").delete().eq("id", tarefaId);
  try {
    await recalcularCronograma(supabase, obraId);
  } catch {
    // segue sem recalcular — o próximo ajuste tenta de novo
  }
  revalidatePath(`/obras/${obraId}/cronograma`);
}

const atualizarTarefaSchema = z.object({
  duracao_dias: z.coerce.number().int().positive("Duração deve ser maior que zero."),
  restricao_inicio_nao_antes_de: z.string().optional(),
  data_inicio_real: z.string().optional(),
  data_fim_real: z.string().optional(),
  lembrete_dias_antes: z.coerce.number().int().positive("Informe quantos dias antes.").optional(),
});

export async function atualizarTarefa(
  obraId: string,
  tarefaId: string,
  _prevState: CronogramaFormState,
  formData: FormData
): Promise<CronogramaFormState> {
  await requireRole("engenheiro");

  const lembreteAtivo = !!formData.get("lembrete_ativo");

  const parsed = atualizarTarefaSchema.safeParse({
    duracao_dias: formData.get("duracao_dias"),
    restricao_inicio_nao_antes_de: formData.get("restricao_inicio_nao_antes_de") || undefined,
    data_inicio_real: formData.get("data_inicio_real") || undefined,
    data_fim_real: formData.get("data_fim_real") || undefined,
    lembrete_dias_antes: lembreteAtivo ? formData.get("lembrete_dias_antes") || undefined : undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  if (lembreteAtivo && !parsed.data.lembrete_dias_antes) {
    return { error: "Informe quantos dias antes o lembrete deve avisar." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("cronograma_tarefas")
    .update({
      duracao_dias: parsed.data.duracao_dias,
      restricao_inicio_nao_antes_de: parsed.data.restricao_inicio_nao_antes_de || null,
      data_inicio_real: parsed.data.data_inicio_real || null,
      data_fim_real: parsed.data.data_fim_real || null,
      lembrete_dias_antes: parsed.data.lembrete_dias_antes ?? null,
    })
    .eq("id", tarefaId);

  if (error) return { error: "Não foi possível atualizar a tarefa." };

  try {
    await recalcularCronograma(supabase, obraId);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Não foi possível recalcular o cronograma." };
  }

  revalidatePath(`/obras/${obraId}/cronograma`);
  return { error: null, success: true };
}

const dependenciaSchema = z.object({
  predecessora_id: z.uuid("Selecione a tarefa predecessora."),
  sucessora_id: z.uuid("Selecione a tarefa sucessora."),
  tipo: z.enum(["termino_inicio", "inicio_inicio", "termino_termino", "inicio_termino"]),
  lag_dias: z.coerce.number().int().optional(),
});

export async function adicionarDependencia(
  obraId: string,
  _prevState: CronogramaFormState,
  formData: FormData
): Promise<CronogramaFormState> {
  await requireRole("engenheiro");

  const parsed = dependenciaSchema.safeParse({
    predecessora_id: formData.get("predecessora_id"),
    sucessora_id: formData.get("sucessora_id"),
    tipo: formData.get("tipo"),
    lag_dias: formData.get("lag_dias") || 0,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  if (parsed.data.predecessora_id === parsed.data.sucessora_id) {
    return { error: "Uma tarefa não pode depender dela mesma." };
  }

  const supabase = await createClient();
  const { data: dependencia, error } = await supabase
    .from("cronograma_dependencias")
    .insert({
      tarefa_predecessora_id: parsed.data.predecessora_id,
      tarefa_sucessora_id: parsed.data.sucessora_id,
      tipo: parsed.data.tipo,
      lag_dias: parsed.data.lag_dias ?? 0,
    })
    .select("id")
    .single();

  if (error || !dependencia) {
    return { error: "Essa dependência já existe ou não foi possível criá-la." };
  }

  try {
    await recalcularCronograma(supabase, obraId);
  } catch (err) {
    // desfaz — essa dependência criaria um ciclo (ou outro problema de cálculo)
    await supabase.from("cronograma_dependencias").delete().eq("id", dependencia.id);
    await recalcularCronograma(supabase, obraId).catch(() => {});
    return { error: err instanceof Error ? err.message : "Não foi possível calcular o cronograma com essa dependência." };
  }

  revalidatePath(`/obras/${obraId}/cronograma`);
  return { error: null, success: true };
}

export async function removerDependencia(obraId: string, dependenciaId: string) {
  await requireRole("engenheiro");
  const supabase = await createClient();
  await supabase.from("cronograma_dependencias").delete().eq("id", dependenciaId);
  try {
    await recalcularCronograma(supabase, obraId);
  } catch {
    // segue sem recalcular
  }
  revalidatePath(`/obras/${obraId}/cronograma`);
}

/**
 * Fixa a linha de base (baseline) de todas as tarefas da obra com as datas
 * atuais calculadas. A partir daqui, "atraso" passa a ser medido contra essas
 * datas. Chamado manualmente pelo engenheiro quando o cronograma (etapas,
 * tarefas e dependências) já estiver pronto — nunca automaticamente, para não
 * gerar falso atraso enquanto o plano ainda está sendo montado.
 */
export async function fixarLinhaDeBase(obraId: string) {
  await requireRole("engenheiro");
  const supabase = await createClient();

  const { data: tarefas } = await supabase
    .from("cronograma_tarefas")
    .select("id, data_inicio_cedo, data_fim_cedo")
    .eq("obra_id", obraId);

  await Promise.all(
    (tarefas ?? []).map((t) =>
      supabase
        .from("cronograma_tarefas")
        .update({ baseline_inicio: t.data_inicio_cedo, baseline_fim: t.data_fim_cedo })
        .eq("id", t.id)
    )
  );

  revalidatePath(`/obras/${obraId}/cronograma`);
}

const folgaSchema = z
  .object({
    data_inicio: z.string().min(1, "Informe a data de início da folga."),
    data_fim: z.string().optional(),
    descricao: z.string().optional(),
  })
  .transform((data) => ({
    data_inicio: data.data_inicio,
    data_fim: data.data_fim || data.data_inicio,
    descricao: data.descricao,
  }))
  .refine((data) => data.data_fim >= data.data_inicio, {
    message: "A data de fim da folga não pode ser antes da data de início.",
    path: ["data_fim"],
  });

/** Registra um dia (ou intervalo de dias) como folga — passa a ser pulado nos cálculos do cronograma. */
export async function criarFolga(
  obraId: string,
  _prevState: CronogramaFormState,
  formData: FormData
): Promise<CronogramaFormState> {
  const profile = await requireRole("engenheiro");

  const parsed = folgaSchema.safeParse({
    data_inicio: formData.get("data_inicio"),
    data_fim: formData.get("data_fim") || undefined,
    descricao: formData.get("descricao") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const supabase = await createClient();
  const { error } = await supabase.from("cronograma_folgas").insert({
    obra_id: obraId,
    data_inicio: parsed.data.data_inicio,
    data_fim: parsed.data.data_fim,
    descricao: parsed.data.descricao || null,
    criado_por: profile.id,
  });

  if (error) return { error: "Não foi possível registrar a folga." };

  try {
    await recalcularCronograma(supabase, obraId);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Não foi possível recalcular o cronograma." };
  }

  revalidatePath(`/obras/${obraId}/cronograma`);
  revalidatePath(`/obras/${obraId}/folgas`);
  return { error: null, success: true };
}

export async function removerFolga(obraId: string, folgaId: string) {
  await requireRole("engenheiro");
  const supabase = await createClient();
  await supabase.from("cronograma_folgas").delete().eq("id", folgaId);
  try {
    await recalcularCronograma(supabase, obraId);
  } catch {
    // segue sem recalcular
  }
  revalidatePath(`/obras/${obraId}/cronograma`);
  revalidatePath(`/obras/${obraId}/folgas`);
}

/**
 * Alterna uma única data no calendário de folgas: se já existir uma folga de
 * um dia só exatamente nessa data, remove; senão, cria uma nova folga de um
 * dia. Não mexe em folgas que sejam intervalos de vários dias (essas só se
 * removem pela lista, pra não apagar um pedaço do intervalo sem querer).
 */
export async function alternarFolgaDia(obraId: string, dataIso: string) {
  const profile = await requireRole("engenheiro");
  const supabase = await createClient();

  const { data: folgaExistente } = await supabase
    .from("cronograma_folgas")
    .select("id, data_inicio, data_fim")
    .eq("obra_id", obraId)
    .eq("data_inicio", dataIso)
    .eq("data_fim", dataIso)
    .maybeSingle();

  if (folgaExistente) {
    await supabase.from("cronograma_folgas").delete().eq("id", folgaExistente.id);
  } else {
    const { data: dentroDeIntervalo } = await supabase
      .from("cronograma_folgas")
      .select("id")
      .eq("obra_id", obraId)
      .lte("data_inicio", dataIso)
      .gte("data_fim", dataIso)
      .maybeSingle();
    if (dentroDeIntervalo) return;

    await supabase.from("cronograma_folgas").insert({
      obra_id: obraId,
      data_inicio: dataIso,
      data_fim: dataIso,
      criado_por: profile.id,
    });
  }

  try {
    await recalcularCronograma(supabase, obraId);
  } catch {
    // segue sem recalcular
  }
  revalidatePath(`/obras/${obraId}/cronograma`);
  revalidatePath(`/obras/${obraId}/folgas`);
}
