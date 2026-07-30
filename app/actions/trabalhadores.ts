"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";

const trabalhadorSchema = z.object({
  nome: z.string().min(1, "Informe o nome do trabalhador."),
  cpf: z.string().optional(),
  funcao: z.string().optional(),
  valor_diaria_padrao: z.coerce.number().positive().optional(),
  telefone: z.string().optional(),
});

export type TrabalhadorFormState = { error: string | null; success?: boolean };

export async function createTrabalhador(
  _prevState: TrabalhadorFormState,
  formData: FormData
): Promise<TrabalhadorFormState> {
  await requireRole("engenheiro");

  const parsed = trabalhadorSchema.safeParse({
    nome: formData.get("nome"),
    cpf: formData.get("cpf") || undefined,
    funcao: formData.get("funcao") || undefined,
    valor_diaria_padrao: formData.get("valor_diaria_padrao") || undefined,
    telefone: formData.get("telefone") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("trabalhadores").insert(parsed.data);

  if (error) return { error: "Não foi possível cadastrar o trabalhador." };

  revalidatePath("/trabalhadores");
  return { error: null, success: true };
}

const alocacaoSchema = z.object({
  trabalhador_id: z.uuid(),
  valor_diaria: z.coerce.number().positive("Informe um valor de diária válido."),
});

export type AlocacaoFormState = { error: string | null; success?: boolean };

export async function alocarTrabalhadorNaObra(
  obraId: string,
  _prevState: AlocacaoFormState,
  formData: FormData
): Promise<AlocacaoFormState> {
  await requireRole("engenheiro");

  const parsed = alocacaoSchema.safeParse({
    trabalhador_id: formData.get("trabalhador_id"),
    valor_diaria: formData.get("valor_diaria"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("obra_trabalhadores").insert({
    obra_id: obraId,
    trabalhador_id: parsed.data.trabalhador_id,
    valor_diaria: parsed.data.valor_diaria,
  });

  if (error) {
    return { error: "Não foi possível alocar o trabalhador (já está nessa obra?)." };
  }

  revalidatePath(`/obras/${obraId}/equipe`);
  return { error: null, success: true };
}
