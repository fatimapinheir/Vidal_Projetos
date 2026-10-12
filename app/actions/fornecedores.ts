"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";

const formaPagamentoSchema = z.preprocess(
  (v) => (v === "" || v == null ? undefined : v),
  z
    .enum([
      "dinheiro",
      "pix",
      "boleto",
      "cartao_credito",
      "cartao_debito",
      "transferencia",
      "cheque",
      "outro",
    ])
    .optional()
);

const fornecedorSchema = z
  .object({
    nome: z.string().min(1, "Informe o nome do fornecedor."),
    cnpj_cpf: z.string().optional(),
    telefone: z.string().optional(),
    email: z.email("Email inválido.").optional().or(z.literal("")),
    observacoes: z.string().optional(),
    // Pagamento — gravado em tabela separada, fora do alcance do cliente.
    forma_pagamento: formaPagamentoSchema,
    dados_pagamento: z.string().optional(),
    condicao_pagamento: z.preprocess(
      (v) => (v === "" || v == null ? undefined : v),
      z.enum(["a_vista", "prazo"]).optional()
    ),
    condicao_prazo: z.string().optional(),
  })
  .refine((d) => d.forma_pagamento !== "pix" || !!d.dados_pagamento, {
    message: "Informe a chave pix.",
    path: ["dados_pagamento"],
  })
  .refine((d) => d.condicao_pagamento !== "prazo" || !!d.condicao_prazo, {
    message: "Descreva o prazo (ex: 30/60/90 dias).",
    path: ["condicao_prazo"],
  });

// Só consumido por `z.infer` logo abaixo — apagá-lo levaria o tipo junto.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const contatoSchema = z.object({
  nome: z.string().min(1),
  telefone: z.string().optional(),
  email: z.string().optional(),
  principal: z.boolean(),
});

export type FornecedorFormState = { error: string | null; success?: boolean };

/**
 * Os vendedores chegam como campos numerados (`contato_nome_0`, ...) porque o
 * formulário permite adicionar e remover linhas antes de salvar.
 */
function lerContatos(formData: FormData) {
  const contatos: z.infer<typeof contatoSchema>[] = [];

  for (const [chave, valor] of formData.entries()) {
    if (!chave.startsWith("contato_nome_")) continue;
    const indice = chave.slice("contato_nome_".length);
    const nome = String(valor).trim();
    if (!nome) continue; // linha em branco é ignorada, não vira erro

    contatos.push({
      nome,
      telefone: (formData.get(`contato_telefone_${indice}`) as string) || undefined,
      email: (formData.get(`contato_email_${indice}`) as string) || undefined,
      // Presença basta: checkbox desmarcado não entra no FormData. Mais
      // robusto que comparar com "on", que é só o valor padrão do HTML e muda
      // se alguém puser um `value` no componente.
      principal: !!formData.get(`contato_principal_${indice}`),
    });
  }

  return contatos;
}

/** Mesmos campos na criação e na edição — ler em dois lugares é como um deles fica para trás. */
function lerFornecedor(formData: FormData) {
  return fornecedorSchema.safeParse({
    nome: formData.get("nome"),
    cnpj_cpf: formData.get("cnpj_cpf") || undefined,
    telefone: formData.get("telefone") || undefined,
    email: formData.get("email") || undefined,
    observacoes: formData.get("observacoes") || undefined,
    forma_pagamento: formData.get("forma_pagamento"),
    dados_pagamento: formData.get("dados_pagamento") || undefined,
    condicao_pagamento: formData.get("condicao_pagamento"),
    condicao_prazo: formData.get("condicao_prazo") || undefined,
  });
}

export async function createFornecedor(
  _prevState: FornecedorFormState,
  formData: FormData
): Promise<FornecedorFormState> {
  await requireRole("engenheiro");

  const parsed = lerFornecedor(formData);

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const contatos = lerContatos(formData);
  const supabase = await createClient();

  const { data: fornecedor, error } = await supabase
    .from("fornecedores")
    .insert({
      nome: parsed.data.nome,
      cnpj_cpf: parsed.data.cnpj_cpf ?? null,
      telefone: parsed.data.telefone ?? null,
      email: parsed.data.email || null,
      observacoes: parsed.data.observacoes ?? null,
    })
    .select("id")
    .single();

  if (error || !fornecedor) return { error: "Não foi possível criar o fornecedor." };

  const temPagamento =
    parsed.data.forma_pagamento || parsed.data.condicao_pagamento || parsed.data.dados_pagamento;

  if (temPagamento) {
    const { error: erroPagamento } = await supabase.from("fornecedor_pagamento").insert({
      fornecedor_id: fornecedor.id,
      forma_pagamento: parsed.data.forma_pagamento ?? null,
      dados_pagamento: parsed.data.dados_pagamento ?? null,
      condicao_pagamento: parsed.data.condicao_pagamento ?? null,
      condicao_prazo:
        parsed.data.condicao_pagamento === "prazo" ? (parsed.data.condicao_prazo ?? null) : null,
    });

    // Fornecedor sem condição de pagamento é utilizável; avisar é melhor do que
    // apagar o que já foi criado.
    if (erroPagamento) {
      revalidatePath("/fornecedores");
      return { error: "Fornecedor criado, mas não foi possível salvar as condições de pagamento." };
    }
  }

  if (contatos.length) {
    const { error: erroContatos } = await supabase
      .from("fornecedor_contatos")
      .insert(contatos.map((c) => ({ ...c, fornecedor_id: fornecedor.id })));

    if (erroContatos) {
      revalidatePath("/fornecedores");
      return { error: "Fornecedor criado, mas não foi possível salvar os vendedores." };
    }
  }

  revalidatePath("/fornecedores");
  return { error: null, success: true };
}

export async function removerContatoFornecedor(contatoId: string) {
  await requireRole("engenheiro");
  const supabase = await createClient();
  await supabase.from("fornecedor_contatos").delete().eq("id", contatoId);
  revalidatePath("/fornecedores");
}

const novoContatoSchema = z.object({
  nome: z.string().min(1, "Informe o nome do vendedor."),
  telefone: z.string().optional(),
  email: z.string().optional(),
});

export async function adicionarContatoFornecedor(
  fornecedorId: string,
  _prevState: FornecedorFormState,
  formData: FormData
): Promise<FornecedorFormState> {
  await requireRole("engenheiro");

  const parsed = novoContatoSchema.safeParse({
    nome: formData.get("nome"),
    telefone: formData.get("telefone") || undefined,
    email: formData.get("email") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("fornecedor_contatos").insert({
    fornecedor_id: fornecedorId,
    nome: parsed.data.nome,
    telefone: parsed.data.telefone ?? null,
    email: parsed.data.email ?? null,
    principal: !!formData.get("principal"),
  });

  if (error) return { error: "Não foi possível adicionar o vendedor." };

  revalidatePath("/fornecedores");
  return { error: null, success: true };
}

/**
 * Edita os dados do fornecedor e as condições de pagamento.
 *
 * Os vendedores NÃO entram aqui: eles já têm linha própria no banco e são
 * geridos um a um por `adicionarContatoFornecedor` / `removerContatoFornecedor`.
 * Reenviá-los junto obrigaria a comparar a lista enviada com a gravada para
 * saber o que mudou — e errar isso apaga contato que ninguém mandou apagar.
 */
export async function atualizarFornecedor(
  fornecedorId: string,
  _prevState: FornecedorFormState,
  formData: FormData
): Promise<FornecedorFormState> {
  await requireRole("engenheiro");

  const parsed = lerFornecedor(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("fornecedores")
    .update({
      nome: parsed.data.nome,
      cnpj_cpf: parsed.data.cnpj_cpf ?? null,
      telefone: parsed.data.telefone ?? null,
      email: parsed.data.email || null,
      observacoes: parsed.data.observacoes ?? null,
    })
    .eq("id", fornecedorId);

  if (error) return { error: "Não foi possível salvar o fornecedor." };

  const temPagamento =
    parsed.data.forma_pagamento || parsed.data.condicao_pagamento || parsed.data.dados_pagamento;

  // `upsert` porque a linha de pagamento pode não existir: ela só é criada
  // quando o cadastro informa alguma condição, e aqui é justamente onde um
  // fornecedor antigo ganha a dele pela primeira vez.
  const { error: erroPagamento } = temPagamento
    ? await supabase.from("fornecedor_pagamento").upsert({
        fornecedor_id: fornecedorId,
        forma_pagamento: parsed.data.forma_pagamento ?? null,
        dados_pagamento: parsed.data.dados_pagamento ?? null,
        condicao_pagamento: parsed.data.condicao_pagamento ?? null,
        condicao_prazo:
          parsed.data.condicao_pagamento === "prazo" ? (parsed.data.condicao_prazo ?? null) : null,
        updated_at: new Date().toISOString(),
      })
    : // Limpou tudo: a linha sai, em vez de ficar com todos os campos nulos.
      await supabase.from("fornecedor_pagamento").delete().eq("fornecedor_id", fornecedorId);

  if (erroPagamento) {
    revalidatePath("/fornecedores");
    return { error: "Dados salvos, mas não foi possível atualizar as condições de pagamento." };
  }

  revalidatePath("/fornecedores");
  return { error: null, success: true };
}

/**
 * Inativa ou reativa um fornecedor.
 *
 * Não existe exclusão de propósito: o fornecedor aparece em ordens de compra e
 * locações já registradas, e apagá-lo levaria o histórico junto. Inativo
 * apenas some das listas de escolha.
 */
export async function definirAtivoFornecedor(fornecedorId: string, ativo: boolean) {
  await requireRole("engenheiro");

  const supabase = await createClient();
  await supabase.from("fornecedores").update({ ativo }).eq("id", fornecedorId);

  revalidatePath("/fornecedores");
}

/**
 * Cadastro mínimo de fornecedor, feito de dentro da ordem de compra.
 *
 * Só o nome. O cadastro completo (CNPJ, contatos, condição de pagamento) tem
 * tela própria — exigir tudo aqui transformaria "falta o fornecedor na lista"
 * num desvio de cinco minutos no meio de um formulário já começado. O que
 * falta se completa depois, em Fornecedores.
 */
export async function criarFornecedorRapido(
  nome: string
): Promise<{ error: string | null; criadoId?: string }> {
  await requireRole("engenheiro");

  const limpo = nome.trim();
  if (limpo.length < 2) return { error: "Informe o nome do fornecedor." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("fornecedores")
    .insert({ nome: limpo })
    .select("id")
    .single();

  if (error) return { error: "Não foi possível criar o fornecedor." };

  revalidatePath("/fornecedores");
  return { error: null, criadoId: data.id };
}
