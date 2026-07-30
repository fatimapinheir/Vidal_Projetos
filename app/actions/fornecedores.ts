"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";

const fornecedorSchema = z.object({
  nome: z.string().min(1, "Informe o nome do fornecedor."),
  cnpj_cpf: z.string().optional(),
  telefone: z.string().optional(),
  email: z.email("Email inválido.").optional().or(z.literal("")),
  observacoes: z.string().optional(),
});

export type FornecedorFormState = { error: string | null; success?: boolean };

export async function createFornecedor(
  _prevState: FornecedorFormState,
  formData: FormData
): Promise<FornecedorFormState> {
  await requireRole("engenheiro");

  const parsed = fornecedorSchema.safeParse({
    nome: formData.get("nome"),
    cnpj_cpf: formData.get("cnpj_cpf") || undefined,
    telefone: formData.get("telefone") || undefined,
    email: formData.get("email") || undefined,
    observacoes: formData.get("observacoes") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("fornecedores").insert(parsed.data);

  if (error) return { error: "Não foi possível criar o fornecedor." };

  revalidatePath("/fornecedores");
  return { error: null, success: true };
}
