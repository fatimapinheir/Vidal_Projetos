import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";

/**
 * Mede onde o tempo de uma tela vai, em produção.
 *
 * FERRAMENTA DE DIAGNÓSTICO, PARA REMOVER DEPOIS. Existe porque a troca de
 * tela leva de 2 a 3 segundos e três hipóteses competiam sem que desse para
 * separá-las de fora:
 *
 *   1. partida a frio da função (medido em /login: 1,46s frio contra 0,33s quente);
 *   2. latência até o Supabase — as funções da Netlify rodam em IAD (Virgínia)
 *      e o Postgres está em São Paulo, ~7.500 km de ida e volta;
 *   3. tempo de renderizar a página (211 itens em tabela, no caso do orçamento).
 *
 * Da minha máquina eu só consigo medir a tela de login, que não faz consulta
 * nenhuma. Esta rota roda DENTRO da função, no mesmo caminho das telas reais,
 * e devolve a conta separada.
 *
 * Não expõe dado de obra: só quantidade de linhas e milissegundos. Ainda assim
 * exige papel de engenheiro, porque revela a topologia da infraestrutura.
 */

/*
 * Escopo de MÓDULO, e é isso que detecta instância fria.
 *
 * Uma função serverless guarda o módulo entre invocações enquanto a instância
 * vive. Se esta variável chega aqui nula, este processo acabou de nascer — e o
 * custo de partida a frio está dentro desta requisição.
 */
let instanciaNasceuEm: number | null = null;
let invocacoesNestaInstancia = 0;

/** Executa algo medindo o relógio. */
async function medir<T>(fn: () => PromiseLike<T>): Promise<{ ms: number; valor: T }> {
  // `PromiseLike`: o construtor de consulta do supabase-js é "thenable" mas não
  // é uma Promise completa — não tem `catch` nem `finally`.
  const t0 = performance.now();
  const valor = await fn();
  return { ms: Math.round(performance.now() - t0), valor };
}

export async function GET() {
  const t0 = performance.now();

  const fria = instanciaNasceuEm === null;
  if (fria) instanciaNasceuEm = Date.now();
  invocacoesNestaInstancia += 1;

  // O papel vem antes de qualquer medição: quem não é engenheiro nem chega aqui.
  await requireRole("engenheiro");
  const msAutenticacao = Math.round(performance.now() - t0);

  const supabase = await createClient();

  /*
   * A PRIMEIRA consulta paga o aperto de mão TLS com o Supabase; a SEGUNDA
   * mede a ida e volta pura. A diferença entre as duas é o custo de abrir a
   * conexão, que é o que mais dói quando a função é fria.
   *
   * As duas pedem a mesma coisa, de propósito: assim a diferença é só conexão,
   * não trabalho de banco.
   */
  const primeira = await medir(() =>
    supabase.from("obras").select("id", { count: "exact", head: true })
  );
  const segunda = await medir(() =>
    supabase.from("obras").select("id", { count: "exact", head: true })
  );

  // Uma obra qualquer, para as etapas seguintes terem sobre o que medir.
  const { data: obra } = await supabase.from("obras").select("id").limit(1).maybeSingle();
  const obraId = obra?.id ?? null;

  /*
   * As quatro camadas que uma navegação atravessa hoje, na mesma ordem e com o
   * mesmo paralelismo das telas reais. Cada bloco só começa quando o anterior
   * termina — é essa sequência que multiplica a latência.
   */
  const camadas: Record<string, number> = {};

  if (obraId) {
    camadas.layout_engenheiro = (
      await medir(() =>
        Promise.all([
          /*
           * Só a logo. O papel saiu daqui: `requireRole` passou a ler do token
           * e não vai mais ao banco (ver `lib/auth/sessao`). Esta camada ainda
           * custa uma ida por causa da logo da empresa, que não viaja no token.
           */
          supabase.from("profiles").select("logo_path").limit(1),
        ])
      )
    ).ms;

    camadas.layout_obra = (
      await medir(() =>
        Promise.all([
          supabase
            .from("obras")
            .select("status, logradouro, numero, complemento, bairro, cidade, uf")
            .eq("id", obraId)
            .single(),
          supabase.from("obras").select("id, nome").order("nome"),
        ])
      )
    ).ms;

    const versoes = await medir(() =>
      Promise.all([
        supabase
          .from("orcamento_versoes")
          .select("id, titulo, mes_referencia, etapas")
          .eq("obra_id", obraId)
          .eq("status", "ativa")
          .maybeSingle(),
        supabase
          .from("vw_orcamento_versao_resumo")
          .select("versao_id, itens, total")
          .eq("obra_id", obraId)
          .eq("status", "substituida"),
      ])
    );
    camadas.orcamento_versoes = versoes.ms;

    const versaoAtivaId = versoes.valor[0].data?.id ?? null;

    if (versaoAtivaId) {
      const itens = await medir(() =>
        Promise.all([
          supabase
            .from("orcamento_itens")
            .select(
              "id, codigo_sinapi, descricao, unidade, quantidade, preco_unitario, preco_total, etapa, tipo_item"
            )
            .eq("orcamento_versao_id", versaoAtivaId)
            .order("ordem")
            .order("id")
            .range(0, 999),
          supabase.from("compras").select("valor_total, status, orcamento_etapa").eq("obra_id", obraId),
          supabase.from("vw_progresso_obra").select("*").eq("obra_id", obraId).maybeSingle(),
        ])
      );
      camadas.orcamento_itens = itens.ms;
      camadas.itens_encontrados = itens.valor[0].data?.length ?? 0;
    }
  }

  const msTotal = Math.round(performance.now() - t0);
  const somaCamadas = Object.entries(camadas)
    .filter(([k]) => k !== "itens_encontrados")
    .reduce((s, [, v]) => s + v, 0);

  const resposta = {
    instancia: {
      fria,
      invocacoes_nesta_instancia: invocacoesNestaInstancia,
      viva_ha_segundos: instanciaNasceuEm
        ? Math.round((Date.now() - instanciaNasceuEm) / 1000)
        : 0,
    },
    conexao_com_o_supabase: {
      primeira_consulta_ms: primeira.ms,
      segunda_consulta_ms: segunda.ms,
      /*
       * A segunda é a ida e volta pura. Perto de 5ms significa função e banco
       * na mesma região; perto de 120ms significa Virgínia falando com São
       * Paulo, que é o que eu suspeito.
       */
      custo_de_abrir_conexao_ms: Math.max(0, primeira.ms - segunda.ms),
    },
    camadas_da_navegacao: camadas,
    totais: {
      autenticacao_ms: msAutenticacao,
      soma_das_camadas_ms: somaCamadas,
      total_da_rota_ms: msTotal,
    },
  };

  return NextResponse.json(resposta, {
    headers: {
      // Aparece na aba Network do navegador, em "Timing", sem precisar ler o JSON.
      "Server-Timing": [
        `frio;desc="instancia fria=${fria}"`,
        `auth;dur=${msAutenticacao}`,
        `conexao;dur=${primeira.ms}`,
        `rtt;dur=${segunda.ms}`,
        `camadas;dur=${somaCamadas}`,
        `total;dur=${msTotal}`,
      ].join(", "),
      // Nunca cachear: o ponto é medir o caminho real a cada vez.
      "Cache-Control": "no-store",
    },
  });
}
