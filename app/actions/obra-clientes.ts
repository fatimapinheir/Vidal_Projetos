"use server";

import { z } from "zod";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/require-role";
import { soDigitos, validarDocumento } from "@/lib/documento";

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

    // A origem vem de configuração, não do header `Host` — que quem faz a
    // requisição controla e poderia apontar o link do convite (com token) para
    // outro domínio. O header só serve de rede de segurança em
    // desenvolvimento, onde NEXT_PUBLIC_SITE_URL costuma não estar definida.
    const headersList = await headers();
    const origin =
      process.env.NEXT_PUBLIC_SITE_URL ??
      `${headersList.get("x-forwarded-proto") ?? "http"}://${headersList.get("host")}`;

    const { error: conviteError } = await admin.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/atualizar-senha`,
    });

    // O envio pode falhar por limite de e-mails do provedor. A conta já existe
    // e será vinculada — mas dizer "sucesso" faria o engenheiro acreditar que o
    // cliente foi convidado, e ninguém descobriria até ele reclamar.
    if (conviteError) {
      await supabase.from("obra_clientes").insert({ obra_id: obraId, cliente_id: clienteId });
      revalidatePath(`/obras/${obraId}`);
  revalidatePath("/clientes");
      return {
        error:
          "Cliente vinculado, mas o e-mail de convite não foi enviado (limite do provedor?). Reenvie a definição de senha pelo painel do Supabase.",
      };
    }
  }

  const { error: linkError } = await supabase
    .from("obra_clientes")
    .insert({ obra_id: obraId, cliente_id: clienteId });

  if (linkError) {
    return { error: "Cliente já vinculado a essa obra ou erro ao vincular." };
  }

  revalidatePath(`/obras/${obraId}`);
  revalidatePath("/clientes");
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

  revalidatePath(`/obras/${obraId}`);
  revalidatePath("/clientes");
}

const clienteSchema = z
  .object({
    tipo_pessoa: z.enum(["pf", "pj"]),
    nome: z.string().trim().min(1, "Informe o nome."),
    email: z.email("Informe um e-mail válido."),
    telefone: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v ? v : null)),
    cpf_cnpj: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v ? soDigitos(v) : null)),
  })
  .refine((d) => d.cpf_cnpj === null || validarDocumento(d.tipo_pessoa, d.cpf_cnpj), {
    message: "Documento inválido — confira os números.",
    path: ["cpf_cnpj"],
  });

export type CriarClienteState = {
  error: string | null;
  aviso?: string | null;
  success?: boolean;
};

/**
 * Cria o acesso do cliente ao portal e o vincula à obra.
 *
 * Chamada pelo modal que abre logo após o cadastro da obra. A obra já existe
 * nesse ponto, de propósito: o convite depende de um e-mail sair, e falhar no
 * envio não pode desfazer um formulário de 27 campos.
 *
 * E-mail já cadastrado não vira cadastro novo nem sobrescreve o que existe —
 * só ganha o vínculo com esta obra, com aviso. É o caso comum do cliente com
 * duas obras, e sobrescrever ali deixaria uma digitação apressada alterando o
 * cadastro que já valia para as outras.
 */
export async function criarClienteParaObra(
  obraId: string,
  _prevState: CriarClienteState,
  formData: FormData
): Promise<CriarClienteState> {
  await requireRole("engenheiro");

  const parsed = clienteSchema.safeParse({
    tipo_pessoa: formData.get("tipo_pessoa"),
    nome: formData.get("nome"),
    email: formData.get("email"),
    telefone: formData.get("telefone") || undefined,
    cpf_cnpj: formData.get("cpf_cnpj") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const { tipo_pessoa, nome, email, telefone, cpf_cnpj } = parsed.data;
  const supabase = await createClient();

  const { data: existente } = await supabase
    .from("profiles")
    .select("id, role, nome")
    .eq("email", email)
    .maybeSingle();

  if (existente) {
    if (existente.role !== "cliente") {
      return { error: "Esse e-mail já pertence a uma conta de engenheiro." };
    }
    const { error } = await supabase
      .from("obra_clientes")
      .insert({ obra_id: obraId, cliente_id: existente.id });

    if (error) return { error: "Esse cliente já está vinculado a esta obra." };

    revalidatePath(`/obras/${obraId}`);
    revalidatePath("/clientes");
    return {
      error: null,
      success: true,
      aviso: `${existente.nome} já tinha cadastro — foi só vinculado a esta obra, sem novo convite.`,
    };
  }

  // Documento duplicado é checado antes de criar a conta: o índice único
  // barraria depois, mas aí já existiria um usuário no Auth sem profile.
  if (cpf_cnpj) {
    const { data: mesmoDoc } = await supabase
      .from("profiles")
      .select("nome, email")
      .eq("cpf_cnpj", cpf_cnpj)
      .maybeSingle();

    if (mesmoDoc) {
      return {
        error: `Esse documento já está cadastrado para ${mesmoDoc.nome} (${mesmoDoc.email}).`,
      };
    }
  }

  const admin = createAdminClient();
  const { data: criado, error: erroCriar } = await admin.auth.admin.createUser({
    email,
    password: crypto.randomUUID(),
    email_confirm: true,
    user_metadata: { nome, role: "cliente", telefone, tipo_pessoa, cpf_cnpj },
  });

  if (erroCriar || !criado.user) {
    return { error: "Não foi possível criar a conta do cliente." };
  }

  const { error: erroVinculo } = await supabase
    .from("obra_clientes")
    .insert({ obra_id: obraId, cliente_id: criado.user.id });

  if (erroVinculo) return { error: "Conta criada, mas não foi possível vincular à obra." };

  // Mesma precaução da função acima: a origem sai de configuração, não do
  // header `Host`, que quem faz a requisição controla e poderia apontar o
  // link com token para outro domínio.
  const headersList = await headers();
  const origin =
    process.env.NEXT_PUBLIC_SITE_URL ??
    `${headersList.get("x-forwarded-proto") ?? "http"}://${headersList.get("host")}`;

  const { error: erroConvite } = await admin.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/atualizar-senha`,
  });

  revalidatePath(`/obras/${obraId}`);
  revalidatePath("/clientes");

  if (erroConvite) {
    // Cadastro e vínculo estão de pé; só o e-mail não saiu. Dizer "sucesso"
    // faria o engenheiro acreditar que o cliente foi avisado.
    return {
      error: null,
      success: true,
      aviso:
        "Cliente cadastrado e vinculado, mas o e-mail de acesso não saiu (limite do provedor). " +
        "Reenvie a definição de senha pelo painel do Supabase.",
    };
  }

  return { error: null, success: true };
}
