import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/types/database.types";

/**
 * Renova a sessão Supabase a cada navegação. Chamado a partir de proxy.ts
 * (Next.js 16 renomeou middleware.ts para proxy.ts).
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  // `/auth/confirm` precisa rodar sem sessão — é justamente ele quem cria a
  // sessão a partir do link do e-mail. Sem esta exceção, o usuário sem sessão
  // era mandado para /login e o token do link se perdia.
  const isAuthRoute =
    pathname.startsWith("/login") ||
    pathname.startsWith("/atualizar-senha") ||
    pathname.startsWith("/auth/");

  if (!user && !isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return response;
}
