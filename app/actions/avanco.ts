"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";

const avancoSchema = z.object({
  orcamento_item_id: z.uuid(),
  quantidade_executada_acumulada: z.coerce.number().min(0, "Informe uma quantidade válida."),
  data_medicao: z.string().min(1),
  observacoes: z.string().optional(),
});

export type AvancoFormState = { error: string | null; success?: boolean };

export async function registrarAvanco(
  obraId: string,
  _prevState: AvancoFormState,
  formData: FormData
): Promise<AvancoFormState> {
  const profile = await requireRole("engenheiro");

  const parsed = avancoSchema.safeParse({
    orcamento_item_id: formData.get("orcamento_item_id"),
    quantidade_executada_acumulada: formData.get("quantidade_executada_acumulada"),
    data_medicao: formData.get("data_medicao"),
    observacoes: formData.get("observacoes") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("avanco_registros").insert({
    obra_id: obraId,
    orcamento_item_id: parsed.data.orcamento_item_id,
    quantidade_executada_acumulada: parsed.data.quantidade_executada_acumulada,
    data_medicao: parsed.data.data_medicao,
    observacoes: parsed.data.observacoes ?? null,
    registrado_por: profile.id,
  });

  if (error) return { error: "Não foi possível registrar o avanço." };

  revalidatePath(`/obras/${obraId}/avanco`);
  revalidatePath(`/obras/${obraId}/orcamento`);
  revalidatePath(`/obras/${obraId}`);
  revalidatePath(`/portal/obras/${obraId}`);
  return { error: null, success: true };
}
