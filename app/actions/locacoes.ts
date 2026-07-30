"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { parseNumeroBR } from "@/lib/parse-numero-br";
import { hojeIso } from "@/lib/locacoes/calculo";

export type LocacaoFormState = { error: string | null; success?: boolean };

const numeroBR = (mensagem: string) =>
  z.preprocess((v) => parseNumeroBR(v) ?? v, z.number({ message: mensagem }));

const locacaoSchema = z
  .object({
    fornecedor_id: z.uuid("Selecione o locador."),
    equipamento: z.string().min(1, "Informe o equipamento."),
    quantidade: z.coerce.number().int().positive("Quantidade deve ser maior que zero."),
    unidade: z.enum(["dia", "hora"]),
    valor_unitario: numeroBR("Informe o valor da locação.").refine(
      (v) => v >= 0,
      "Valor da locação não pode ser negativo."
    ),
    data_inicio: z.string().min(1, "Informe a data inicial da locação."),
    horas_utilizadas: numeroBR("Horas utilizadas inválidas.")
      .refine((v) => v >= 0, "Horas utilizadas não podem ser negativas.")
      .optional(),
    data_devolucao: z.string().optional(),
    observacoes: z.string().optional(),
  })
  .refine((l) => !l.data_devolucao || l.data_devolucao >= l.data_inicio, {
    message: "A devolução não pode ser antes do início da locação.",
    path: ["data_devolucao"],
  });

function lerFormulario(formData: FormData) {
  // Checkbox desmarcado não vem no FormData; devolvido só existe com data.
  const devolvido = formData.get("devolvido") === "on";
  const dataDevolucao = (formData.get("data_devolucao") as string) || "";

  return {
    fornecedor_id: formData.get("fornecedor_id"),
    equipamento: formData.get("equipamento"),
    quantidade: formData.get("quantidade"),
    unidade: formData.get("unidade"),
    valor_unitario: formData.get("valor_unitario"),
    data_inicio: formData.get("data_inicio"),
    horas_utilizadas: formData.get("horas_utilizadas") || undefined,
    data_devolucao: devolvido ? dataDevolucao || hojeIso() : undefined,
    observacoes: (formData.get("observacoes") as string) || undefined,
  };
}

export async function criarLocacao(
  obraId: string,
  _prevState: LocacaoFormState,
  formData: FormData
): Promise<LocacaoFormState> {
  const profile = await requireRole("engenheiro");
  const parsed = locacaoSchema.safeParse(lerFormulario(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const supabase = await createClient();
  const { error } = await supabase.from("locacoes_equipamento").insert({
    obra_id: obraId,
    fornecedor_id: parsed.data.fornecedor_id,
    equipamento: parsed.data.equipamento,
    quantidade: parsed.data.quantidade,
    unidade: parsed.data.unidade,
    valor_unitario: parsed.data.valor_unitario,
    data_inicio: parsed.data.data_inicio,
    horas_utilizadas: parsed.data.horas_utilizadas ?? 0,
    data_devolucao: parsed.data.data_devolucao ?? null,
    observacoes: parsed.data.observacoes ?? null,
    criado_por: profile.id,
  });

  if (error) return { error: "Não foi possível registrar a locação." };

  revalidatePath(`/obras/${obraId}/locacoes`);
  return { error: null, success: true };
}

export async function atualizarLocacao(
  obraId: string,
  locacaoId: string,
  _prevState: LocacaoFormState,
  formData: FormData
): Promise<LocacaoFormState> {
  await requireRole("engenheiro");
  const parsed = locacaoSchema.safeParse(lerFormulario(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("locacoes_equipamento")
    .update({
      fornecedor_id: parsed.data.fornecedor_id,
      equipamento: parsed.data.equipamento,
      quantidade: parsed.data.quantidade,
      unidade: parsed.data.unidade,
      valor_unitario: parsed.data.valor_unitario,
      data_inicio: parsed.data.data_inicio,
      horas_utilizadas: parsed.data.horas_utilizadas ?? 0,
      data_devolucao: parsed.data.data_devolucao ?? null,
      observacoes: parsed.data.observacoes ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", locacaoId);

  if (error) return { error: "Não foi possível salvar a locação." };

  revalidatePath(`/obras/${obraId}/locacoes`);
  return { error: null, success: true };
}

/**
 * Atalho da lista: marca a devolução (encerrando a contagem financeira) ou
 * desfaz, se tiver sido marcada por engano — nesse caso a conta volta a correr.
 */
export async function alternarDevolucao(obraId: string, locacaoId: string) {
  await requireRole("engenheiro");
  const supabase = await createClient();

  const { data: locacao } = await supabase
    .from("locacoes_equipamento")
    .select("data_inicio, data_devolucao")
    .eq("id", locacaoId)
    .single();

  if (!locacao) return;

  // Equipamento devolvido no mesmo dia em que entrou na obra: a devolução não
  // pode ser anterior ao início, então usa a data de início.
  const hoje = hojeIso();
  const dataDevolucao = locacao.data_devolucao
    ? null
    : hoje >= locacao.data_inicio
      ? hoje
      : locacao.data_inicio;

  await supabase
    .from("locacoes_equipamento")
    .update({ data_devolucao: dataDevolucao, updated_at: new Date().toISOString() })
    .eq("id", locacaoId);

  revalidatePath(`/obras/${obraId}/locacoes`);
}

export async function removerLocacao(obraId: string, locacaoId: string) {
  await requireRole("engenheiro");
  const supabase = await createClient();
  await supabase.from("locacoes_equipamento").delete().eq("id", locacaoId);
  revalidatePath(`/obras/${obraId}/locacoes`);
}
