import { redirect } from "next/navigation";
import { getSessao, type Sessao } from "@/lib/auth/sessao";
import type { UserRole } from "@/lib/types/database.types";

/**
 * Garante que quem está logado tem o papel esperado. Usado nos layouts de
 * `app/(engenheiro)` e `app/(cliente)`. Redireciona para /login se não houver
 * sessão, ou para o painel certo se o papel não bate.
 *
 * Isto é ROTEAMENTO, não autorização. Quem decide o que cada pessoa lê e grava
 * é a RLS, que consulta `profiles` no banco a cada consulta — ver a nota em
 * `lib/auth/sessao`. Por isso aqui o papel vem do token, de graça, em vez de
 * custar uma ida de 431 ms ao banco em toda navegação.
 */
export async function requireRole(role: UserRole): Promise<Sessao> {
  const sessao = await getSessao();

  if (!sessao) {
    redirect("/login");
  }

  if (sessao.role !== role) {
    redirect(sessao.role === "engenheiro" ? "/dashboard" : "/portal/dashboard");
  }

  return sessao;
}

/**
 * Só exige sessão, sem olhar o papel.
 *
 * Para o punhado de ações que engenheiro e cliente compartilham — criar uma
 * categoria financeira, registrar um lançamento. Quem restringe o que cada um
 * pode gravar é a RLS; aqui só se garante que há alguém logado.
 */
export async function requireAuth(): Promise<Sessao> {
  const sessao = await getSessao();
  if (!sessao) redirect("/login");
  return sessao;
}
