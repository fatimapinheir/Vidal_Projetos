"use server";

import { z } from "zod";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/require-role";

const vincularSchema = z.object({
  email: z.email("Informe um email válido."),
  nome: z.string().optional(),
});

export type VincularClienteState = { error: string | null; success?: boolean };

/**
 * Vincula um cliente a uma obra. Se já existe um profile com esse email,
 * apenas cria o vínculo. Senão, cria a conta (senha temporária, o cliente
 * troca no primeiro acesso via "esqueci minha senha") e então vincula.
 */
export async function vincularCliente(
  obraId: string,
  _prevState: VincularClienteState,
  formData: FormData
): Promise<VincularClienteState> {
  await requireRole("engenheiro");

  const parsed = vincularSchema.safeParse({
    email: formData.get("email"),
    nome: formData.get("nome") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const { email, nome } = parsed.data;
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("email", email)
    .maybeSingle();

  let clienteId: string;

  if (existing) {
    if (existing.role !== "cliente") {
      return { error: "Esse email já pertence a uma conta de engenheiro." };
    }
    clienteId = existing.id;
  } else {
    const admin = createAdminClient();
    const tempPassword = crypto.randomUUID();

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { nome: nome || email, role: "cliente" },
    });

    if (createError || !created.user) {
      return { error: "Não foi possível criar a conta do cliente." };
    }

    clienteId = created.user.id;

    const headersList = await headers();
    const origin = `${headersList.get("x-forwarded-proto") ?? "http"}://${headersList.get("host")}`;
    await admin.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/atualizar-senha`,
    });
  }

  const { error: linkError } = await supabase
    .from("obra_clientes")
    .insert({ obra_id: obraId, cliente_id: clienteId });

  if (linkError) {
    return { error: "Cliente já vinculado a essa obra ou erro ao vincular." };
  }

  revalidatePath(`/obras/${obraId}/clientes`);
  return { error: null, success: true };
}

export async function desvincularCliente(obraId: string, clienteId: string) {
  await requireRole("engenheiro");
  const supabase = await createClient();
  await supabase
    .from("obra_clientes")
    .delete()
    .eq("obra_id", obraId)
    .eq("cliente_id", clienteId);

  revalidatePath(`/obras/${obraId}/clientes`);
}
