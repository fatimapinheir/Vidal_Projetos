"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";

const perfilSchema = z.object({
  nome: z.string().trim().min(1, "Informe seu nome."),
  telefone: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : null)),
  // Texto livre: o formato varia por estado e por conselho (CREA, CAU, CFT).
  crea: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : null)),
});

export type PerfilFormState = { error: string | null; success?: boolean };

/** Dados do próprio usuário. O que sai daqui vai para o cabeçalho do RDO. */
export async function atualizarPerfil(
  _prevState: PerfilFormState,
  formData: FormData
): Promise<PerfilFormState> {
  const profile = await requireRole("engenheiro");

  const parsed = perfilSchema.safeParse({
    nome: formData.get("nome"),
    telefone: formData.get("telefone") || undefined,
    crea: formData.get("crea") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update(parsed.data).eq("id", profile.id);

  if (error) return { error: "Não foi possível salvar o perfil." };

  revalidatePath("/perfil");
  return { error: null, success: true };
}

/**
 * Grava o caminho da assinatura já enviada ao Storage pelo navegador.
 *
 * A imagem não passa pela action: binário em Server Action viaja em base64 e
 * estoura o limite de payload em produção. Aqui trafega só o caminho.
 */
export async function salvarAssinatura(path: string): Promise<PerfilFormState> {
  const profile = await requireRole("engenheiro");

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ assinatura_path: path })
    .eq("id", profile.id);

  if (error) return { error: "Não foi possível salvar a assinatura." };

  revalidatePath("/perfil");
  return { error: null, success: true };
}

export async function removerAssinatura(): Promise<PerfilFormState> {
  const profile = await requireRole("engenheiro");

  const supabase = await createClient();
  const { data: atual } = await supabase
    .from("profiles")
    .select("assinatura_path")
    .eq("id", profile.id)
    .single();

  if (atual?.assinatura_path) {
    await supabase.storage.from("assinaturas").remove([atual.assinatura_path]);
  }

  await supabase.from("profiles").update({ assinatura_path: null }).eq("id", profile.id);

  revalidatePath("/perfil");
  return { error: null, success: true };
}
