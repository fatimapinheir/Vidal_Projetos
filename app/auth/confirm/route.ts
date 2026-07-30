import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * Confirmação de links de e-mail no fluxo baseado em cookie (o que este app
 * usa em todo o resto).
 *
 * O modelo de e-mail padrão do Supabase manda o usuário para
 * `/auth/v1/verify`, que devolve a sessão no **fragmento** da URL — algo que o
 * servidor nunca recebe. Trocando o modelo para apontar aqui, com
 * `{{ .TokenHash }}`, a troca acontece no servidor: a sessão já chega como
 * cookie e o token nunca aparece na barra de endereço nem no histórico.
 *
 * No painel do Supabase, em Authentication → Email Templates:
 *
 *   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/atualizar-senha
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;

  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next");

  // `next` só pode ser caminho interno — sem isso o link viraria um redirecionador
  // aberto, e um link "do Vidal Projetos" poderia levar para fora.
  const destino = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";

  if (!tokenHash || !type) {
    return NextResponse.redirect(new URL("/login?erro=link_invalido", origin));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });

  if (error) {
    return NextResponse.redirect(
      new URL(`/login?erro=${encodeURIComponent(error.message)}`, origin)
    );
  }

  return NextResponse.redirect(
    new URL(type === "recovery" || type === "invite" ? "/atualizar-senha" : destino, origin)
  );
}
