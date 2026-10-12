import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

/*
 * O proxy cuida de sessão, então arquivo estático não passa por ele.
 *
 * A lista de extensões cobria só imagens, e o modelo de planilha em
 * `public/modelo-orcamento.xlsx` caía na checagem de sessão: a requisição do
 * download virava um redirect para /login. Arquivo em `public/` é público por
 * definição — gatear isso não protege nada e quebra o link.
 */
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|xlsx|xls|csv|pdf|txt|woff2?|ttf|mp4|webm)$).*)",
  ],
};
