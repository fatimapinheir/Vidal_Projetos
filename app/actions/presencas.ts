"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import type { PresencaStatus } from "@/lib/types/database.types";

const dataSchema = z.string().min(1, "Informe a data.");

export type PresencaFormState = { error: string | null; success?: boolean };

/**
 * Recebe um formulário com um select "status_<trabalhadorId>" para cada
 * trabalhador ativo da obra e faz upsert (permite corrigir um dia já lançado).
 */
export async function registrarPresencas(
  obraId: string,
  _prevState: PresencaFormState,
  formData: FormData
): Promise<PresencaFormState> {
  const profile = await requireRole("engenheiro");

  const parsedData = dataSchema.safeParse(formData.get("data"));
  if (!parsedData.success) {
    return { error: "Informe a data." };
  }
  const data = parsedData.data;

  const registros: {
    obra_id: string;
    trabalhador_id: string;
    data: string;
    status: PresencaStatus;
    observacoes: string | null;
    registrado_por: string;
  }[] = [];

  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("status_")) continue;
    const trabalhadorId = key.replace("status_", "");
    const status = String(value) as PresencaStatus;
    const observacoes = (formData.get(`obs_${trabalhadorId}`) as string) || null;

    registros.push({
      obra_id: obraId,
      trabalhador_id: trabalhadorId,
      data,
      status,
      observacoes,
      registrado_por: profile.id,
    });
  }

  if (!registros.length) {
    return { error: "Nenhum trabalhador para registrar." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("presencas")
    .upsert(registros, { onConflict: "obra_id,trabalhador_id,data" });

  if (error) return { error: "Não foi possível salvar as presenças." };

  revalidatePath(`/obras/${obraId}/presencas`);
  return { error: null, success: true };
}
