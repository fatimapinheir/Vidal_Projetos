"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { parseNumeroBR } from "@/lib/parse-numero-br";
import { normalizarUnidade } from "@/lib/orcamento/unidades";
import type { ItemPlanilha } from "@/components/upload/spreadsheet-upload-wizard";
import type { Database } from "@/lib/types/database.types";
import { ETAPAS_ORCAMENTO, TEMPLATE_RESIDENCIAL, type ParametrosObra } from "@/lib/orcamento/templates";

async function requireRascunho(supabase: Awaited<ReturnType<typeof createClient>>, versaoId: string) {
  const { data: versao } = await supabase
    .from("orcamento_versoes")
    .select("id, obra_id, status")
    .eq("id", versaoId)
    .single();

  if (!versao || versao.status !== "rascunho") {
    throw new Error("Essa versão do orçamento não pode mais ser editada (não é um rascunho).");
  }
  return versao;
}

export type CriarRascunhoState = { error: string | null };

/**
 * Garante que toda etapa citada chegue a `orcamento_versoes.etapas`.
 *
 * A etapa do orçamento vive em dois lugares: declarada no array da versão e
 * escrita em cada item. A tela desenha a união dos dois — mas só a declaração
 * sustenta uma etapa sem item. Sem este merge, etapa que existia apenas nos
 * itens desaparecia quando o último item saía, e no meio da montagem de um
 * orçamento isso é exatamente o que não pode acontecer: esvaziar uma etapa para
 * refazê-la é trabalho normal, não um pedido para apagá-la.
 *
 * Aditivo e idempotente: nunca remove nada, nunca duplica. Quem apaga etapa é
 * `removerEtapaOrcamento`, com o nome dito na mão.
 *
 * Devolve quantas entraram, para a tela poder dizer o que mudou.
 */
async function declararEtapas(
  supabase: Awaited<ReturnType<typeof createClient>>,
  versaoId: string,
  nomes: readonly string[]
): Promise<{ adicionadas: number; error: string | null }> {
  const limpos = [...new Set(nomes.map((n) => n.trim()).filter(Boolean))];
  if (!limpos.length) return { adicionadas: 0, error: null };

  const { data: versao } = await supabase
    .from("orcamento_versoes")
    .select("etapas")
    .eq("id", versaoId)
    .maybeSingle();

  if (!versao) return { adicionadas: 0, error: "Versão não encontrada." };

  const faltando = limpos.filter((nome) => !versao.etapas.includes(nome));
  if (!faltando.length) return { adicionadas: 0, error: null };

  const { error } = await supabase
    .from("orcamento_versoes")
    .update({ etapas: [...versao.etapas, ...faltando] })
    .eq("id", versaoId);

  if (error) return { adicionadas: 0, error: "Não foi possível registrar as etapas." };
  return { adicionadas: faltando.length, error: null };
}

export async function criarRascunho(
  obraId: string,
  _prevState: CriarRascunhoState,
  formData: FormData
): Promise<CriarRascunhoState> {
  const profile = await requireRole("engenheiro");
  const copiarDaAtiva = formData.get("copiar_da_ativa") === "on";

  /*
   * Sem título informado, a revisão ganha a data.
   *
   * O diálogo que pedia o título saiu, e sem isto toda revisão apareceria no
   * histórico como "Sem título" — com três ou quatro delas, não haveria como
   * saber qual é qual.
   */
  const tituloInformado = String(formData.get("titulo") ?? "").trim();
  const titulo =
    tituloInformado ||
    (copiarDaAtiva
      ? `Revisão de ${new Date().toLocaleDateString("pt-BR")}`
      : null);

  const supabase = await createClient();

  const { data: rascunhoExistente } = await supabase
    .from("orcamento_versoes")
    .select("id")
    .eq("obra_id", obraId)
    .eq("status", "rascunho")
    .maybeSingle();

  if (rascunhoExistente) {
    return { error: "Já existe um rascunho em andamento para essa obra." };
  }

  const { data: novaVersao, error: versaoError } = await supabase
    .from("orcamento_versoes")
    .insert({ obra_id: obraId, titulo, criado_por: profile.id })
    .select("id")
    .single();

  if (versaoError || !novaVersao) {
    return { error: "Não foi possível criar o rascunho." };
  }

  if (copiarDaAtiva) {
    const { data: ativa } = await supabase
      .from("orcamento_versoes")
      .select("id, etapas")
      .eq("obra_id", obraId)
      .eq("status", "ativa")
      .maybeSingle();

    if (ativa) {
      const { data: itensAtiva } = await supabase
        .from("orcamento_itens")
        // `tipo_item` faltava nesta lista, e por isso a cópia perdia a
        // categoria de cada item: editar o orçamento zerava material/serviço/
        // mão de obra em tudo.
        .select(
          "ordem, codigo_sinapi, descricao, unidade, quantidade, preco_unitario, etapa, tipo_item"
        )
        .eq("orcamento_versao_id", ativa.id)
        .order("ordem");

      if (itensAtiva?.length) {
        await supabase.from("orcamento_itens").insert(
          itensAtiva.map((item) => ({ ...item, orcamento_versao_id: novaVersao.id }))
        );
      }

      /*
       * As etapas da versão viajam junto com os itens.
       *
       * Só os itens eram copiados, e o array `etapas` do rascunho novo nascia
       * vazio. Resultado: o roteiro de etapas sumia, e no diálogo de editar
       * item o select de etapa listava apenas "Sem etapa" — como a etapa do
       * item não estava entre as opções, salvar apagava a etapa dele.
       *
       * Declara as da versão ativa mais as que aparecem nos itens copiados,
       * para o caso de a ativa também ter etapa só em item.
       */
      const etapasDosItens = (itensAtiva ?? [])
        .map((item) => item.etapa?.trim())
        .filter((nome): nome is string => !!nome);

      await declararEtapas(supabase, novaVersao.id, [...ativa.etapas, ...etapasDosItens]);
    }
  }

  revalidatePath(`/obras/${obraId}/orcamento`);
  redirect(`/obras/${obraId}/orcamento`);
}

/**
 * Número que chega escrito como o usuário vê: "20.000,00".
 *
 * O campo de preço passou a mostrar o valor formatado em reais, e
 * `z.coerce.number()` leria isso como NaN. `parseNumeroBR` já entende o
 * formato brasileiro, o americano e o número puro, então o mesmo schema serve
 * para o formulário, para a importação de planilha e para qualquer chamada
 * direta.
 */
const numeroBR = (mensagem: string) =>
  z.preprocess((v) => {
    const n = parseNumeroBR(v);
    // `undefined` deixa o zod reclamar do campo em vez de virar 0 calado.
    return n === null ? undefined : n;
  }, z.number({ message: mensagem }));

const itemManualSchema = z.object({
  codigo_sinapi: z.string().optional(),
  descricao: z.string().min(1, "Descreva o item."),
  unidade: z.string().min(1, "Informe a unidade."),
  quantidade: numeroBR("Quantidade inválida.").refine(
    (n) => n > 0,
    "Quantidade deve ser maior que zero."
  ),
  preco_unitario: numeroBR("Preço unitário inválido.").refine(
    (n) => n >= 0,
    "Preço unitário inválido."
  ),
  etapa: z.string().optional(),
  tipo_item: z.enum(["material", "servico", "mao_de_obra"]).optional(),
});

export type ItemOrcamentoState = { error: string | null; success?: boolean };

export async function adicionarItemOrcamento(
  obraId: string,
  versaoId: string,
  _prevState: ItemOrcamentoState,
  formData: FormData
): Promise<ItemOrcamentoState> {
  await requireRole("engenheiro");
  const supabase = await createClient();

  try {
    await requireRascunho(supabase, versaoId);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro ao validar a versão." };
  }

  const parsed = itemManualSchema.safeParse({
    codigo_sinapi: formData.get("codigo_sinapi") || undefined,
    descricao: formData.get("descricao"),
    unidade: formData.get("unidade"),
    quantidade: formData.get("quantidade"),
    preco_unitario: formData.get("preco_unitario"),
    etapa: formData.get("etapa") || undefined,
    tipo_item: formData.get("tipo_item") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const { count } = await supabase
    .from("orcamento_itens")
    .select("*", { count: "exact", head: true })
    .eq("orcamento_versao_id", versaoId);

  const { error } = await supabase.from("orcamento_itens").insert({
    orcamento_versao_id: versaoId,
    ordem: (count ?? 0) + 1,
    codigo_sinapi: parsed.data.codigo_sinapi || null,
    descricao: parsed.data.descricao,
    unidade: parsed.data.unidade,
    quantidade: parsed.data.quantidade,
    preco_unitario: parsed.data.preco_unitario,
    etapa: parsed.data.etapa || null,
    tipo_item: parsed.data.tipo_item ?? null,
  });

  if (error) return { error: "Não foi possível adicionar o item." };

  // Item que cita etapa garante a etapa no roteiro: é o que mantém o grupo na
  // tela depois, quando esse item for removido.
  if (parsed.data.etapa) await declararEtapas(supabase, versaoId, [parsed.data.etapa]);

  revalidatePath(`/obras/${obraId}/orcamento`);
  return { error: null, success: true };
}

export async function removerItemOrcamento(obraId: string, itemId: string) {
  await requireRole("engenheiro");
  const supabase = await createClient();

  const { data: item } = await supabase
    .from("orcamento_itens")
    .select("orcamento_versao_id, etapa")
    .eq("id", itemId)
    .single();

  if (!item) return;
  await requireRascunho(supabase, item.orcamento_versao_id);

  /*
   * Declara a etapa do item ANTES de apagá-lo.
   *
   * Montar orçamento é esvaziar e refazer etapa: tirar os itens que o template
   * trouxe e pôr os seus. Sem isto, remover o último item levava a etapa junto,
   * e o engenheiro perdia o lugar onde ia pôr os itens certos. Também conserta
   * de passagem os rascunhos antigos, cujas etapas vieram só nos itens.
   */
  if (item.etapa) await declararEtapas(supabase, item.orcamento_versao_id, [item.etapa]);

  const { error } = await supabase.from("orcamento_itens").delete().eq("id", itemId);
  if (error) throw new Error("Não foi possível remover o item.");

  revalidatePath(`/obras/${obraId}/orcamento`);
}

export async function ativarOrcamento(obraId: string, versaoId: string) {
  await requireRole("engenheiro");
  const supabase = await createClient();

  await requireRascunho(supabase, versaoId);

  const { count } = await supabase
    .from("orcamento_itens")
    .select("*", { count: "exact", head: true })
    .eq("orcamento_versao_id", versaoId);

  if (!count) {
    throw new Error("Adicione ao menos um item antes de ativar o orçamento.");
  }

  await supabase
    .from("orcamento_versoes")
    .update({ status: "substituida" })
    .eq("obra_id", obraId)
    .eq("status", "ativa");

  await supabase.from("orcamento_versoes").update({ status: "ativa" }).eq("id", versaoId);

  revalidatePath(`/obras/${obraId}/orcamento`);
  revalidatePath(`/obras/${obraId}`);
  revalidatePath(`/portal/obras/${obraId}`);
}

export async function descartarRascunho(obraId: string, versaoId: string) {
  await requireRole("engenheiro");
  const supabase = await createClient();
  await requireRascunho(supabase, versaoId);

  // O erro era descartado aqui. Falhando, o rascunho continuava de pé e a tela
  // dizia que tinha ido — o próximo "criar rascunho" recusava com "já existe um
  // rascunho" e ninguém ligava uma coisa à outra.
  const { error } = await supabase.from("orcamento_versoes").delete().eq("id", versaoId);
  if (error) throw new Error("Não foi possível descartar o rascunho.");

  revalidatePath(`/obras/${obraId}/orcamento`);
}

const itemImportSchema = z.object({
  etapa: z.string().optional(),
  codigo_sinapi: z.string().optional(),
  descricao: z.string().min(1),
  unidade: z.string().min(1),
  quantidade: z.number(),
  preco_unitario: z.number(),
});

export async function importarPlanilhaParaRascunho(
  obraId: string,
  versaoId: string,
  params: {
    itens: ItemPlanilha[];
    mapeamento: { linha_cabecalho: number; mapa_colunas: Record<string, number> };
    /** Caminho no bucket `orcamentos` — o navegador já enviou o arquivo. */
    arquivoPath: string;
  }
): Promise<{ error: string | null }> {
  await requireRole("engenheiro");
  const supabase = await createClient();

  try {
    await requireRascunho(supabase, versaoId);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro ao validar a versão." };
  }

  const itens = z.array(itemImportSchema).safeParse(params.itens);
  if (!itens.success || !itens.data.length) {
    return { error: "Nenhum item válido para importar." };
  }

  await supabase
    .from("orcamento_versoes")
    .update({ arquivo_original_path: params.arquivoPath })
    .eq("id", versaoId);

  const { count } = await supabase
    .from("orcamento_itens")
    .select("*", { count: "exact", head: true })
    .eq("orcamento_versao_id", versaoId);

  const { error: itensError } = await supabase.from("orcamento_itens").insert(
    itens.data.map((item, i) => ({
      orcamento_versao_id: versaoId,
      ordem: (count ?? 0) + i + 1,
      codigo_sinapi: item.codigo_sinapi || null,
      descricao: item.descricao,
      // Unidade na grafia da SINAPI quando reconhecível; a original quando
      // não. Sem isto, cada planilha importada acrescenta uma variação nova
      // ("m²", "m2", "M2") e a busca de composição, que casa unidade por
      // igualdade exata, deixa de encontrar o item.
      unidade: normalizarUnidade(item.unidade) ?? item.unidade,
      quantidade: item.quantidade,
      preco_unitario: item.preco_unitario,
      etapa: item.etapa?.trim() || null,
    }))
  );

  if (itensError) {
    return { error: "Não foi possível salvar os itens importados." };
  }

  /*
   * A etapa da planilha não era importada: a coluna nem existia no assistente,
   * e o insert não gravava o campo. Uma planilha organizada por etapa entrava
   * inteira em "Sem etapa", e o engenheiro tinha de reclassificar item por
   * item.
   *
   * Declara também na versão, pela mesma razão de sempre: etapa que existe só
   * no item desaparece quando o último item dela sai.
   */
  const etapasDaPlanilha = itens.data
    .map((item) => item.etapa?.trim())
    .filter((nome): nome is string => !!nome);

  if (etapasDaPlanilha.length) {
    await declararEtapas(supabase, versaoId, etapasDaPlanilha);
  }

  await supabase.from("orcamento_mapeamentos").upsert({
    obra_id: obraId,
    linha_cabecalho: params.mapeamento.linha_cabecalho,
    mapa_colunas: params.mapeamento.mapa_colunas,
    updated_at: new Date().toISOString(),
  });

  revalidatePath(`/obras/${obraId}/orcamento`);
  redirect(`/obras/${obraId}/orcamento`);
}

/**
 * Aplica um template ao rascunho do orçamento.
 *
 * Dois modos. `etapas` cria só o esqueleto da obra — uma linha por etapa, sem
 * quantidade nem preço, para o engenheiro preencher sabendo o que não pode
 * esquecer. `servicos` cria o esqueleto já com os serviços típicos de cada
 * etapa, quantidade estimada pela área e preço vindo da SINAPI.
 *
 * O preço nunca é inventado: ou vem de uma composição encontrada na tabela
 * ativa, ou entra zerado com o item marcado para o engenheiro resolver. Preço
 * chutado num orçamento é pior que preço ausente — ausente se vê, chutado não.
 */
export async function aplicarTemplateOrcamento(
  obraId: string,
  versaoId: string,
  modo: "etapas" | "servicos"
): Promise<{ error: string | null; criados?: number; semPreco?: number; etapasAdicionadas?: number }> {
  await requireRole("engenheiro");
  const supabase = await createClient();

  try {
    await requireRascunho(supabase, versaoId);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro ao validar a versão." };
  }

  const { data: obra } = await supabase
    .from("obras")
    .select("metragem_quadrada, quartos, suites, banheiros")
    .eq("id", obraId)
    .single();

  const area = obra?.metragem_quadrada ?? 0;
  if (modo === "servicos" && area <= 0) {
    return {
      error:
        "Informe a metragem quadrada no cadastro da obra antes de usar este template — é dela que saem as quantidades.",
    };
  }

  const parametros: ParametrosObra = {
    area,
    quartos: obra?.quartos ?? 0,
    suites: obra?.suites ?? 0,
    banheiros: obra?.banheiros ?? 0,
  };

  const { count } = await supabase
    .from("orcamento_itens")
    .select("*", { count: "exact", head: true })
    .eq("orcamento_versao_id", versaoId);

  let ordem = count ?? 0;
  const linhas: Database["public"]["Tables"]["orcamento_itens"]["Insert"][] = [];

  if (modo === "etapas") {
    // Nenhum item: a etapa vazia existe por si, declarada na versão.
    const { adicionadas, error } = await declararEtapas(supabase, versaoId, ETAPAS_ORCAMENTO);
    if (error) return { error };

    revalidatePath(`/obras/${obraId}/orcamento`);
    return { error: null, criados: 0, etapasAdicionadas: adicionadas };
  }

  // Modo serviços: procura cada composição na tabela SINAPI ativa.
  const { data: tabelaAtiva } = await supabase
    .from("sinapi_tabelas")
    .select("id")
    .eq("status", "ativa")
    .maybeSingle();

  let semPreco = 0;

  for (const etapa of TEMPLATE_RESIDENCIAL) {
    for (const servico of etapa.servicos) {
      let encontrado: { codigo: string; descricao: string; unidade: string; preco_unitario: number } | null =
        null;

      /*
       * Duas travas na busca, e as duas foram necessárias.
       *
       * `ilike %termo%` solto casava qualquer linha que contivesse aquelas
       * letras: "FORMA" achava "BANCADA ... FORMATO L", "ARMACAO" achava um
       * aditivo, "JANELA" achava uma borboleta de janela. Preço errado dentro
       * de um orçamento é pior que preço faltando — faltando se vê.
       *
       * 1. Prefixo, não contém: composição da SINAPI começa pelo nome do
       *    serviço ("ALVENARIA DE VEDACAO DE BLOCOS..."), então o termo tem de
       *    abrir a descrição.
       * 2. Unidade tem de bater: serviço medido em M2 não pode casar com item
       *    vendido em UN. Essa trava sozinha derruba quase todo falso positivo.
       *
       * Ordena por código só para ser determinístico — várias composições
       * atendem ao mesmo termo, e a escolha final é do engenheiro, que revisa
       * item a item antes de ativar.
       */
      if (tabelaAtiva) {
        for (const termo of servico.busca) {
          const { data } = await supabase
            .from("sinapi_itens")
            .select("codigo, descricao, unidade, preco_unitario")
            .eq("sinapi_tabela_id", tabelaAtiva.id)
            .eq("unidade", servico.unidade)
            .ilike("descricao", `${termo}%`)
            .order("codigo")
            .limit(1);

          if (data?.length) {
            encontrado = data[0];
            break;
          }
        }
      }

      if (!encontrado) semPreco++;

      linhas.push({
        orcamento_versao_id: versaoId,
        ordem: ++ordem,
        codigo_sinapi: encontrado?.codigo ?? null,
        descricao: encontrado?.descricao ?? servico.descricao,
        unidade: encontrado?.unidade ?? servico.unidade,
        quantidade: servico.calcular(parametros),
        preco_unitario: encontrado?.preco_unitario ?? 0,
        etapa: etapa.nome,
      });
    }
  }

  const { error } = await supabase.from("orcamento_itens").insert(linhas);
  if (error) return { error: "Não foi possível aplicar o template." };

  /*
   * Declara a lista inteira — a MESMA do modo "etapas".
   *
   * É o que faz a diferença entre os dois templates ser apenas os itens: o
   * roteiro de etapas é um só, e o template de serviços preenche parte dele.
   * Antes cada modo declarava uma lista própria (22 em maiúsculas contra 12
   * numeradas, sem um nome em comum), e aplicar os dois no mesmo rascunho
   * somava 34 grupos — com cara de dois orçamentos embaralhados. Pior: os 12
   * usados pelos itens não eram declarados, então apagar o último item de uma
   * etapa fazia a etapa desaparecer.
   */
  const { adicionadas, error: erroEtapas } = await declararEtapas(
    supabase,
    versaoId,
    ETAPAS_ORCAMENTO
  );
  if (erroEtapas) return { error: erroEtapas };

  revalidatePath(`/obras/${obraId}/orcamento`);
  return { error: null, criados: linhas.length, semPreco, etapasAdicionadas: adicionadas };
}

/**
 * Edita um item do rascunho.
 *
 * Faltava: até aqui só dava para adicionar e remover, então corrigir uma
 * quantidade significava apagar a linha e digitar tudo de novo — justo no
 * fluxo em que o template entrega 33 linhas para conferir uma a uma.
 */
export async function atualizarItemOrcamento(
  obraId: string,
  itemId: string,
  _prevState: ItemOrcamentoState,
  formData: FormData
): Promise<ItemOrcamentoState> {
  await requireRole("engenheiro");
  const supabase = await createClient();

  const { data: item } = await supabase
    .from("orcamento_itens")
    .select("orcamento_versao_id")
    .eq("id", itemId)
    .single();

  if (!item) return { error: "Item não encontrado." };

  try {
    await requireRascunho(supabase, item.orcamento_versao_id);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro ao validar a versão." };
  }

  const parsed = itemManualSchema.safeParse({
    codigo_sinapi: formData.get("codigo_sinapi") || undefined,
    descricao: formData.get("descricao"),
    unidade: formData.get("unidade"),
    quantidade: formData.get("quantidade"),
    preco_unitario: formData.get("preco_unitario"),
    etapa: formData.get("etapa") || undefined,
    tipo_item: formData.get("tipo_item") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const { error } = await supabase
    .from("orcamento_itens")
    .update({
      codigo_sinapi: parsed.data.codigo_sinapi || null,
      descricao: parsed.data.descricao,
      unidade: parsed.data.unidade,
      quantidade: parsed.data.quantidade,
      preco_unitario: parsed.data.preco_unitario,
      etapa: parsed.data.etapa || null,
      tipo_item: parsed.data.tipo_item ?? null,
    })
    .eq("id", itemId);

  if (error) return { error: "Não foi possível salvar o item." };

  // Mover um item para uma etapa que só existia em outro item registra a etapa.
  if (parsed.data.etapa) {
    await declararEtapas(supabase, item.orcamento_versao_id, [parsed.data.etapa]);
  }

  revalidatePath(`/obras/${obraId}/orcamento`);
  return { error: null, success: true };
}

/** Acrescenta uma etapa vazia ao rascunho. */
export async function adicionarEtapaOrcamento(
  obraId: string,
  versaoId: string,
  nome: string
): Promise<{ error: string | null }> {
  await requireRole("engenheiro");
  const supabase = await createClient();

  const limpo = nome.trim();
  if (!limpo) return { error: "Informe o nome da etapa." };

  const { data: versao } = await supabase
    .from("orcamento_versoes")
    .select("etapas")
    .eq("id", versaoId)
    .single();

  if (!versao) return { error: "Versão não encontrada." };
  if (versao.etapas.includes(limpo)) return { error: "Essa etapa já existe." };

  const { error } = await supabase
    .from("orcamento_versoes")
    .update({ etapas: [...versao.etapas, limpo] })
    .eq("id", versaoId);

  if (error) return { error: "Não foi possível criar a etapa." };

  revalidatePath(`/obras/${obraId}/orcamento`);
  return { error: null };
}

/**
 * Remove uma etapa do roteiro.
 *
 * Só remove a etapa vazia. Com item dentro, apagar silenciosamente deixaria
 * os itens órfãos num grupo "Sem etapa" — quem quer isso move os itens antes,
 * de propósito.
 */
export async function removerEtapaOrcamento(
  obraId: string,
  versaoId: string,
  nome: string
): Promise<{ error: string | null }> {
  await requireRole("engenheiro");
  const supabase = await createClient();

  const { count } = await supabase
    .from("orcamento_itens")
    .select("*", { count: "exact", head: true })
    .eq("orcamento_versao_id", versaoId)
    .eq("etapa", nome);

  if (count) {
    return { error: `A etapa "${nome}" ainda tem ${count} item(ns). Remova ou mova os itens antes.` };
  }

  const { data: versao } = await supabase
    .from("orcamento_versoes")
    .select("etapas")
    .eq("id", versaoId)
    .single();

  if (!versao) return { error: "Versão não encontrada." };

  const { error } = await supabase
    .from("orcamento_versoes")
    .update({ etapas: versao.etapas.filter((e) => e !== nome) })
    .eq("id", versaoId);

  if (error) return { error: "Não foi possível remover a etapa." };

  revalidatePath(`/obras/${obraId}/orcamento`);
  return { error: null };
}
