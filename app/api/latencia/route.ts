import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * ROTA TEMPORÁRIA DE MEDIÇÃO — remover depois de decidir sobre a hospedagem.
 *
 * Existe para responder uma pergunta que não dá para responder de fora: quanto
 * custa UMA ida e volta ao banco a partir da função que serve o site. De fora
 * só dá para medir o total; o que decide se vale mudar de hospedagem é a
 * parcela que é distância entre a função e o Postgres.
 *
 * Não lê dado de ninguém: a consulta é `select 1` através do PostgREST, e o
 * que volta são tempos e a região da função. Mesmo assim fica atrás de sessão,
 * porque rota aberta é superfície aberta.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();

  // Sem sessão não responde — medir não precisa ser público.
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) {
    return NextResponse.json({ erro: "sem sessão" }, { status: 401 });
  }

  const amostras: number[] = [];
  for (let i = 0; i < 15; i += 1) {
    const inicio = performance.now();
    // Consulta mais barata possível com resposta real: uma linha, uma coluna,
    // por chave primária. O que sobra no tempo é ida e volta.
    await supabase.from("obras").select("id").limit(1);
    amostras.push(performance.now() - inicio);
  }

  amostras.sort((a, b) => a - b);
  const mediana = amostras[Math.floor(amostras.length / 2)];

  return NextResponse.json({
    regiao_da_funcao: process.env.AWS_REGION ?? process.env.NETLIFY_REGION ?? "desconhecida",
    ida_e_volta_ao_banco_ms: {
      min: Math.round(amostras[0]),
      mediana: Math.round(mediana),
      max: Math.round(amostras[amostras.length - 1]),
      amostras: amostras.map((a) => Math.round(a)),
    },
  });
}
