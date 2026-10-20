"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { calcularCPM, type FolgaEntrada } from "@/lib/cronograma/cpm";
import { acharTemplate } from "@/lib/cronograma/templates";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Recarrega todas as tarefas/dependências da obra, roda o CPM e grava os campos
 * calculados: datas cedo, datas tarde e folga.
 *
 * `critica` NÃO entra mais aqui. Era escrita a cada recálculo como
 * `folga_dias <= 0`, e por isso qualquer mexida no cronograma sobrescrevia em
 * silêncio o que o engenheiro tivesse dito. Agora é marcação dele — ver a
 * migração 0065 — e o recálculo passa ao lado da coluna.
 */
async function recalcularCronograma(supabase: SupabaseClient, obraId: string) {
  const { data: tarefas } = await supabase
    .from("cronograma_tarefas")
    .select(
      "id, nome, duracao_dias, restricao_inicio_nao_antes_de, data_inicio_real, data_fim_real, baseline_inicio, baseline_fim"
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
      nome: t.nome,
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

/*
 * `duracaoPeloFim` morava aqui: deduzia a duração contando os dias úteis
 * entre o início e o fim informados. Saiu quando a duração passou a ser o
 * campo digitado e o fim virou resultado do cálculo — ver a nota em
 * `atualizarTarefa`.
 */


/*
 * `critica` não passa pelo Zod de propósito.
 *
 * Checkbox não enviado é `null` em `formData.get`, e `.optional()` do Zod
 * aceita `undefined` mas RECUSA `null` — foi exatamente o que derrubou o
 * salvamento do diário. Booleano de caixa se lê com `!!`, como
 * `tem_predecessora` logo abaixo.
 */
const tarefaSchema = z.object({
  nome: z.string().min(1, "Informe o nome da tarefa."),
  duracao_dias: z.coerce.number().int().positive("Duração deve ser um número de dias maior que zero."),
  restricao_inicio_nao_antes_de: z.string().optional(),
  orcamento_item_id: z.uuid().optional(),
});

/**
 * Cria uma tarefa. Por padrão, assume que ela só começa depois que a última
 * tarefa cadastrada na obra terminar (cria uma dependência término→início
 * automaticamente) — reflete o jeito mais comum de planejar, onde tarefas se
 * sucedem. Quando não há tarefa anterior (primeira da obra) ou o engenheiro
 * desmarca "depende da anterior" (tarefa em paralelo), exige uma data âncora
 * manual (`restricao_inicio_nao_antes_de`).
 */
/**
 * Reordena as tarefas da etapa pela data de início, da menor para a maior.
 *
 * `ordem` é o que a tabela e a timeline usam para desenhar, e ela vinha da
 * sequência de cadastro: tarefa criada depois mas que começa antes aparecia
 * no fim da etapa, e a leitura da frente de serviço ficava fora de ordem
 * cronológica.
 *
 * Tarefa sem data calculada vai para o fim — ela ainda não tem lugar na
 * linha do tempo.
 */
async function reordenarEtapaPorData(
  supabase: Awaited<ReturnType<typeof createClient>>,
  etapaId: string
) {
  const { data: tarefas } = await supabase
    .from("cronograma_tarefas")
    .select("id, data_inicio_cedo, restricao_inicio_nao_antes_de, created_at")
    .eq("etapa_id", etapaId);

  if (!tarefas?.length) return;

  const inicio = (t: (typeof tarefas)[number]) =>
    t.data_inicio_cedo ?? t.restricao_inicio_nao_antes_de ?? null;

  const ordenadas = [...tarefas].sort((a, b) => {
    const ia = inicio(a);
    const ib = inicio(b);
    if (ia && ib && ia !== ib) return ia < ib ? -1 : 1;
    if (ia && !ib) return -1;
    if (!ia && ib) return 1;
    // Empate de data: mantém a ordem de cadastro, que é a única referência
    // estável que sobra.
    return a.created_at < b.created_at ? -1 : 1;
  });

  await Promise.all(
    ordenadas.map((tarefa, indice) =>
      supabase.from("cronograma_tarefas").update({ ordem: indice + 1 }).eq("id", tarefa.id)
    )
  );
}

/**
 * Deixa a tarefa com exatamente as predecessoras informadas.
 *
 * Plural desde a carga do cronograma da CASA VIDAL ALPHA: 48 das 152 tarefas
 * dependem de mais de uma. "Conferência e concretagem do baldrame" espera as
 * formas, as armaduras E as passagens hidráulicas — esperar só uma delas
 * descreveria outra obra.
 *
 * Era singular, e salvar pela tela apagava as demais em silêncio: o diálogo
 * gravava uma e o `delete` levava o resto. Quem abrisse uma tarefa só para
 * mudar a duração perdia o encadeamento sem ser avisado.
 *
 * Segue término → início sem lag. Tipo de ligação e lag em dias eram campos
 * que ninguém preenchia e davam ao cronograma cara de ferramenta de PERT que
 * ele não precisa ser.
 */
async function definirPredecessoras(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tarefaId: string,
  predecessoraIds: string[]
) {
  await supabase.from("cronograma_dependencias").delete().eq("tarefa_sucessora_id", tarefaId);

  // A própria tarefa nunca entra: seria um ciclo de um nó só.
  const limpos = [...new Set(predecessoraIds)].filter((id) => id && id !== tarefaId);
  if (!limpos.length) return;

  await supabase.from("cronograma_dependencias").insert(
    limpos.map((id) => ({
      tarefa_predecessora_id: id,
      tarefa_sucessora_id: tarefaId,
      tipo: "termino_inicio" as const,
      lag_dias: 0,
    }))
  );
}

/**
 * Alguma das predecessoras escolhidas depende, direta ou indiretamente, desta
 * tarefa?
 *
 * Sem esta checagem o ciclo entra no banco e só aparece depois: o CPM lança ao
 * ordenar topologicamente, o erro é engolido pelo `catch` do recálculo, e o
 * cronograma congela nas datas antigas sem ninguém entender por quê. Já
 * aconteceu nesta obra, por outro motivo.
 */
async function criariaCiclo(
  supabase: Awaited<ReturnType<typeof createClient>>,
  obraId: string,
  tarefaId: string,
  predecessoraIds: string[]
): Promise<boolean> {
  if (!predecessoraIds.length) return false;
  if (predecessoraIds.includes(tarefaId)) return true;

  const { data: tarefas } = await supabase
    .from("cronograma_tarefas")
    .select("id")
    .eq("obra_id", obraId);
  const daObra = new Set((tarefas ?? []).map((t) => t.id));

  const { data: deps } = await supabase
    .from("cronograma_dependencias")
    .select("tarefa_predecessora_id, tarefa_sucessora_id");

  const sucessoras = new Map<string, string[]>();
  for (const d of deps ?? []) {
    if (!daObra.has(d.tarefa_predecessora_id)) continue;
    const lista = sucessoras.get(d.tarefa_predecessora_id) ?? [];
    lista.push(d.tarefa_sucessora_id);
    sucessoras.set(d.tarefa_predecessora_id, lista);
  }

  // Tudo que vem DEPOIS desta tarefa. Se uma escolhida estiver aí, ligá-la
  // fecharia o laço.
  const alcancaveis = new Set<string>();
  const fila = [...(sucessoras.get(tarefaId) ?? [])];
  while (fila.length) {
    const atual = fila.pop()!;
    if (alcancaveis.has(atual)) continue;
    alcancaveis.add(atual);
    fila.push(...(sucessoras.get(atual) ?? []));
  }

  return predecessoraIds.some((id) => alcancaveis.has(id));
}

/**
 * Recalcula o cronograma depois de uma cópia entre obras.
 *
 * `recalcularCronograma` é interna a este arquivo — expor esta porta estreita
 * evita duplicar a lógica do CPM em `copiar-obra.ts` e mantém um único lugar
 * que sabe escrever as datas calculadas.
 */
export async function recalcularAposCopia(obraId: string): Promise<{ error: string | null }> {
  await requireRole("engenheiro");
  const supabase = await createClient();
  try {
    await recalcularCronograma(supabase, obraId);
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Não foi possível calcular o cronograma copiado.",
    };
  }
  revalidatePath(`/obras/${obraId}/cronograma`);
  return { error: null };
}

export async function criarTarefa(
  obraId: string,
  etapaId: string,
  _prevState: CronogramaFormState,
  formData: FormData
): Promise<CronogramaFormState> {
  await requireRole("engenheiro");

  // A predecessora agora é escolhida: uma caixa diz se existe, e um select diz
  // qual — sempre uma tarefa da mesma etapa.
  const temPredecessora = !!formData.get("tem_predecessora");
  const predecessoraId = temPredecessora
    ? ((formData.get("predecessora_id") as string | null) || "").trim()
    : "";
  const critica = !!formData.get("critica");

  const parsed = tarefaSchema.safeParse({
    nome: formData.get("nome"),
    duracao_dias: formData.get("duracao_dias"),
    restricao_inicio_nao_antes_de: formData.get("restricao_inicio_nao_antes_de") || undefined,
    orcamento_item_id: formData.get("orcamento_item_id") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  if (temPredecessora && !predecessoraId) {
    return { error: "Selecione qual tarefa precede esta." };
  }

  const supabase = await createClient();

  // A predecessora tem de ser desta etapa: o id vem do navegador, e tarefa de
  // outra frente de serviço criaria uma ligação que a tela não mostra.
  const { data: predecessora } = predecessoraId
    ? await supabase
        .from("cronograma_tarefas")
        .select("id, data_fim_cedo")
        .eq("id", predecessoraId)
        .eq("etapa_id", etapaId)
        .maybeSingle()
    : { data: null };

  if (predecessoraId && !predecessora) {
    return { error: "A tarefa predecessora não pertence a esta etapa." };
  }

  const vaiEncadear = !!predecessora;

  if (!vaiEncadear && !parsed.data.restricao_inicio_nao_antes_de) {
    return { error: "Informe a data de início dessa tarefa." };
  }

  // A duração vem digitada; o fim é o CPM que calcula, logo abaixo, a partir
  // dela e da predecessora. Era o contrário — ver a nota em `atualizarTarefa`.

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
      critica,
      ordem: (count ?? 0) + 1,
    })
    .select("id")
    .single();

  if (error || !novaTarefa) return { error: "Não foi possível criar a tarefa." };

  if (predecessora) await definirPredecessoras(supabase, novaTarefa.id, [predecessora.id]);

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

  // Depois do recálculo: é ele que apura a data de início de cada tarefa.
  await reordenarEtapaPorData(supabase, etapaId);

  revalidatePath(`/obras/${obraId}/cronograma`);
  revalidatePath(`/obras/${obraId}/avanco`);
  return { error: null, success: true };
}

/**
 * Remenda a corrente antes de tirar um elo dela.
 *
 * `cronograma_dependencias` cascateia: apagar a tarefa apaga as ligações em
 * que ela entrava, e as sucessoras dela ficam sem predecessora. Se também não
 * tiverem data própria, ficam SEM ÂNCORA — e aí o CPM não calcula mais nada,
 * em nenhuma etapa. Foi o que aconteceu de verdade nesta base: seis tarefas
 * do template foram apagadas, "Alvenaria do térreo" perdeu a predecessora, e
 * a partir daí toda criação de tarefa falhava com uma mensagem sobre uma
 * tarefa que não era a que o engenheiro estava criando.
 *
 * A sucessora herda a predecessora da que saiu. Não havendo predecessora,
 * herda a data de início dela — assim a sucessora não se move de lugar.
 */
async function remendarCorrente(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tarefaId: string
) {
  const [{ data: tarefa }, { data: entradas }, { data: saidas }] = await Promise.all([
    supabase
      .from("cronograma_tarefas")
      .select("data_inicio_cedo, restricao_inicio_nao_antes_de")
      .eq("id", tarefaId)
      .maybeSingle(),
    supabase
      .from("cronograma_dependencias")
      .select("tarefa_predecessora_id")
      .eq("tarefa_sucessora_id", tarefaId),
    supabase
      .from("cronograma_dependencias")
      .select("tarefa_sucessora_id")
      .eq("tarefa_predecessora_id", tarefaId),
  ]);

  const sucessoras = (saidas ?? []).map((d) => d.tarefa_sucessora_id);
  if (!sucessoras.length) return;

  const predecessora = entradas?.[0]?.tarefa_predecessora_id ?? null;

  if (predecessora) {
    await supabase.from("cronograma_dependencias").insert(
      sucessoras.map((sucessoraId) => ({
        tarefa_predecessora_id: predecessora,
        tarefa_sucessora_id: sucessoraId,
        tipo: "termino_inicio" as const,
        lag_dias: 0,
      }))
    );
    return;
  }

  const ancora = tarefa?.restricao_inicio_nao_antes_de ?? tarefa?.data_inicio_cedo ?? null;
  if (!ancora) return;

  // Só quem ficaria sem nada recebe a data; quem já tem a sua não é tocado.
  for (const sucessoraId of sucessoras) {
    const { data: suc } = await supabase
      .from("cronograma_tarefas")
      .select("restricao_inicio_nao_antes_de")
      .eq("id", sucessoraId)
      .maybeSingle();
    if (suc && !suc.restricao_inicio_nao_antes_de) {
      await supabase
        .from("cronograma_tarefas")
        .update({ restricao_inicio_nao_antes_de: ancora })
        .eq("id", sucessoraId);
    }
  }
}

/**
 * Remove várias tarefas de uma vez.
 *
 * Apagar uma a uma recalculava o cronograma inteiro a cada clique — com 130
 * tarefas, é meio minuto de espera para limpar o que o template trouxe a mais.
 * Aqui o recálculo acontece uma vez, no fim.
 *
 * Cada tarefa ainda passa pelo remendo da corrente, na ordem: sem isso, apagar
 * A e B de uma corrente A→B→C deixaria C sem âncora e travaria o CPM da obra
 * toda.
 */
export async function removerTarefas(
  obraId: string,
  tarefaIds: string[]
): Promise<{ error: string | null; removidas?: number }> {
  await requireRole("engenheiro");
  if (!tarefaIds.length) return { error: null, removidas: 0 };

  const supabase = await createClient();

  // Só tarefas desta obra: os ids vêm do navegador.
  const { data: daObra } = await supabase
    .from("cronograma_tarefas")
    .select("id, etapa_id")
    .eq("obra_id", obraId)
    .in("id", tarefaIds);

  if (!daObra?.length) return { error: "Nenhuma das tarefas pertence a esta obra." };

  for (const tarefa of daObra) {
    await remendarCorrente(supabase, tarefa.id);
    const { error } = await supabase
      .from("cronograma_tarefas")
      .delete()
      .eq("id", tarefa.id)
      .eq("obra_id", obraId);
    if (error) return { error: "Não foi possível remover todas as tarefas." };
  }

  try {
    await recalcularCronograma(supabase, obraId);
  } catch {
    // segue sem recalcular — o próximo ajuste tenta de novo
  }

  const etapas = [...new Set(daObra.map((t) => t.etapa_id))];
  await Promise.all(etapas.map((etapaId) => reordenarEtapaPorData(supabase, etapaId)));

  revalidatePath(`/obras/${obraId}/cronograma`);
  revalidatePath(`/obras/${obraId}/avanco`);
  return { error: null, removidas: daObra.length };
}

/**
 * Marca (ou desmarca) várias tarefas como críticas de uma vez.
 *
 * Existe porque o cronograma já nasce grande: o template entrega 130 tarefas e
 * a importação da planilha trouxe 132. Dizer quais são as críticas abrindo o
 * diálogo de cada uma, uma a uma, não é trabalho que alguém faça — e sem isso
 * a marcação manual seria um campo que ninguém preenche.
 *
 * Usa a MESMA seleção que já serve à exclusão em lote na tabela, e não recalcula
 * nada: criticidade não entra no CPM, então marcar não move data nenhuma.
 */
export async function marcarTarefasCriticas(
  obraId: string,
  tarefaIds: string[],
  critica: boolean
): Promise<{ error: string | null; marcadas?: number }> {
  await requireRole("engenheiro");
  if (!tarefaIds.length) return { error: null, marcadas: 0 };

  const supabase = await createClient();

  // `obra_id` no update, não só no `in`: os ids vêm do navegador, e sem o
  // filtro de obra um id de outra obra seria aceito.
  const { data, error } = await supabase
    .from("cronograma_tarefas")
    .update({ critica })
    .eq("obra_id", obraId)
    .in("id", tarefaIds)
    .select("id");

  if (error) return { error: "Não foi possível alterar a marcação das tarefas." };
  if (!data?.length) return { error: "Nenhuma das tarefas pertence a esta obra." };

  revalidatePath(`/obras/${obraId}/cronograma`);
  revalidatePath(`/obras/${obraId}/avanco`);
  return { error: null, marcadas: data.length };
}

export async function removerTarefa(
  obraId: string,
  tarefaId: string
): Promise<{ error: string | null }> {
  await requireRole("engenheiro");
  const supabase = await createClient();

  await remendarCorrente(supabase, tarefaId);

  // O erro era descartado: falhando, a tela dizia que tinha removido.
  const { error } = await supabase
    .from("cronograma_tarefas")
    .delete()
    .eq("id", tarefaId)
    // Sem isto, um id de outra obra seria aceito.
    .eq("obra_id", obraId);

  if (error) return { error: "Não foi possível remover a tarefa." };

  try {
    await recalcularCronograma(supabase, obraId);
  } catch {
    // segue sem recalcular — o próximo ajuste tenta de novo
  }
  revalidatePath(`/obras/${obraId}/cronograma`);
  revalidatePath(`/obras/${obraId}/avanco`);
  return { error: null };
}

const atualizarTarefaSchema = z.object({
  duracao_dias: z.coerce.number().int().positive("Duração deve ser maior que zero."),
  restricao_inicio_nao_antes_de: z.string().optional(),
  data_inicio_real: z.string().optional(),
});

export async function atualizarTarefa(
  obraId: string,
  tarefaId: string,
  _prevState: CronogramaFormState,
  formData: FormData
): Promise<CronogramaFormState> {
  await requireRole("engenheiro");

  const temPredecessora = !!formData.get("tem_predecessora");
  // `getAll`: o seletor manda um campo por predecessora escolhida.
  const predecessoraIds = temPredecessora
    ? formData.getAll("predecessora_id").map((v) => String(v).trim()).filter(Boolean)
    : [];
  const critica = !!formData.get("critica");

  const parsed = atualizarTarefaSchema.safeParse({
    duracao_dias: formData.get("duracao_dias"),
    restricao_inicio_nao_antes_de: formData.get("restricao_inicio_nao_antes_de") || undefined,
    data_inicio_real: formData.get("data_inicio_real") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  if (temPredecessora && !predecessoraIds.length) {
    return { error: "Selecione ao menos uma tarefa que precede esta." };
  }

  const supabase = await createClient();

  const { data: estaTarefa } = await supabase
    .from("cronograma_tarefas")
    .select("etapa_id")
    .eq("id", tarefaId)
    .eq("obra_id", obraId)
    .maybeSingle();

  if (!estaTarefa) return { error: "Tarefa não encontrada nesta obra." };

  /*
   * Predecessora pode ser de QUALQUER etapa da obra.
   *
   * Antes a tela só oferecia tarefas da mesma etapa e a ação recusava o resto.
   * Mas o encadeamento real atravessa etapas o tempo todo — "marcação das
   * paredes" espera o contrapiso (etapa 2) e a retirada do escoramento
   * (etapa 3). A restrição por etapa descrevia uma obra que não existe.
   */
  if (predecessoraIds.length) {
    const { data: candidatas } = await supabase
      .from("cronograma_tarefas")
      .select("id")
      .eq("obra_id", obraId)
      .in("id", predecessoraIds);

    if ((candidatas?.length ?? 0) !== new Set(predecessoraIds).size) {
      return { error: "Alguma das tarefas escolhidas não pertence a esta obra." };
    }

    if (await criariaCiclo(supabase, obraId, tarefaId, predecessoraIds)) {
      return {
        error:
          "Essa ligação criaria um ciclo: a tarefa escolhida já depende desta, direta ou indiretamente.",
      };
    }
  }

  const { error } = await supabase
    .from("cronograma_tarefas")
    .update({
      // A duração passou a ser DIGITADA, e o fim é que vira resultado.
      //
      // Era o contrário: pedia-se o fim previsto e a duração saía da contagem
      // de dias úteis entre início e fim. Com predecessora, o início é
      // calculado e some da tela — para dizer "isto leva 10 dias" o
      // engenheiro tinha de descobrir qual data final dava 10 dias úteis a
      // partir de um início que ele não via. Era a conta do sistema, feita
      // à mão.
      duracao_dias: parsed.data.duracao_dias,
      restricao_inicio_nao_antes_de: parsed.data.restricao_inicio_nao_antes_de || null,
      data_inicio_real: parsed.data.data_inicio_real || null,
      // Crítica é declaração do engenheiro, e sobrevive ao recálculo que vem
      // logo abaixo porque o CPM não escreve mais nessa coluna.
      critica,
      // `data_fim_real` não entra: ela é escrita pela tela de Avanço, quando o
      // percentual da tarefa chega a 100%. Dois caminhos para a mesma
      // conclusão faziam cronograma e avanço se contradizerem.
    })
    .eq("id", tarefaId);

  if (error) return { error: "Não foi possível atualizar a tarefa." };

  await definirPredecessoras(supabase, tarefaId, predecessoraIds);

  try {
    await recalcularCronograma(supabase, obraId);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Não foi possível recalcular o cronograma." };
  }

  await reordenarEtapaPorData(supabase, estaTarefa.etapa_id);

  revalidatePath(`/obras/${obraId}/cronograma`);
  revalidatePath(`/obras/${obraId}/avanco`);
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

/**
 * Importa as etapas do orçamento ATIVO para o cronograma.
 *
 * Só as etapas. Item de orçamento é serviço com quantidade e preço
 * ("ALVENARIA DE VEDACAO DE BLOCOS CERAMICOS 9X19X19"), não atividade de
 * cronograma — virar tarefa um a um encheria o cronograma de linhas que
 * ninguém planeja nesse nível. A etapa é que é a frente de trabalho.
 *
 * Só o orçamento ativo serve. Rascunho ainda muda, e cronograma montado em
 * cima de rascunho nasceria desalinhado do orçamento que de fato vale.
 *
 * Repetível: etapa que já existe no cronograma é pulada pelo nome. Assim,
 * quando uma revisão do orçamento acrescenta etapas, importar de novo traz só
 * as novas.
 */
export async function importarDoOrcamento(
  obraId: string
): Promise<{ error: string | null; criadas?: number; puladas?: number }> {
  await requireRole("engenheiro");
  const supabase = await createClient();

  const { data: versao } = await supabase
    .from("orcamento_versoes")
    .select("id, etapas")
    .eq("obra_id", obraId)
    .eq("status", "ativa")
    .maybeSingle();

  if (!versao) {
    return {
      error:
        "Esta obra não tem orçamento ativo. Ative o orçamento antes de importar — rascunho não serve, porque ainda vai mudar.",
    };
  }

  // Além da lista declarada na versão, considera as etapas que só aparecem nos
  // itens: orçamento vindo de planilha importada costuma ter etapa no item sem
  // nunca ter passado pelo botão "Nova etapa".
  const { data: itens } = await supabase
    .from("orcamento_itens")
    .select("etapa")
    .eq("orcamento_versao_id", versao.id)
    .not("etapa", "is", null);

  const doOrcamento: string[] = [...versao.etapas];
  for (const i of itens ?? []) {
    if (i.etapa && !doOrcamento.includes(i.etapa)) doOrcamento.push(i.etapa);
  }

  if (!doOrcamento.length) {
    return { error: "O orçamento ativo não tem etapas para importar." };
  }

  const { data: existentes } = await supabase
    .from("cronograma_etapas")
    .select("nome")
    .eq("obra_id", obraId);

  const jaTem = new Set((existentes ?? []).map((e) => e.nome));
  const novas = doOrcamento.filter((n) => !jaTem.has(n));

  if (!novas.length) {
    return { error: "Todas as etapas do orçamento ativo já estão no cronograma." };
  }

  let ordem = existentes?.length ?? 0;
  const { error } = await supabase
    .from("cronograma_etapas")
    .insert(novas.map((nome) => ({ obra_id: obraId, nome, ordem: ++ordem })));

  if (error) return { error: "Não foi possível criar as etapas." };

  // Sem recálculo: nenhuma tarefa mudou, e etapa vazia não entra na conta do
  // caminho crítico.
  revalidatePath(`/obras/${obraId}/cronograma`);
  return { error: null, criadas: novas.length, puladas: doOrcamento.length - novas.length };
}

/**
 * Aplica um template de cronograma.
 *
 * Qual template vem por parâmetro: há um por faixa de obra. As tarefas entram
 * encadeadas em sequência —
 * cada uma começa quando a anterior termina — porque o cálculo do caminho
 * crítico exige que toda tarefa tenha predecessora ou data de início.
 *
 * O encadeamento linear é ponto de partida, não verdade: na obra real várias
 * dessas tarefas correm em paralelo. O engenheiro solta o que for paralelo
 * depois, e o cronograma recalcula.
 */
export async function aplicarTemplateCronograma(
  obraId: string,
  templateId: string
): Promise<{ error: string | null; etapas?: number; tarefas?: number }> {
  await requireRole("engenheiro");

  const template = acharTemplate(templateId);
  if (!template) return { error: "Template não encontrado." };

  const supabase = await createClient();

  const { count: jaTem } = await supabase
    .from("cronograma_tarefas")
    .select("*", { count: "exact", head: true })
    .eq("obra_id", obraId);

  if (jaTem) {
    return {
      error:
        "Esta obra já tem tarefas no cronograma. O template monta a obra do zero — remova as tarefas antes, ou acrescente as que faltam à mão.",
    };
  }

  const { data: obra } = await supabase
    .from("obras")
    .select("data_inicio")
    .eq("id", obraId)
    .single();

  const inicio = obra?.data_inicio ?? new Date().toISOString().slice(0, 10);

  const { data: etapasExistentes } = await supabase
    .from("cronograma_etapas")
    .select("id, nome")
    .eq("obra_id", obraId);

  const porNome = new Map((etapasExistentes ?? []).map((e) => [e.nome, e.id]));
  let ordemEtapa = etapasExistentes?.length ?? 0;

  const faltando = template.etapas.filter((e) => !porNome.has(e.nome));
  if (faltando.length) {
    const { data: inseridas, error } = await supabase
      .from("cronograma_etapas")
      .insert(faltando.map((e) => ({ obra_id: obraId, nome: e.nome, ordem: ++ordemEtapa })))
      .select("id, nome");

    if (error || !inseridas) return { error: "Não foi possível criar as etapas." };
    for (const e of inseridas) porNome.set(e.nome, e.id);
  }

  let ordem = 0;
  const linhas = template.etapas.flatMap((etapa) =>
    etapa.tarefas.map((t) => ({
      obra_id: obraId,
      etapa_id: porNome.get(etapa.nome)!,
      nome: t.nome,
      duracao_dias: t.duracaoDias,
      ordem: ++ordem,
      // Só a primeira ganha data: as demais se penduram na anterior.
      restricao_inicio_nao_antes_de: ordem === 1 ? inicio : null,
    }))
  );

  const { data: criadas, error: erroTarefas } = await supabase
    .from("cronograma_tarefas")
    .insert(linhas)
    .select("id, ordem");

  if (erroTarefas || !criadas) return { error: "Não foi possível criar as tarefas." };

  const emOrdem = [...criadas].sort((a, b) => a.ordem - b.ordem);
  const dependencias = emOrdem.slice(1).map((t, i) => ({
    tarefa_predecessora_id: emOrdem[i].id,
    tarefa_sucessora_id: t.id,
    tipo: "termino_inicio" as const,
    lag_dias: 0,
  }));

  if (dependencias.length) {
    await supabase.from("cronograma_dependencias").insert(dependencias);
  }

  try {
    await recalcularCronograma(supabase, obraId);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Não foi possível recalcular o cronograma." };
  }

  revalidatePath(`/obras/${obraId}/cronograma`);
  return { error: null, etapas: template.etapas.length, tarefas: linhas.length };
}
