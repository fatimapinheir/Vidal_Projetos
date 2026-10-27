"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { normalizarUnidade } from "@/lib/orcamento/unidades";

const CATEGORIAS = ["material", "servico", "mao_de_obra"] as const;

/*
 * Sem preço, e isso é a decisão central do cadastro.
 *
 * O catálogo responde "o que é este insumo" — descrição, categoria de custo,
 * unidade. Quanto custa é do dia da compra e do fornecedor daquele dia;
 * guardado aqui, viraria um número velho com cara de verdade, e alguém
 * lançaria o preço do mês passado sem perceber.
 */
const schema = z.object({
  descricao: z.string().trim().min(2, "Informe a descrição do insumo."),
  categoria_custo: z.enum(CATEGORIAS, {
    error: "Escolha a categoria de custo: material, serviço ou mão de obra.",
  }),
  /*
   * A unidade é NORMALIZADA no servidor, não recusada.
   *
   * A tela oferece a lista fechada, mas tem a saída "Outra..." — e ela precisa
   * existir: há unidade legítima fora da lista, como M2XMES na própria SINAPI.
   * Recusar travaria o cadastro de um insumo que a obra de fato aluga por
   * metro quadrado ao mês.
   *
   * Então o que chega passa pelo mesmo normalizador do orçamento: "un", "UN" e
   * "unid" viram todas UN, e o que ele não reconhece é preservado em
   * maiúsculas, sem palpite. Mata a divergência de grafia — que é o problema
   * real — sem fechar a porta.
   */
  unidade: z
    .string()
    .trim()
    .min(1, "Escolha a unidade.")
    .transform((v) => normalizarUnidade(v) ?? v.toUpperCase().replace(/\s+/g, "")),
});

export type InsumoState = { error: string | null; criadoId?: string; sucesso?: boolean };

/** Erro de descrição repetida, traduzido. Único índice que esta tabela tem. */
function erroDeDescricaoRepetida(codigo?: string) {
  return codigo === "23505"
    ? "Já existe um insumo com essa descrição."
    : null;
}

/**
 * Cadastra um insumo.
 *
 * Serve a dois lugares: a tela do catálogo e o próprio formulário de compra —
 * o momento em que falta o insumo é o momento em que se está lançando, e
 * mandar o engenheiro para outra tela perderia a compra pela metade.
 *
 * Só o engenheiro cadastra. O cliente registra despesa pelo portal e lê o
 * catálogo para escolher, mas não cria: foi a decisão tomada, e o motivo é que
 * um catálogo aberto voltaria a juntar "barrote", "Barrote" e "barote" — o
 * problema de origem, de novo.
 */
export async function criarInsumo(
  _prevState: InsumoState,
  formData: FormData
): Promise<InsumoState> {
  await requireRole("engenheiro");

  const parsed = schema.safeParse({
    descricao: formData.get("descricao"),
    categoria_custo: formData.get("categoria_custo"),
    unidade: formData.get("unidade"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("insumos")
    .insert(parsed.data)
    .select("id")
    .single();

  if (error || !data) {
    return { error: erroDeDescricaoRepetida(error?.code) ?? "Não foi possível cadastrar o insumo." };
  }

  revalidatePath("/insumos");
  return { error: null, criadoId: data.id };
}

export async function atualizarInsumo(
  insumoId: string,
  _prevState: InsumoState,
  formData: FormData
): Promise<InsumoState> {
  await requireRole("engenheiro");

  const parsed = schema.safeParse({
    descricao: formData.get("descricao"),
    categoria_custo: formData.get("categoria_custo"),
    unidade: formData.get("unidade"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const supabase = await createClient();
  const { error } = await supabase.from("insumos").update(parsed.data).eq("id", insumoId);

  if (error) {
    return { error: erroDeDescricaoRepetida(error.code) ?? "Não foi possível salvar o insumo." };
  }

  /*
   * Renomear aqui NÃO reescreve as compras.
   *
   * `compra_itens` guarda a própria cópia de descrição, unidade e categoria —
   * ver a 0067. Corrigir a grafia do catálogo hoje não altera a nota fiscal de
   * ontem, e é assim que tem de ser: o item da compra é o registro do que foi
   * comprado naquele dia.
   */
  revalidatePath("/insumos");
  return { error: null, sucesso: true };
}

/**
 * Tira o insumo da busca sem apagá-lo.
 *
 * É o meio-termo que faltava: o insumo que a obra deixou de comprar não deve
 * poluir o seletor, mas apagar seria perder o cadastro feito à mão. Inativo
 * continua na listagem, apagado, como o fornecedor inativo já faz.
 */
export async function alternarAtivoInsumo(
  insumoId: string,
  ativo: boolean
): Promise<{ error: string | null }> {
  await requireRole("engenheiro");
  const supabase = await createClient();
  const { error } = await supabase.from("insumos").update({ ativo }).eq("id", insumoId);
  if (error) return { error: "Não foi possível alterar o insumo." };
  revalidatePath("/insumos");
  return { error: null };
}

/**
 * Apaga o insumo do catálogo, de verdade.
 *
 * É seguro, e isso não é descuido: `compra_itens.insumo_id` é
 * `on delete set null`, e o item guarda a própria descrição, unidade e
 * categoria. A compra antiga continua inteira; só perde o vínculo com o
 * catálogo.
 */
export async function removerInsumo(insumoId: string): Promise<{ error: string | null }> {
  await requireRole("engenheiro");
  const supabase = await createClient();
  const { error } = await supabase.from("insumos").delete().eq("id", insumoId);
  if (error) return { error: "Não foi possível excluir o insumo." };
  revalidatePath("/insumos");
  return { error: null };
}
