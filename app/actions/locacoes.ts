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
    unidade: z.enum(["dia", "hora", "mes"]),
    valor_unitario: numeroBR("Informe o valor da locação.").refine(
      (v) => v >= 0,
      "Valor da locação não pode ser negativo."
    ),
    data_inicio: z.string().min(1, "Informe a data inicial da locação."),
    horas_utilizadas: numeroBR("Horas utilizadas inválidas.")
      .refine((v) => v >= 0, "Horas utilizadas não podem ser negativas.")
      .optional(),
    data_devolucao: z.string().optional(),
    // Só a cobrança mensal usa estes dois — ver o `refine` logo abaixo.
    data_primeiro_vencimento: z.string().optional(),
    meses_contratados: z.coerce
      .number()
      .int()
      .min(1, "O contrato tem de ter pelo menos um mês.")
      .max(120, "Cento e vinte meses é o limite.")
      .optional(),
    observacoes: z.string().optional(),
  })
  .refine((l) => !l.data_devolucao || l.data_devolucao >= l.data_inicio, {
    message: "A devolução não pode ser antes do início da locação.",
    path: ["data_devolucao"],
  })
  .refine((l) => l.unidade !== "mes" || !!l.data_primeiro_vencimento, {
    message: "Informe o vencimento da primeira mensalidade.",
    path: ["data_primeiro_vencimento"],
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
    data_primeiro_vencimento: (formData.get("data_primeiro_vencimento") as string) || undefined,
    meses_contratados: formData.get("meses_contratados") || undefined,
    observacoes: (formData.get("observacoes") as string) || undefined,
  };
}

/**
 * Os dois campos da cobrança mensal, limpos quando a cobrança não é mensal.
 *
 * Zerar importa: trocar "por mês" para "por dia" e deixar um vencimento velho
 * na linha faria a próxima mudança de volta para mensal reviver uma data que o
 * usuário não escolheu.
 */
function camposMensais(dados: z.infer<typeof locacaoSchema>) {
  if (dados.unidade !== "mes") {
    return { data_primeiro_vencimento: null, meses_contratados: null };
  }
  return {
    data_primeiro_vencimento: dados.data_primeiro_vencimento ?? null,
    meses_contratados: dados.meses_contratados ?? 1,
  };
}

/**
 * Põe a mensalidade da locação em dia depois de qualquer mudança no cadastro.
 *
 * Toda escrita em `locacoes_equipamento` passa por aqui, inclusive quando a
 * cobrança NÃO é mensal: é assim que trocar de "por mês" para "por dia" apaga
 * a ordem que ninguém pagou. A função do banco é idempotente, então chamar à
 * toa não custa nada e esquecer de chamar custaria uma mensalidade sumida.
 *
 * Devolve a mensagem de erro, quando houver — o cadastro já foi salvo nesse
 * ponto, e a mensagem diz o que ficou pendente (um valor reajustado sobre
 * mensalidade paga, por exemplo).
 */
async function sincronizarMensalidade(
  supabase: Awaited<ReturnType<typeof createClient>>,
  obraId: string,
  locacaoId: string
): Promise<string | null> {
  const { data, error } = await supabase.rpc("sincronizar_mensalidades_locacao", {
    p_locacao_id: locacaoId,
  });

  revalidatePath(`/obras/${obraId}/compras`);
  revalidatePath(`/obras/${obraId}`);
  revalidatePath(`/portal/obras/${obraId}`);
  revalidatePath(`/portal/obras/${obraId}/compras`);

  if (error) return "A locação foi salva, mas não foi possível gerar a mensalidade.";
  return data ?? null;
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
  const { data: criada, error } = await supabase
    .from("locacoes_equipamento")
    .insert({
      obra_id: obraId,
      fornecedor_id: parsed.data.fornecedor_id,
      equipamento: parsed.data.equipamento,
      quantidade: parsed.data.quantidade,
      unidade: parsed.data.unidade,
      valor_unitario: parsed.data.valor_unitario,
      data_inicio: parsed.data.data_inicio,
      horas_utilizadas: parsed.data.horas_utilizadas ?? 0,
      data_devolucao: parsed.data.data_devolucao ?? null,
      ...camposMensais(parsed.data),
      observacoes: parsed.data.observacoes ?? null,
      criado_por: profile.id,
    })
    .select("id")
    .single();

  if (error || !criada) return { error: "Não foi possível registrar a locação." };

  revalidatePath(`/obras/${obraId}/locacoes`);

  const erroMensalidade = await sincronizarMensalidade(supabase, obraId, criada.id);
  if (erroMensalidade) return { error: erroMensalidade };

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
      ...camposMensais(parsed.data),
      observacoes: parsed.data.observacoes ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", locacaoId)
    // A locação tem de ser desta obra: o id vem do navegador.
    .eq("obra_id", obraId);

  if (error) return { error: "Não foi possível salvar a locação." };

  revalidatePath(`/obras/${obraId}/locacoes`);

  const erroMensalidade = await sincronizarMensalidade(supabase, obraId, locacaoId);
  if (erroMensalidade) return { error: erroMensalidade };

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
    .eq("id", locacaoId)
    .eq("obra_id", obraId);

  revalidatePath(`/obras/${obraId}/locacoes`);
}

export async function removerLocacao(obraId: string, locacaoId: string) {
  await requireRole("engenheiro");
  const supabase = await createClient();
  await supabase
    .from("locacoes_equipamento")
    .delete()
    .eq("id", locacaoId)
    .eq("obra_id", obraId);

  /*
   * A mensalidade não paga cai junto, por gatilho no banco
   * (`trg_locacao_limpa_mensalidade`, 0054) — se houver parcela paga, a ordem
   * fica, porque apagar o registro de um pagamento que aconteceu é outra
   * coisa. Daqui só sai a revalidação das telas que mostram contas a pagar.
   */
  revalidatePath(`/obras/${obraId}/locacoes`);
  revalidatePath(`/obras/${obraId}/compras`);
  revalidatePath(`/obras/${obraId}`);
  revalidatePath(`/portal/obras/${obraId}`);
  revalidatePath(`/portal/obras/${obraId}/compras`);
}
