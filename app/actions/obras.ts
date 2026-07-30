"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";

const obraSchema = z.object({
  nome: z.string().min(1, "Informe o nome da obra."),
  endereco: z.string().optional(),
  tipo: z.enum(["residencial", "comercial"]),
  data_inicio: z.string().optional(),
  data_fim_prevista: z.string().optional(),
});

export type ObraFormState = { error: string | null };

export async function createObra(
  _prevState: ObraFormState,
  formData: FormData
): Promise<ObraFormState> {
  const profile = await requireRole("engenheiro");

  const parsed = obraSchema.safeParse({
    nome: formData.get("nome"),
    endereco: formData.get("endereco") || undefined,
    tipo: formData.get("tipo"),
    data_inicio: formData.get("data_inicio") || undefined,
    data_fim_prevista: formData.get("data_fim_prevista") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("obras")
    .insert({ ...parsed.data, criado_por: profile.id })
    .select("id")
    .single();

  if (error) {
    return { error: "Não foi possível criar a obra." };
  }

  redirect(`/obras/${data.id}`);
}

const statusSchema = z.enum(["planejamento", "em_andamento", "pausada", "concluida"]);

export async function updateObraStatus(obraId: string, formData: FormData) {
  await requireRole("engenheiro");
  const parsedStatus = statusSchema.parse(formData.get("status"));

  const supabase = await createClient();
  await supabase.from("obras").update({ status: parsedStatus }).eq("id", obraId);

  revalidatePath(`/obras/${obraId}`);
  revalidatePath("/obras");
  revalidatePath("/dashboard");
}
