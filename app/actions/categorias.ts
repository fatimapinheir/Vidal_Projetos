"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/require-role";

const TIPOS = ["material", "servico", "mao_de_obra"] as const;

const schema = z.object({
  nome: z.string().trim().min(2, "Informe o nome da categoria."),
  tipo_item: z.enum(TIPOS).optional(),
});

export type CategoriaState = { error: string | null; criadaId?: string };

/**
 * Cria uma categoria financeira a partir do próprio formulário de compra.
 *
 * Aberta ao cliente, e não só ao engenheiro, porque ele também registra
 * lançamento — e descobrir que falta a categoria "Água" no meio do
 * lançamento, sem poder criá-la, deixaria o pagamento sem classificação.
 * O risco é baixo: a tabela é uma lista de rótulos, sem valor nem vínculo com
 * obra.
 */
export async function criarCategoria(
  _prevState: CategoriaState,
  formData: FormData
): Promise<CategoriaState> {
  await requireAuth();

  const parsed = schema.safeParse({
    nome: formData.get("nome"),
    tipo_item: formData.get("tipo_item") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categorias_financeiras")
    .insert({ nome: parsed.data.nome, tipo_item: parsed.data.tipo_item ?? null })
    .select("id")
    .single();

  if (error) {
    // `nome` é único: repetir uma categoria existente é engano comum, e o
    // código do Postgres para isso é mais útil que "não foi possível".
    if (error.code === "23505") return { error: "Já existe uma categoria com esse nome." };
    return { error: "Não foi possível criar a categoria." };
  }

  revalidatePath("/obras");
  return { error: null, criadaId: data.id };
}
