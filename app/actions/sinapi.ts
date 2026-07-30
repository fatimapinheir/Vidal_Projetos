"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import type { ItemPlanilha } from "@/components/upload/spreadsheet-upload-wizard";

const itemSchema = z.object({
  codigo_sinapi: z.string().optional(),
  descricao: z.string().min(1),
  unidade: z.string().min(1),
  quantidade: z.number(),
  preco_unitario: z.number(),
});

export type SinapiUploadState = { error: string | null };

export async function ativarNovaTabelaSinapi(params: {
  itens: ItemPlanilha[];
  mapeamento: { linha_cabecalho: number; mapa_colunas: Record<string, number> };
  /** Caminho no bucket `sinapi` — o navegador já enviou o arquivo. */
  arquivoPath: string;
  mesReferencia?: string;
}): Promise<SinapiUploadState> {
  const profile = await requireRole("engenheiro");

  const itens = z.array(itemSchema).safeParse(params.itens);
  if (!itens.success || !itens.data.length || !params.mesReferencia) {
    return { error: "Dados incompletos. Refaça o upload." };
  }

  const supabase = await createClient();

  await supabase.from("sinapi_tabelas").update({ status: "substituida" }).eq("status", "ativa");

  const { data: tabela, error: tabelaError } = await supabase
    .from("sinapi_tabelas")
    .insert({
      mes_referencia: params.mesReferencia,
      arquivo_original_path: params.arquivoPath,
      criado_por: profile.id,
    })
    .select("id")
    .single();

  if (tabelaError || !tabela) {
    return { error: "Já existe uma tabela SINAPI para esse mês, ou houve um erro ao criar a versão." };
  }

  const { error: itensError } = await supabase.from("sinapi_itens").insert(
    itens.data.map((item) => ({
      sinapi_tabela_id: tabela.id,
      codigo: item.codigo_sinapi || "",
      descricao: item.descricao,
      unidade: item.unidade,
      preco_unitario: item.preco_unitario,
    }))
  );

  if (itensError) {
    return { error: "Tabela criada, mas houve erro ao salvar os itens." };
  }

  await supabase.from("sinapi_mapeamento").upsert({
    id: true,
    linha_cabecalho: params.mapeamento.linha_cabecalho,
    mapa_colunas: params.mapeamento.mapa_colunas,
    updated_at: new Date().toISOString(),
  });

  revalidatePath("/sinapi");
  redirect("/sinapi");
}

const buscaSchema = z.object({ termo: z.string().min(2) });

export async function buscarSinapi(termo: string) {
  await requireRole("engenheiro");
  const parsed = buscaSchema.safeParse({ termo });
  if (!parsed.success) return [];

  const supabase = await createClient();
  const { data: tabelaAtiva } = await supabase
    .from("sinapi_tabelas")
    .select("id")
    .eq("status", "ativa")
    .maybeSingle();

  if (!tabelaAtiva) return [];

  // Remove caracteres com significado especial na mini-linguagem de filtro do
  // PostgREST (`,` `(` `)`) antes de embutir o termo no `.or()`.
  const termoSeguro = parsed.data.termo.replace(/[,()]/g, " ").trim();

  const { data } = await supabase
    .from("sinapi_itens")
    .select("id, codigo, descricao, unidade, preco_unitario")
    .eq("sinapi_tabela_id", tabelaAtiva.id)
    .or(`codigo.ilike.%${termoSeguro}%,descricao.ilike.%${termoSeguro}%`)
    .limit(20);

  return data ?? [];
}
