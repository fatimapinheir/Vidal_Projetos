"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { parseNumeroBR } from "@/lib/parse-numero-br";

/**
 * A equipe é cadastro global: nome, responsável e membros valem em qualquer
 * obra. O que se negocia caso a caso — tipo de contrato, unidade e valor por
 * unidade — mora no vínculo `obra_equipes`, não aqui.
 */
const equipeSchema = z
  .object({
    nome: z.string().min(1, "Informe o nome da equipe."),
    responsavel_id: z.uuid("Selecione o responsável pela equipe."),
    membros: z.array(z.uuid()).min(1, "Selecione ao menos um trabalhador para a equipe."),
  })
  .refine((data) => data.membros.includes(data.responsavel_id), {
    message: "O responsável precisa ser um dos membros da equipe.",
    path: ["responsavel_id"],
  });

export type EquipeFormState = { error: string | null; success?: boolean };

export async function criarEquipe(
  _prevState: EquipeFormState,
  formData: FormData
): Promise<EquipeFormState> {
  await requireRole("engenheiro");

  const parsed = equipeSchema.safeParse({
    nome: formData.get("nome"),
    responsavel_id: formData.get("responsavel_id"),
    membros: formData.getAll("membros"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();

  const { data: equipe, error: equipeError } = await supabase
    .from("equipes")
    .insert({ nome: parsed.data.nome, responsavel_id: parsed.data.responsavel_id })
    .select("id")
    .single();

  if (equipeError || !equipe) return { error: "Não foi possível criar a equipe." };

  const { error: membrosError } = await supabase
    .from("equipe_trabalhadores")
    .insert(parsed.data.membros.map((trabalhador_id) => ({ equipe_id: equipe.id, trabalhador_id })));

  if (membrosError) {
    // Equipe sem membros não serve para nada e ficaria poluindo a lista.
    await supabase.from("equipes").delete().eq("id", equipe.id);
    return { error: "Não foi possível adicionar os membros da equipe." };
  }

  revalidatePath("/trabalhadores");
  return { error: null, success: true };
}

export async function desativarEquipe(equipeId: string) {
  await requireRole("engenheiro");
  const supabase = await createClient();
  await supabase.from("equipes").update({ ativo: false }).eq("id", equipeId);
  revalidatePath("/trabalhadores");
}

const vinculoSchema = z
  .object({
    equipe_id: z.uuid("Selecione a equipe."),
    tipo_contrato: z.enum(["diaria", "empreitada"]),
    unidade_medida: z.string().optional(),
    valor_unidade: z.preprocess(
      (v) => (v === "" || v == null ? undefined : (parseNumeroBR(v) ?? v)),
      z.number().positive("Valor por unidade inválido.").optional()
    ),
  })
  .refine((d) => d.tipo_contrato !== "empreitada" || !!d.unidade_medida, {
    message: "Informe a unidade de medida (ex: m², m³) para contrato por empreitada.",
    path: ["unidade_medida"],
  })
  .refine((d) => d.tipo_contrato !== "empreitada" || !!d.valor_unidade, {
    message: "Informe o valor por unidade entregue.",
    path: ["valor_unidade"],
  });

/** Coloca uma equipe do cadastro nesta obra, com as condições negociadas aqui. */
export async function vincularEquipeNaObra(
  obraId: string,
  _prevState: EquipeFormState,
  formData: FormData
): Promise<EquipeFormState> {
  await requireRole("engenheiro");

  const parsed = vinculoSchema.safeParse({
    equipe_id: formData.get("equipe_id"),
    tipo_contrato: formData.get("tipo_contrato"),
    unidade_medida: formData.get("unidade_medida") || undefined,
    valor_unidade: formData.get("valor_unidade"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const empreitada = parsed.data.tipo_contrato === "empreitada";

  // Reativa em vez de duplicar: a chave é (obra, equipe), então uma equipe
  // removida e recolocada volta pelo mesmo registro.
  const { error } = await supabase.from("obra_equipes").upsert(
    {
      obra_id: obraId,
      equipe_id: parsed.data.equipe_id,
      tipo_contrato: parsed.data.tipo_contrato,
      unidade_medida: empreitada ? parsed.data.unidade_medida : null,
      valor_unidade: empreitada ? parsed.data.valor_unidade : null,
      ativo: true,
    },
    { onConflict: "obra_id,equipe_id" }
  );

  if (error) return { error: "Não foi possível vincular a equipe à obra." };

  revalidatePath(`/obras/${obraId}`);
  revalidatePath(`/obras/${obraId}/fechamentos`);
  return { error: null, success: true };
}

export async function desvincularEquipeDaObra(obraId: string, equipeId: string) {
  await requireRole("engenheiro");
  const supabase = await createClient();

  // Desativa em vez de apagar: fechamentos já feitos referenciam a equipe, e
  // apagar o vínculo apagaria o contexto de como ela foi paga naquela obra.
  await supabase
    .from("obra_equipes")
    .update({ ativo: false })
    .eq("obra_id", obraId)
    .eq("equipe_id", equipeId);

  revalidatePath(`/obras/${obraId}`);
  revalidatePath(`/obras/${obraId}/fechamentos`);
}
