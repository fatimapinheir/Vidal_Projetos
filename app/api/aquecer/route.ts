import { NextResponse } from "next/server";

/**
 * Acorda a função de servidor enquanto a pessoa digita a senha.
 *
 * POR QUE EXISTE: a página de login é HTML estático, servida pelo CDN — ela
 * aparece em ~200ms sem encostar na função Node. Só que a função continua
 * fria, e a espera reaparecia no clique em "Entrar", que é uma Server Action.
 * Medido em produção: 4,76s para a função subir, contra ~210ms já quente.
 *
 * A página chama esta rota ao carregar. Preencher e-mail e senha leva uns 10 a
 * 15 segundos — tempo de sobra para o servidor subir em paralelo. Quando o
 * formulário é enviado, já está quente.
 *
 * NÃO É GARANTIA: são várias instâncias da função, e nada assegura que o envio
 * cairá na mesma que foi aquecida. Melhora muito as chances num site de pouco
 * tráfego; não elimina o caso.
 *
 * Não toca em banco, sessão nem cookie, e não devolve corpo: subir o processo
 * do Node e carregar o runtime do Next é todo o trabalho que se quer aqui.
 */

// Sem isto a rota seria pré-renderizada e respondida pelo CDN — o que a
// tornaria rápida e completamente inútil, porque a função nunca acordaria.
export const dynamic = "force-dynamic";

export function GET() {
  return new NextResponse(null, {
    status: 204,
    // Cinto e suspensório: `force-dynamic` resolve no build, `no-store` impede
    // que qualquer camada de cache no caminho guarde a resposta.
    headers: { "Cache-Control": "no-store" },
  });
}
