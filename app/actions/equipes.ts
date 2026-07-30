"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";

const equipeSchema = z
  .object({
    nome: z.string().min(1, "Informe o nome da equipe."),
    tipo_contrato: z.enum(["diaria", "empreitada"]),
    responsavel_id: z.uuid("Selecione o responsável pela equipe."),
    unidade_medida: z.string().optional(),
    valor_unidade: z.coerce.number().positive().optional(),
    membros: z.array(z.uuid()).min(1, "Selecione ao menos um trabalhador para a equipe."),
  })
  .refine((data) => data.membros.includes(data.responsavel_id), {
    message: "O responsável precisa ser um dos membros da equipe.",
    path: ["responsavel_id"],
  })
  .refine((data) => data.tipo_contrato !== "empreitada" || !!data.unidade_medida, {
    message: "Informe a unidade de medida (ex: m², m³) para contrato por empreitada.",
    path: ["unidade_medida"],
  })
  .refine((data) => data.tipo_contrato !== "empreitada" || !!data.valor_unidade, {
    message: "Informe o valor por unidade entregue.",
    path: ["valor_unidade"],
  });

export type EquipeFormState = { error: string | null; success?: boolean };

export async function criarEquipe(
  obraId: string,
  _prevState: EquipeFormState,
  formData: FormData
): Promise<EquipeFormState> {
  await requireRole("engenheiro");

  const parsed = equipeSchema.safeParse({
    nome: formData.get("nome"),
    tipo_contrato: formData.get("tipo_contrato"),
    responsavel_id: formData.get("responsavel_id"),
    unidade_medida: formData.get("unidade_medida") || undefined,
    valor_unidade: formData.get("valor_unidade") || undefined,
    membros: formData.getAll("membros"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();

  // Confere que todos os membros escolhidos estão de fato alocados nessa obra.
  const { data: alocados } = await supabase
    .from("obra_trabalhadores")
    .select("trabalhador_id")
    .eq("obra_id", obraId)
    .eq("ativo", true)
    .in("trabalhador_id", parsed.data.membros);

  if ((alocados?.length ?? 0) !== parsed.data.membros.length) {
    return { error: "Um ou mais trabalhadores selecionados não estão alocados nessa obra." };
  }

  const { data: equipe, error: equipeError } = await supabase
    .from("equipes")
    .insert({
      obra_id: obraId,
      nome: parsed.data.nome,
      tipo_contrato: parsed.data.tipo_contrato,
      responsavel_id: parsed.data.responsavel_id,
      unidade_medida: parsed.data.tipo_contrato === "empreitada" ? parsed.data.unidade_medida : null,
      valor_unidade: parsed.data.tipo_contrato === "empreitada" ? parsed.data.valor_unidade : null,
    })
    .select("id")
    .single();

  if (equipeError || !equipe) {
    return { error: "Não foi possível criar a equipe." };
  }

  const { error: membrosError } = await supabase.from("equipe_trabalhadores").insert(
    parsed.data.membros.map((trabalhador_id) => ({ equipe_id: equipe.id, trabalhador_id }))
  );

  if (membrosError) {
    return { error: "Equipe criada, mas houve erro ao adicionar os membros." };
  }

  revalidatePath(`/obras/${obraId}/equipe`);
  revalidatePath(`/obras/${obraId}/fechamentos`);
  return { error: null, success: true };
}

export async function desativarEquipe(obraId: string, equipeId: string) {
  await requireRole("engenheiro");
  const supabase = await createClient();
  await supabase.from("equipes").update({ ativo: false }).eq("id", equipeId);
  revalidatePath(`/obras/${obraId}/equipe`);
  revalidatePath(`/obras/${obraId}/fechamentos`);
}
