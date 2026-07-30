"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import type { ItemPlanilha } from "@/components/upload/spreadsheet-upload-wizard";

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

export async function criarRascunho(
  obraId: string,
  _prevState: CriarRascunhoState,
  formData: FormData
): Promise<CriarRascunhoState> {
  const profile = await requireRole("engenheiro");
  const titulo = String(formData.get("titulo") ?? "") || null;
  const copiarDaAtiva = formData.get("copiar_da_ativa") === "on";

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
      .select("id")
      .eq("obra_id", obraId)
      .eq("status", "ativa")
      .maybeSingle();

    if (ativa) {
      const { data: itensAtiva } = await supabase
        .from("orcamento_itens")
        .select("ordem, codigo_sinapi, descricao, unidade, quantidade, preco_unitario, etapa")
        .eq("orcamento_versao_id", ativa.id)
        .order("ordem");

      if (itensAtiva?.length) {
        await supabase.from("orcamento_itens").insert(
          itensAtiva.map((item) => ({ ...item, orcamento_versao_id: novaVersao.id }))
        );
      }
    }
  }

  revalidatePath(`/obras/${obraId}/orcamento`);
  redirect(`/obras/${obraId}/orcamento`);
}

const itemManualSchema = z.object({
  codigo_sinapi: z.string().optional(),
  descricao: z.string().min(1, "Descreva o item."),
  unidade: z.string().min(1, "Informe a unidade."),
  quantidade: z.coerce.number().positive("Quantidade deve ser maior que zero."),
  preco_unitario: z.coerce.number().min(0, "Preço unitário inválido."),
  etapa: z.string().optional(),
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
  });

  if (error) return { error: "Não foi possível adicionar o item." };

  revalidatePath(`/obras/${obraId}/orcamento`);
  return { error: null, success: true };
}

export async function removerItemOrcamento(obraId: string, itemId: string) {
  await requireRole("engenheiro");
  const supabase = await createClient();

  const { data: item } = await supabase
    .from("orcamento_itens")
    .select("orcamento_versao_id")
    .eq("id", itemId)
    .single();

  if (!item) return;
  await requireRascunho(supabase, item.orcamento_versao_id);

  await supabase.from("orcamento_itens").delete().eq("id", itemId);
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
  await supabase.from("orcamento_versoes").delete().eq("id", versaoId);
  revalidatePath(`/obras/${obraId}/orcamento`);
}

const itemImportSchema = z.object({
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
      unidade: item.unidade,
      quantidade: item.quantidade,
      preco_unitario: item.preco_unitario,
    }))
  );

  if (itensError) {
    return { error: "Não foi possível salvar os itens importados." };
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
