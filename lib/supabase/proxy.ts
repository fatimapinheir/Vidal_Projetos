import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/types/database.types";
import { chavesDoProjeto } from "@/lib/auth/chaves-do-projeto";

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

  /*
   * `getClaims()` e não `getUser()`: a sessão é verificada AQUI, sem ir à rede.
   *
   * `getUser()` faz uma chamada HTTP ao servidor de autenticação a cada
   * requisição — e o proxy roda em TODA navegação, antes de qualquer consulta
   * da página. No registro do servidor isso aparecia como `proxy.ts: 187ms`,
   * `529ms`, `857ms`, e uma vez `7,2s`: era o piso de qualquer troca de tela.
   *
   * Este projeto assina os tokens com chave ASSIMÉTRICA (ES256 — confirmado no
   * JWKS do projeto), então `getClaims()` baixa a chave pública uma vez, guarda
   * em memória e daí em diante confere a assinatura e a validade localmente.
   * Medido: 27ms de ida à rede contra menos de 1ms de verificação local.
   *
   * A chave vem de `chavesDoProjeto()`, com cache no módulo. Sem passá-la, a
   * biblioteca guardaria o JWKS DENTRO da instância do cliente — e como aqui
   * se cria uma instância por requisição, ela iria buscar o JWKS toda vez:
   * uma ida à rede trocada por outra.
   *
   * O que se perde: `getUser()` pergunta ao servidor se a conta ainda existe e
   * não foi banida. Com verificação local, uma sessão revogada continua válida
   * até o token expirar — cerca de uma hora. O que NÃO se perde é controle de
   * acesso: papel e permissão saem de `profiles` a cada consulta, pela RLS,
   * então rebaixar alguém tem efeito imediato.
   */
  const { data: sessao } = await supabase.auth.getClaims(undefined, {
    jwks: await chavesDoProjeto(),
  });
  const autenticado = !!sessao?.claims?.sub;

  const { pathname } = request.nextUrl;
  // `/auth/confirm` precisa rodar sem sessão — é justamente ele quem cria a
  // sessão a partir do link do e-mail. Sem esta exceção, o usuário sem sessão
  // era mandado para /login e o token do link se perdia.
  const isAuthRoute =
    pathname.startsWith("/login") ||
    pathname.startsWith("/atualizar-senha") ||
    pathname.startsWith("/auth/");

  if (!autenticado && !isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return response;
}
