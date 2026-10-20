"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export type CopiaResultado = {
  error: string | null;
  itens?: number;
  etapasOrcamento?: number;
  etapasCronograma?: number;
  tarefas?: number;
  dependencias?: number;
};

/** Obras que podem servir de origem, com o que cada uma tem para copiar. */
export type ObraOrigem = {
  id: string;
  nome: string;
  itensOrcamento: number;
  tarefasCronograma: number;
};

export async function listarObrasParaCopia(destinoId: string): Promise<ObraOrigem[]> {
  await requireRole("engenheiro");
  const supabase = await createClient();

  const { data: obras } = await supabase
    .from("obras")
    .select("id, nome")
    .neq("id", destinoId)
    .order("created_at", { ascending: false });

  if (!obras?.length) return [];

  const resultado: ObraOrigem[] = [];
  for (const obra of obras) {
    const [{ data: versao }, { count: tarefas }] = await Promise.all([
      supabase
        .from("orcamento_versoes")
        .select("id")
        .eq("obra_id", obra.id)
        .eq("status", "ativa")
        .maybeSingle(),
      supabase
        .from("cronograma_tarefas")
        .select("id", { count: "exact", head: true })
        .eq("obra_id", obra.id),
    ]);

    const { count: itens } = versao
      ? await supabase
          .from("orcamento_itens")
          .select("id", { count: "exact", head: true })
          .eq("orcamento_versao_id", versao.id)
      : { count: 0 };

    // Obra sem nada não aparece na lista: não há o que copiar dela.
    if ((itens ?? 0) === 0 && (tarefas ?? 0) === 0) continue;

    resultado.push({
      id: obra.id,
      nome: obra.nome,
      itensOrcamento: itens ?? 0,
      tarefasCronograma: tarefas ?? 0,
    });
  }

  return resultado;
}

function somarDias(dataIso: string, dias: number): string {
  const data = new Date(`${dataIso}T00:00:00Z`);
  data.setUTCDate(data.getUTCDate() + dias);
  return data.toISOString().slice(0, 10);
}

function diasEntre(deIso: string, ateIso: string): number {
  const de = new Date(`${deIso}T00:00:00Z`).getTime();
  const ate = new Date(`${ateIso}T00:00:00Z`).getTime();
  return Math.round((ate - de) / 86_400_000);
}

/**
 * Copia o orçamento ATIVO da origem para um RASCUNHO no destino.
 *
 * Rascunho, e nunca direto para ativo: orçamento de outra obra é ponto de
 * partida, não resposta. Preço, quantidade e escopo mudam entre obras, e o
 * engenheiro precisa revisar antes de o cliente ver.
 *
 * As quantidades vão como estão. Recalculá-las pela metragem do destino seria
 * tentador e errado — elas vieram de um orçamento real, não de uma fórmula, e
 * ajustar na régua da área produziria números com cara de precisos que
 * ninguém conferiu.
 */
async function copiarOrcamento(
  supabase: SupabaseClient,
  origemId: string,
  destinoId: string,
  perfilId: string
): Promise<{ error: string } | { itens: number; etapas: number }> {
  const { data: rascunhoExistente } = await supabase
    .from("orcamento_versoes")
    .select("id")
    .eq("obra_id", destinoId)
    .eq("status", "rascunho")
    .maybeSingle();

  if (rascunhoExistente) {
    return { error: "A obra de destino já tem um rascunho de orçamento em andamento." };
  }

  const { data: versaoOrigem } = await supabase
    .from("orcamento_versoes")
    .select("id, titulo, etapas")
    .eq("obra_id", origemId)
    .eq("status", "ativa")
    .maybeSingle();

  if (!versaoOrigem) return { error: "A obra de origem não tem orçamento ativo." };

  const { data: itens } = await supabase
    .from("orcamento_itens")
    .select("ordem, codigo_sinapi, descricao, unidade, quantidade, preco_unitario, etapa, tipo_item")
    .eq("orcamento_versao_id", versaoOrigem.id)
    .order("ordem");

  const { data: nova, error: erroVersao } = await supabase
    .from("orcamento_versoes")
    .insert({
      obra_id: destinoId,
      titulo: `Copiado de ${versaoOrigem.titulo ?? "outra obra"}`,
      // `etapas` viaja junto: sem ela o roteiro some e etapa esvaziada
      // desaparece da tela.
      etapas: versaoOrigem.etapas,
      criado_por: perfilId,
    })
    .select("id")
    .single();

  if (erroVersao || !nova) return { error: "Não foi possível criar o rascunho no destino." };

  if (itens?.length) {
    const { error } = await supabase
      .from("orcamento_itens")
      .insert(itens.map((item) => ({ ...item, orcamento_versao_id: nova.id })));
    if (error) return { error: "Não foi possível copiar os itens do orçamento." };
  }

  return { itens: itens?.length ?? 0, etapas: versaoOrigem.etapas.length };
}

/**
 * Copia etapas, tarefas e dependências do cronograma, deslocando as datas.
 *
 * Três armadilhas, e as três precisam de mapa de ids:
 *
 * - `cronograma_tarefas.etapa_id` aponta para a etapa da ORIGEM;
 * - `cronograma_dependencias` aponta para tarefas da ORIGEM;
 * - `cronograma_tarefas.orcamento_item_id` aponta para um item do orçamento da
 *   ORIGEM — esse não se remapeia, zera. O vínculo com o orçamento é escolha
 *   de quem monta a obra nova.
 *
 * As datas não vão como estão: a obra nova começa em outro dia. Toda âncora é
 * deslocada pelo mesmo número de dias, o que preserva o espaçamento entre
 * frentes que começam em datas diferentes. O resto (início/fim calculados,
 * linha de base, datas reais, folga, criticidade) nasce vazio — é o CPU do
 * destino que apura, no recálculo ao fim.
 */
async function copiarCronograma(
  supabase: SupabaseClient,
  origemId: string,
  destinoId: string,
  novoInicioIso: string
): Promise<{ error: string } | { etapas: number; tarefas: number; dependencias: number }> {
  const { count: jaTem } = await supabase
    .from("cronograma_etapas")
    .select("id", { count: "exact", head: true })
    .eq("obra_id", destinoId);

  if (jaTem) {
    return { error: "A obra de destino já tem cronograma. Remova as etapas dela antes de copiar." };
  }

  const [{ data: etapas }, { data: tarefas }] = await Promise.all([
    supabase.from("cronograma_etapas").select("id, nome, ordem").eq("obra_id", origemId).order("ordem"),
    supabase
      .from("cronograma_tarefas")
      .select("id, etapa_id, nome, duracao_dias, restricao_inicio_nao_antes_de, data_inicio_cedo, critica, ordem")
      .eq("obra_id", origemId)
      .order("ordem"),
  ]);

  if (!etapas?.length) return { error: "A obra de origem não tem cronograma." };

  // Deslocamento: do primeiro dia que a origem começa até o novo início.
  const primeirasDatas = (tarefas ?? [])
    .map((t) => t.restricao_inicio_nao_antes_de ?? t.data_inicio_cedo)
    .filter((d): d is string => !!d)
    .sort();
  const deslocamento = primeirasDatas.length ? diasEntre(primeirasDatas[0], novoInicioIso) : 0;

  const { data: etapasNovas, error: erroEtapas } = await supabase
    .from("cronograma_etapas")
    .insert(etapas.map((e) => ({ obra_id: destinoId, nome: e.nome, ordem: e.ordem })))
    .select("id, nome, ordem");

  if (erroEtapas || !etapasNovas) return { error: "Não foi possível copiar as etapas." };

  // Casa pela ordem, que é única dentro da obra e foi preservada no insert.
  const etapaNovaPorOrdem = new Map<number, string>(etapasNovas.map((e) => [e.ordem, e.id]));
  const mapaEtapas = new Map<string, string>();
  for (const etapa of etapas) {
    const nova = etapaNovaPorOrdem.get(etapa.ordem);
    if (nova) mapaEtapas.set(etapa.id, nova);
  }
  if (mapaEtapas.size !== etapas.length) {
    return { error: "Não foi possível relacionar as etapas copiadas." };
  }

  if (!tarefas?.length) {
    return { etapas: etapas.length, tarefas: 0, dependencias: 0 };
  }

  const { data: tarefasNovas, error: erroTarefas } = await supabase
    .from("cronograma_tarefas")
    .insert(
      tarefas.map((t) => ({
        obra_id: destinoId,
        etapa_id: mapaEtapas.get(t.etapa_id)!,
        nome: t.nome,
        duracao_dias: t.duracao_dias,
        ordem: t.ordem,
        // A criticidade vem junto: desde a migração 0065 ela é decisão de
        // planejamento tomada à mão, igual à duração. Como o CPM não a
        // recalcula mais, sem copiar aqui a obra nova nasceria sem nenhuma.
        critica: t.critica,
        restricao_inicio_nao_antes_de: t.restricao_inicio_nao_antes_de
          ? somarDias(t.restricao_inicio_nao_antes_de, deslocamento)
          : null,
      }))
    )
    .select("id, etapa_id, nome, ordem");

  if (erroTarefas || !tarefasNovas) return { error: "Não foi possível copiar as tarefas." };

  // (etapa nova + ordem) identifica a tarefa sem depender do nome, que pode
  // se repetir entre etapas ("Limpeza final", por exemplo).
  const chave = (etapaId: string, ordem: number) => `${etapaId}|${ordem}`;
  const novaPorChave = new Map(tarefasNovas.map((t) => [chave(t.etapa_id, t.ordem), t.id]));
  const mapaTarefas = new Map<string, string>();
  for (const t of tarefas) {
    const nova = novaPorChave.get(chave(mapaEtapas.get(t.etapa_id)!, t.ordem));
    if (nova) mapaTarefas.set(t.id, nova);
  }

  const idsOrigem = tarefas.map((t) => t.id);
  const { data: dependencias } = await supabase
    .from("cronograma_dependencias")
    .select("tarefa_predecessora_id, tarefa_sucessora_id, tipo, lag_dias")
    .in("tarefa_sucessora_id", idsOrigem);

  const paraInserir = (dependencias ?? [])
    .map((d) => {
      const pred = mapaTarefas.get(d.tarefa_predecessora_id);
      const suc = mapaTarefas.get(d.tarefa_sucessora_id);
      if (!pred || !suc) return null;
      return {
        tarefa_predecessora_id: pred,
        tarefa_sucessora_id: suc,
        tipo: d.tipo,
        lag_dias: d.lag_dias,
      };
    })
    .filter((d): d is NonNullable<typeof d> => d !== null);

  if (paraInserir.length) {
    const { error } = await supabase.from("cronograma_dependencias").insert(paraInserir);
    if (error) return { error: "Não foi possível copiar as dependências entre tarefas." };
  }

  return {
    etapas: etapas.length,
    tarefas: tarefasNovas.length,
    dependencias: paraInserir.length,
  };
}

/**
 * Copia orçamento e/ou cronograma de uma obra para outra.
 *
 * Existe porque construtora repete projeto: a segunda casa do mesmo padrão
 * reaproveita 90% do orçamento e quase todo o cronograma, e remontar 227 itens
 * e 130 tarefas à mão não é trabalho, é desperdício.
 */
export async function copiarDeOutraObra(
  destinoId: string,
  entrada: {
    origemId: string;
    copiarOrcamento: boolean;
    copiarCronograma: boolean;
    inicioCronograma?: string;
  }
): Promise<CopiaResultado> {
  const perfil = await requireRole("engenheiro");

  if (entrada.origemId === destinoId) {
    return { error: "A obra de origem e a de destino são a mesma." };
  }
  if (!entrada.copiarOrcamento && !entrada.copiarCronograma) {
    return { error: "Escolha o que copiar: orçamento, cronograma, ou os dois." };
  }
  if (entrada.copiarCronograma && !entrada.inicioCronograma) {
    return { error: "Informe a data de início do cronograma na obra nova." };
  }

  const supabase = await createClient();

  const resultado: CopiaResultado = { error: null };

  if (entrada.copiarOrcamento) {
    const r = await copiarOrcamento(supabase, entrada.origemId, destinoId, perfil.id);
    if ("error" in r) return { error: r.error };
    resultado.itens = r.itens;
    resultado.etapasOrcamento = r.etapas;
  }

  if (entrada.copiarCronograma) {
    const r = await copiarCronograma(
      supabase,
      entrada.origemId,
      destinoId,
      entrada.inicioCronograma!
    );
    if ("error" in r) return { error: r.error };
    resultado.etapasCronograma = r.etapas;
    resultado.tarefas = r.tarefas;
    resultado.dependencias = r.dependencias;

    // O recálculo roda com o cronograma já inteiro no destino.
    const { recalcularAposCopia } = await import("@/app/actions/cronograma");
    await recalcularAposCopia(destinoId);
  }

  revalidatePath(`/obras/${destinoId}/orcamento`);
  revalidatePath(`/obras/${destinoId}/cronograma`);
  revalidatePath(`/obras/${destinoId}/avanco`);
  revalidatePath(`/obras/${destinoId}`);
  return resultado;
}
