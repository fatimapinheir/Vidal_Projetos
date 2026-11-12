"use server";

/*
 * Ações da CONTA: o perfil ativo, a senha e a obra de entrada.
 *
 * Separado de `app/actions/perfil.ts`, que trata dos dados profissionais do
 * engenheiro (nome, CREA, assinatura, logo da empresa). São dois assuntos: um
 * é "quem eu sou no sistema agora", o outro é "o que sai no cabeçalho do RDO".
 */

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/require-role";
import { papeisDoUsuario, destinoDoPerfil } from "@/lib/auth/papeis";
import type { UserRole } from "@/lib/types/database.types";
import { lerObraAtiva } from "@/lib/obra-ativa.server";

export type ContaFormState = { error: string | null; ok?: boolean };

const PAPEIS = ["engenheiro", "cliente"] as const;

/**
 * Troca o perfil ativo de quem está logado.
 *
 * São DOIS passos, e a ordem importa:
 *
 *   1. `trocar_perfil` no banco. É a autoridade: confere `papeis` e grava
 *      `profiles.role`, que é o que a RLS lê em toda consulta.
 *   2. `auth.updateUser({ data: { role } })`. É o que atualiza o metadata do
 *      token, de onde `getSessao` lê o papel sem ir ao banco. Sem este passo o
 *      acesso mudava na hora e o MENU ficava parado por até uma hora — a
 *      pessoa clicava em "ver como cliente" e continuava vendo o menu de
 *      engenheiro.
 *
 * Se o passo 2 falhar, o passo 1 é DESFEITO. Deixar os dois fora de sincronia
 * é o pior resultado possível: moldura de um perfil sobre telas vazias do
 * outro, sem nada na tela explicando por quê.
 */
export async function trocarPerfilAction(role: string): Promise<ContaFormState> {
  const sessao = await requireAuth();

  const alvo = PAPEIS.find((p) => p === role);
  if (!alvo) return { error: "Perfil inválido." };
  if (alvo === sessao.role) return { error: null, ok: true };

  const supabase = await createClient();

  const { error: erroBanco } = await supabase.rpc("trocar_perfil", { p_role: alvo });
  if (erroBanco) {
    return { error: erroBanco.message || "Não foi possível trocar de perfil." };
  }

  const { error: erroMetadata } = await supabase.auth.updateUser({ data: { role: alvo } });
  if (erroMetadata) {
    await desfazer(supabase, sessao.role);
    return { error: "Perfil trocado no banco, mas a sessão não acompanhou. Tente de novo." };
  }

  /*
   * O REFRESH é o passo que faz a troca aparecer na tela, e faltava.
   *
   * `updateUser` grava o metadata no `auth.users` e devolve o usuário novo —
   * mas NÃO reemite o access token. Olhando a implementação:
   *
   *     session.user = data.user;
   *     await this._saveSession(session);   // mesmo access_token
   *
   * Ele troca só o objeto `user` dentro da sessão guardada. O JWT, de onde
   * `getSessao` lê o papel sem ir ao banco, continua com o papel ANTIGO por
   * até uma hora.
   *
   * O efeito disso em produção não foi "nada acontece": foi pior. O banco
   * passava a tratar a pessoa como cliente (a RLS lê `profiles.role`) enquanto
   * o token continuava mandando desenhar a moldura de engenheiro — moldura de
   * um perfil sobre telas vazias do outro, e sem saída até o token expirar.
   *
   * `refreshSession` troca o refresh token por um access token novo, montado
   * a partir do `auth.users` que acabou de ser atualizado. É só com ele que os
   * dois lados passam a dizer a mesma coisa.
   */
  const { error: erroSessao } = await supabase.auth.refreshSession();
  if (erroSessao) {
    await desfazer(supabase, sessao.role);
    return {
      error: "Não foi possível renovar a sessão no perfil novo. Saia e entre de novo.",
    };
  }

  const [papeis, obraLembrada] = await Promise.all([
    papeisDoUsuario(supabase, sessao.id),
    lerObraAtiva(),
  ]);
  redirect(destinoDoPerfil(alvo, papeis?.obraPadraoId ?? null, obraLembrada));
}

/**
 * Volta tudo ao perfil anterior quando um dos passos da troca falha.
 *
 * Os TRÊS lugares precisam concordar — `profiles.role`, o metadata do usuário
 * e o token —, e parar no meio é o pior resultado possível: foi exatamente o
 * que aconteceu em produção, com o banco tratando a pessoa como cliente e a
 * tela desenhando a moldura de engenheiro.
 *
 * Melhor esforço: se o desfazer também falhar não há o que fazer daqui, e a
 * mensagem já manda sair e entrar de novo — um login novo emite token do
 * zero e realinha os três.
 */
async function desfazer(
  supabase: Awaited<ReturnType<typeof createClient>>,
  papelAnterior: UserRole
) {
  await supabase.rpc("trocar_perfil", { p_role: papelAnterior });
  await supabase.auth.updateUser({ data: { role: papelAnterior } });
  await supabase.auth.refreshSession();
}

const senhaSchema = z
  .object({
    atual: z.string().min(1, "Informe a senha atual."),
    nova: z.string().min(8, "A senha nova precisa de ao menos 8 caracteres."),
    confirmacao: z.string().min(1, "Repita a senha nova."),
  })
  .refine((d) => d.nova === d.confirmacao, {
    message: "As duas senhas novas não são iguais.",
    path: ["confirmacao"],
  })
  .refine((d) => d.nova !== d.atual, {
    message: "A senha nova é igual à atual.",
    path: ["nova"],
  });

/**
 * Troca a própria senha, sem passar pela recuperação por email.
 *
 * A senha ATUAL é exigida e conferida de verdade, com um
 * `signInWithPassword` — e não por confiança na sessão. Sem isso, qualquer
 * pessoa que alcançasse um navegador já logado (celular destravado, máquina do
 * escritório) trocaria a senha e tomaria a conta. `updateUser` sozinho aceita
 * só a sessão, por isso a conferência é nossa.
 *
 * O `signInWithPassword` reescreve os cookies da sessão — do MESMO usuário,
 * então não há troca de identidade; é o custo de verificar a senha com a única
 * operação que o Supabase oferece para isso.
 */
export async function alterarSenhaAction(
  _prev: ContaFormState,
  formData: FormData
): Promise<ContaFormState> {
  // O retorno não é usado; a chamada é o portão: sem sessão, redireciona.
  await requireAuth();

  const parsed = senhaSchema.safeParse({
    atual: formData.get("senha_atual"),
    nova: formData.get("senha_nova"),
    confirmacao: formData.get("senha_confirmacao"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();

  const { data: usuario } = await supabase.auth.getUser();
  const email = usuario.user?.email;
  if (!email) {
    return { error: "Esta conta não tem email cadastrado; a senha não pode ser trocada aqui." };
  }

  const { error: erroAtual } = await supabase.auth.signInWithPassword({
    email,
    password: parsed.data.atual,
  });
  if (erroAtual) return { error: "A senha atual está incorreta." };

  const { error: erroNova } = await supabase.auth.updateUser({ password: parsed.data.nova });
  if (erroNova) {
    /*
     * A mensagem do Supabase é útil aqui e vem em inglês. A que importa na
     * prática é a de senha vazada ("Password is known to be weak"), quando a
     * checagem de senha comprometida está ligada no projeto.
     */
    return { error: erroNova.message || "Não foi possível alterar a senha." };
  }

  // O nome do usuário aparece na moldura; nada mais muda na tela.
  revalidatePath("/", "layout");
  return { error: null, ok: true };
}

/** As obras que a pessoa pode escolher como padrão, pelo perfil que ela tem. */
export async function obrasParaPadrao(): Promise<{ id: string; nome: string }[]> {
  await requireAuth();
  const supabase = await createClient();

  /*
   * Sem filtro de papel aqui: a RLS de `obras` já resolve: o engenheiro vê
   * todas, o cliente só as dele (`cliente_tem_acesso_obra`). Filtrar de novo
   * no TypeScript seria repetir a regra num lugar onde ela pode divergir.
   */
  const { data } = await supabase.from("obras").select("id, nome").order("nome");
  return data ?? [];
}

export async function definirObraPadraoAction(obraId: string | null): Promise<ContaFormState> {
  await requireAuth();
  const supabase = await createClient();

  const { error } = await supabase.rpc("definir_obra_padrao", {
    p_obra_id: obraId && obraId.length ? obraId : null,
  });

  if (error) return { error: error.message || "Não foi possível salvar a obra padrão." };

  revalidatePath("/", "layout");
  return { error: null, ok: true };
}
