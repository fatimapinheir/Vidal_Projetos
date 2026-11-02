import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { chavesDoProjeto } from "@/lib/auth/chaves-do-projeto";
import type { UserRole } from "@/lib/types/database.types";

/** Quem está logado — o suficiente para roteamento e para a moldura da tela. */
export type Sessao = { id: string; nome: string; role: UserRole };

const PAPEIS: readonly string[] = ["engenheiro", "cliente"];

/**
 * Quem está logado, SEM ir ao banco.
 *
 * Isto custava 431 ms em toda navegação. Medido em produção, com a rota de
 * diagnóstico: a função da Netlify roda em IAD (Virgínia) e o Postgres está em
 * São Paulo, e uma ida e volta entre os dois custa isso — quente, com a conexão
 * já aberta. Da minha máquina no Ceará, a mesma consulta leva 50 ms.
 *
 * Uma navegação atravessava CINCO esperas dessas em fila, e esta era a
 * primeira: antes de qualquer dado da tela, o sistema perguntava ao banco qual
 * o papel de quem está logado — informação que já viaja assinada no token.
 *
 * O token é uma fotografia, então o papel aqui pode estar até uma hora
 * desatualizado (é o tempo de validade padrão do access token do Supabase).
 * ISSO NÃO É BRECHA DE ACESSO, e vale entender por quê: quem decide o que cada
 * pessoa lê e grava é a RLS, e `is_engenheiro()` consulta `profiles` NO BANCO —
 *
 *     select exists (select 1 from profiles where id = auth.uid() and role = 'engenheiro')
 *
 * — a cada consulta, sempre. O papel lido aqui só decide qual menu desenhar e
 * para onde redirecionar. Alguém rebaixado e ainda com token antigo veria a
 * moldura de engenheiro por alguns minutos, e cada consulta dentro dela
 * voltaria vazia.
 *
 * Trocar o papel de alguém é feito à mão no SQL hoje. Quem fizer isso e quiser
 * efeito imediato na NAVEGAÇÃO também, além do acesso: apagar as sessões da
 * pessoa em `auth.sessions` força um login novo.
 */
export const getSessao = cache(async (): Promise<Sessao | null> => {
  const supabase = await createClient();

  const { data } = await supabase.auth.getClaims(undefined, {
    jwks: await chavesDoProjeto(),
  });

  const claims = data?.claims;
  const id = claims?.sub;
  if (!id) return null;

  /*
   * `claims.role` é o papel do POSTGRES ("authenticated"), não o do app. O
   * nosso vive em `user_metadata`, que é o `raw_user_meta_data` do
   * `auth.users` — confundir os dois daria "authenticated" como papel e
   * mandaria todo mundo para a tela errada.
   */
  const meta = (claims.user_metadata ?? {}) as Record<string, unknown>;
  const papel = typeof meta.role === "string" ? meta.role : null;
  const nome = typeof meta.nome === "string" ? meta.nome : null;

  /*
   * Sem papel ou nome no token, cai no banco.
   *
   * Hoje os quatro usuários têm os dois no metadata — conferi —, mas um usuário
   * criado por fora, ou um token emitido antes de o campo existir, não teria.
   * Preferir o caminho lento a errar o papel de alguém.
   */
  if (!papel || !PAPEIS.includes(papel) || !nome) {
    const { data: perfil } = await supabase
      .from("profiles")
      .select("id, nome, role")
      .eq("id", id)
      .single();

    return perfil ? { id: perfil.id, nome: perfil.nome, role: perfil.role } : null;
  }

  return { id, nome, role: papel as UserRole };
});
