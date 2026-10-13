"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";

export type FuncaoFormState = { error: string | null; funcaoId?: string };

const nomeSchema = z
  .string()
  .trim()
  .min(2, "O nome da função precisa de pelo menos duas letras.")
  .max(60, "Sessenta caracteres é o limite.");

/**
 * Cadastra uma função, ou devolve a que já existe com esse nome.
 *
 * Devolver a existente em vez de recusar é deliberado: quem digita "pedreiro"
 * no campo de criação quer uma função chamada pedreiro, e já existe uma. Dizer
 * "essa função já existe" obrigaria a pessoa a fechar o diálogo e procurar na
 * lista o que ela acabou de escrever. O índice único é sobre
 * `lower(btrim(nome))`, então a comparação aqui segue a mesma régua.
 */
export async function criarFuncao(nome: string): Promise<FuncaoFormState> {
  await requireRole("engenheiro");

  const parsed = nomeSchema.safeParse(nome);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Nome inválido." };

  const supabase = await createClient();

  const { data: existente } = await supabase
    .from("funcoes")
    .select("id")
    .ilike("nome", parsed.data)
    .maybeSingle();

  if (existente) return { error: null, funcaoId: existente.id };

  const { data: criada, error } = await supabase
    .from("funcoes")
    .insert({ nome: parsed.data })
    .select("id")
    .single();

  if (error || !criada) return { error: "Não foi possível cadastrar a função." };

  return { error: null, funcaoId: criada.id };
}

const quantidadeSchema = z.coerce
  .number()
  .int("A quantidade é um número inteiro de pessoas.")
  .min(0, "A quantidade não pode ser negativa.")
  .max(999, "Novecentos e noventa e nove é o limite.");

/**
 * Grava quantas pessoas de uma função estiveram na obra no dia.
 *
 * Zero APAGA a linha em vez de gravar zero. "Pedreiro: 0" numa folha afirma
 * que a função foi considerada e ninguém veio, o que é uma informação que
 * ninguém quis dar — na prática é como se remove uma linha criada por engano.
 *
 * Cria a folha do dia se ela ainda não existir, como `salvarDiario` faz: o
 * primeiro gesto de quem abre um dia novo pode muito bem ser lançar o efetivo.
 */
export async function salvarEfetivoDaFuncao(
  obraId: string,
  data: string,
  funcaoId: string,
  quantidade: number | string
): Promise<{ error: string | null; criouDiario?: boolean }> {
  const profile = await requireRole("engenheiro");

  const parsed = quantidadeSchema.safeParse(quantidade);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Quantidade inválida." };

  const supabase = await createClient();

  const { data: diario } = await supabase
    .from("diario_obra")
    .select("id, fechado_em")
    .eq("obra_id", obraId)
    .eq("data", data)
    .maybeSingle();

  if (diario?.fechado_em) {
    return { error: "Esse dia está fechado. Reabra antes de mexer no efetivo." };
  }

  let diarioId = diario?.id;
  /*
   * Criar a folha muda OUTRAS partes da tela — a seção de fotos deixa de
   * dizer "salve o diário primeiro", o botão de fechar o dia aparece. Só
   * nesse caso a tela precisa ser recarregada inteira; nos demais, a tabela
   * de efetivo se atualiza sozinha. Ver `EfetivoPorFuncao`.
   */
  let criouDiario = false;
  if (!diarioId) {
    const { data: criado, error } = await supabase
      .from("diario_obra")
      .insert({ obra_id: obraId, data, registrado_por: profile.id })
      .select("id")
      .single();
    if (error || !criado) return { error: "Não foi possível abrir a folha do dia." };
    diarioId = criado.id;
    criouDiario = true;
  }

  if (parsed.data === 0) {
    await supabase
      .from("diario_efetivo_funcoes")
      .delete()
      .eq("diario_id", diarioId)
      .eq("funcao_id", funcaoId);
  } else {
    const { error } = await supabase
      .from("diario_efetivo_funcoes")
      .upsert(
        {
          diario_id: diarioId,
          funcao_id: funcaoId,
          quantidade: parsed.data,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "diario_id,funcao_id" }
      );
    if (error) return { error: "Não foi possível salvar o efetivo." };
  }

  revalidatePath(`/obras/${obraId}/diario/${data}`);
  revalidatePath(`/obras/${obraId}/diario`);
  return { error: null, criouDiario };
}


