import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { TableBody, TableRow, TableCell } from "@/components/ui/table";
import { TabelaAjustavel, type ColunaAjustavel } from "@/components/ui/tabela-ajustavel";
import { FiltrosDaLista } from "@/components/ui/filtros-da-lista";
import { CompraStatusBadge } from "@/components/compras/status-badges";
import { BotaoExcluir } from "@/components/ui/botao-excluir";
import { excluirCompra } from "@/app/actions/compras";
import {
  LancamentosSemEtapa,
  type LancamentoSemEtapa,
} from "@/components/compras/lancamentos-sem-etapa";
import { etapasDoOrcamentoAtivo } from "@/lib/compras/etapa-orcamento";
import { Paginacao } from "@/components/ui/paginacao";
import { faixaDaPagina, lerPagina, POR_PAGINA_PADRAO } from "@/lib/paginacao";
import {
  SituacaoFinanceiraBadge,
  SituacaoEntregaBadge,
} from "@/components/compras/situacao-badges";
import {
  situacaoFinanceiraCompra,
  situacaoEntregaCompra,
  contagemPagas,
  type ParcelaSituacao,
} from "@/lib/compras/situacao";

/*
 * As larguras de partida, em pixels.
 *
 * Somam 915, que cabe na área útil de uma tela de 1366 com o menu aberto — e é
 * esse número que tira a necessidade de baixar o zoom do navegador para 75%
 * só para ver a coluna de ações. Descrição e fornecedor ficam curtas de
 * propósito: são os dois textos longos, e eram eles que empurravam o resto
 * para fora. Quem precisar do texto inteiro arrasta a alça do cabeçalho, e a
 * escolha fica guardada.
 */
const COLUNAS: ColunaAjustavel[] = [
  { chave: "descricao", titulo: "Descrição", largura: 200, minima: 110 },
  { chave: "fornecedor", titulo: "Fornecedor", largura: 150, minima: 100 },
  { chave: "valor", titulo: "Valor", largura: 105, minima: 90, direita: true },
  { chave: "aprovacao", titulo: "Aprovação", largura: 100, minima: 90 },
  // Mais larga que as vizinhas: "Aguardando recebimento" é o rótulo mais
  // comprido do sistema, e ele mora aqui.
  { chave: "financeiro", titulo: "Financeiro", largura: 150, minima: 110 },
  { chave: "entrega", titulo: "Entrega", largura: 110, minima: 90 },
  // A de ações tem a largura dos dois botões dentro dela; espremê-la só
  // quebraria a linha.
  { chave: "acoes", titulo: "", largura: 100, direita: true, fixa: true },
];

/*
 * As ordenações oferecidas, e o que cada uma faz no banco.
 *
 * Todas ordenam a LISTA INTEIRA, não a página: com 25 linhas por vez, ordenar
 * no navegador responderia "o maior valor desta página", que é outra pergunta.
 *
 * "Vencidas primeiro" usa `ordem_situacao` da view (0060), que repete em SQL a
 * mesma gravidade de `lib/compras/situacao.ts`. O vencimento mais próximo
 * desempata dentro de cada situação — entre duas vencidas, a mais antiga dói
 * mais.
 */
const ORDENS = [
  {
    valor: "recentes",
    rotulo: "Mais recentes",
    criterios: [{ coluna: "data_cotacao", ascendente: false }],
  },
  {
    valor: "antigas",
    rotulo: "Mais antigas",
    criterios: [{ coluna: "data_cotacao", ascendente: true }],
  },
  {
    valor: "az",
    rotulo: "Descrição (A–Z)",
    criterios: [{ coluna: "descricao", ascendente: true }],
  },
  {
    valor: "za",
    rotulo: "Descrição (Z–A)",
    criterios: [{ coluna: "descricao", ascendente: false }],
  },
  {
    valor: "maior",
    rotulo: "Maior valor",
    criterios: [{ coluna: "valor_total", ascendente: false }],
  },
  {
    valor: "menor",
    rotulo: "Menor valor",
    criterios: [{ coluna: "valor_total", ascendente: true }],
  },
  {
    valor: "situacao",
    rotulo: "Vencidas primeiro",
    criterios: [
      { coluna: "ordem_situacao", ascendente: true },
      { coluna: "proximo_vencimento", ascendente: true },
    ],
  },
] as const;

export default async function ComprasObraPage({
  params,
  searchParams,
}: {
  params: Promise<{ obraId: string }>;
  searchParams: Promise<{
    pagina?: string;
    busca?: string;
    ordem?: string;
    de?: string;
    ate?: string;
    min?: string;
    max?: string;
  }>;
}) {
  const { obraId } = await params;
  const f = await searchParams;
  const supabase = await createClient();

  const busca = (f.busca ?? "").trim();
  /*
   * O termo perde os caracteres de significado especial.
   *
   * `, ( ) *` quebram a mini-linguagem de filtro do PostgREST; `% _ \` são
   * curingas do LIKE. Os cinco são REMOVIDOS, não escapados, porque a soma do
   * rodapé vem de `somar_compras_da_obra` no banco e as duas consultas têm de
   * encontrar o mesmo conjunto — senão a tela diz "8 resultados" e soma um
   * nono. Remover é a única regra que os dois lados expressam igual.
   */
  const termo = busca.replace(/[,()*%_\\]/g, " ").replace(/\s+/g, " ").trim();

  // O que vier de fora da lista conhecida vale como "sem filtro": a URL é
  // digitável, e ordenação inventada não pode virar consulta.
  const ordem = ORDENS.find((o) => o.valor === f.ordem) ?? ORDENS[0];
  const soData = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);
  const soNumero = (v?: string) => {
    const n = Number(v);
    return v && Number.isFinite(n) && n >= 0 ? n : undefined;
  };
  const de = soData(f.de);
  const ate = soData(f.ate);
  const min = soNumero(f.min);
  const max = soNumero(f.max);

  /*
   * Os filtros são repetidos na contagem e nas linhas, à mão.
   *
   * Tentei extrair num ajudante genérico e o tipo do construtor de consultas
   * do Supabase não atravessa a generalização sem virar `any` — e `any` aqui
   * apagaria justamente a checagem de nome de coluna. O que não pode é
   * divergirem: a paginação contaria um conjunto e mostraria outro.
   */
  let contagem = supabase
    .from("vw_compras_lista")
    .select("id", { count: "exact", head: true })
    .eq("obra_id", obraId);
  let linhas = supabase.from("vw_compras_lista").select("*").eq("obra_id", obraId);

  if (de) {
    contagem = contagem.gte("data_cotacao", de);
    linhas = linhas.gte("data_cotacao", de);
  }
  if (ate) {
    contagem = contagem.lte("data_cotacao", ate);
    linhas = linhas.lte("data_cotacao", ate);
  }
  if (min !== undefined) {
    contagem = contagem.gte("valor_total", min);
    linhas = linhas.gte("valor_total", min);
  }
  if (max !== undefined) {
    contagem = contagem.lte("valor_total", max);
    linhas = linhas.lte("valor_total", max);
  }
  if (termo) {
    // Uma consulta só: o nome do fornecedor vem na view (0060). Antes era
    // preciso descobrir os fornecedores que casavam e procurar pelos ids.
    const condicao = `descricao.ilike.%${termo}%,fornecedor_nome.ilike.%${termo}%`;
    contagem = contagem.or(condicao);
    linhas = linhas.or(condicao);
  }

  /*
   * Soma e contagem vão juntas — e a soma vem do BANCO, não das linhas.
   *
   * Somar o que está na tela responderia "quanto há nesta página" em vez de
   * "quanto o filtro encontrou", e trazer todas as linhas só para somá-las
   * esbarraria no teto de 1000 do PostgREST, que corta em silêncio.
   */
  const [{ count }, { data: somaFiltrada }] = await Promise.all([
    contagem,
    supabase.rpc("somar_compras_da_obra", {
      p_obra_id: obraId,
      p_busca: termo || null,
      p_data_de: de ?? null,
      p_data_ate: ate ?? null,
      p_valor_de: min ?? null,
      p_valor_ate: max ?? null,
    }),
  ]);

  const total = count ?? 0;
  const { pagina, de: fatiaDe, ate: fatiaAte } = faixaDaPagina(lerPagina(f.pagina), total);

  for (const criterio of ordem.criterios) {
    linhas = linhas.order(criterio.coluna, {
      ascending: criterio.ascendente,
      nullsFirst: false,
    });
  }

  const { data: compras } = await linhas.range(fatiaDe, fatiaAte);

  const idsNaPagina = (compras ?? []).map((c) => c.id);

  const [{ data: parcelas }, etapasOrcamento] = await Promise.all([
    /*
     * Só as parcelas das ordens DESTA página.
     *
     * Antes vinham as da obra inteira, numa consulta sem limite: numa obra com
     * algumas centenas de ordens isso passaria das 1000 linhas que o PostgREST
     * devolve, e os selos de situação começariam a sair errados — sem erro
     * nenhum, só parcela faltando.
     */
    idsNaPagina.length
      ? supabase.from("vw_compra_parcelas").select("*").in("compra_id", idsNaPagina)
      : Promise.resolve({ data: [] as never[] }),
    etapasDoOrcamentoAtivo(supabase, obraId),
  ]);

  /*
   * Lançamentos sem etapa que vieram do cliente.
   *
   * O corte é "quem registrou é cliente", não "está sem etapa": o lançamento
   * do próprio engenheiro sem etapa foi escolha dele — o campo estava na tela
   * e ele marcou "não vincular". Cobrar isso de volta seria o sistema
   * discordando de uma decisão que ele tomou.
   *
   * Uma consulta só para os papéis, e só dos candidatos: a lista já é por
   * obra, e perguntar o papel de cada criador linha a linha seria uma dúzia de
   * idas ao banco para desenhar um aviso.
   */
  const candidatos = (compras ?? []).filter(
    (c) => c.eh_lancamento && !c.orcamento_etapa && c.criado_por
  );

  const { data: criadores } = candidatos.length
    ? await supabase
        .from("profiles")
        .select("id, nome, role")
        .in("id", [...new Set(candidatos.map((c) => c.criado_por!))])
    : { data: null };

  const clientePorId = new Map(
    (criadores ?? []).filter((p) => p.role === "cliente").map((p) => [p.id, p.nome])
  );

  const lancamentosSemEtapa: LancamentoSemEtapa[] = candidatos
    .filter((c) => clientePorId.has(c.criado_por!))
    .map((c) => ({
      id: c.id,
      descricao: c.descricao,
      valor: c.valor_total,
      fornecedor: c.fornecedor_nome,
      registradoPor: clientePorId.get(c.criado_por!) ?? "cliente",
    }));

  const parcelasPorCompra = new Map<string, ParcelaSituacao[]>();
  for (const parcela of parcelas ?? []) {
    const daCompra = parcelasPorCompra.get(parcela.compra_id) ?? [];
    daCompra.push(parcela);
    parcelasPorCompra.set(parcela.compra_id, daCompra);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Ordens de compra de material dessa obra.</p>
        <div className="flex flex-wrap items-center gap-2">
          {/* Lançamento antes da ordem na ordem de leitura? Não: a ordem de
              compra é o fluxo principal e fica com o botão cheio. O
              lançamento é o atalho para o que já foi pago, e botão de
              contorno é o peso certo para ele. */}
          <Button
            nativeButton={false}
            variant="outline"
            render={
              <Link href={`/obras/${obraId}/compras/lancamento`}>Novo lançamento</Link>
            }
          />
          <Button
            nativeButton={false}
            render={<Link href={`/obras/${obraId}/compras/novo`}>Nova ordem de compra</Link>}
          />
        </div>
      </div>

      <LancamentosSemEtapa lancamentos={lancamentosSemEtapa} etapas={etapasOrcamento} />

      <FiltrosDaLista
        base={`/obras/${obraId}/compras`}
        busca={busca}
        placeholder="Buscar por descrição ou fornecedor..."
        ordem={ordem.valor}
        ordens={ORDENS.map((o) => ({ valor: o.valor, rotulo: o.rotulo }))}
        campos={[
          { chave: "de", rotulo: "Lançadas de", tipo: "data" },
          { chave: "ate", rotulo: "até", tipo: "data" },
          { chave: "min", rotulo: "Valor de (R$)", tipo: "numero", dica: "0,00" },
          { chave: "max", rotulo: "até (R$)", tipo: "numero", dica: "0,00" },
        ]}
        valores={{ de: de ?? "", ate: ate ?? "", min: f.min ?? "", max: f.max ?? "" }}
        resultados={total}
        soma={Number(somaFiltrada ?? 0).toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL",
        })}
      />

      <TabelaAjustavel id="ordens-de-compra" colunas={COLUNAS}>
        <TableBody>
          {compras?.map((c) => {
            const suasParcelas = parcelasPorCompra.get(c.id) ?? [];
            const { total, pagas } = contagemPagas(suasParcelas);
            return (
              <TableRow key={c.id}>
                {/*
                  `truncate` e `title` andam juntos: a coluna tem largura
                  fixa, e o que não couber precisa continuar legível de
                  alguma forma — pelo repouso do ponteiro, ou alargando a
                  coluna pela alça do cabeçalho.
                */}
                <TableCell className="truncate font-medium" title={c.descricao}>
                  {c.descricao}
                </TableCell>
                <TableCell className="truncate" title={c.fornecedor_nome ?? undefined}>
                  {c.fornecedor_nome}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {c.valor_total.toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })}
                </TableCell>
                {/*
                  `overflow-hidden` nos selos: a coluna tem largura fixa, e
                  sem isto um rótulo longo — "Aguardando recebimento" — vaza
                  por cima da coluna vizinha em vez de ser cortado.
                */}
                <TableCell className="overflow-hidden">
                  <CompraStatusBadge status={c.status} />
                </TableCell>
                <TableCell className="overflow-hidden">
                  <SituacaoFinanceiraBadge
                    situacao={situacaoFinanceiraCompra(suasParcelas)}
                    complemento={
                      total > 1 && pagas > 0 && pagas < total
                        ? `${pagas} de ${total} pagas`
                        : undefined
                    }
                  />
                </TableCell>
                <TableCell className="overflow-hidden">
                  <SituacaoEntregaBadge situacao={situacaoEntregaCompra(suasParcelas)} />
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      nativeButton={false}
                      render={<Link href={`/obras/${obraId}/compras/${c.id}`}>Abrir</Link>}
                    />
                    {/*
                      `BotaoExcluir`, e não um diálogo por linha.
                      
                      O diálogo montava um `Dialog` inteiro — raiz, gatilho,
                      portal, cabeçalho, descrição e rodapé — para CADA uma das
                      25 linhas da página. Duzentas instâncias de componente só
                      para desenhar vinte e cinco lixeiras que quase nunca são
                      clicadas.
                      
                      A confirmação continua, com o mesmo texto: o valor sai do
                      custo da obra na hora e não há desfazer.
                    */}
                    <BotaoExcluir
                      rotulo={`Excluir ${c.eh_lancamento ? "lançamento" : "ordem de compra"}`}
                      confirmacao={`Excluir "${c.descricao}"?\n\nEla sai do custo da obra junto com os itens, ${c.eh_lancamento ? "o pagamento" : "as parcelas"} e os arquivos anexados. Não há como desfazer.`}
                      acao={excluirCompra.bind(null, c.id)}
                    />
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
          {!compras?.length && (
            <TableRow>
              <TableCell colSpan={COLUNAS.length} className="text-center text-muted-foreground">
                {busca || de || ate || min !== undefined || max !== undefined
                  ? "Nenhuma ordem de compra encontrada com esse filtro."
                  : "Nenhuma ordem de compra registrada ainda."}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </TabelaAjustavel>

      {/* Os filtros viajam junto: sem isto, ir para a página 2 abandonava a
          busca e a ordenação e mostrava a lista inteira de novo. */}
      <Paginacao
        pagina={pagina}
        total={total}
        porPagina={POR_PAGINA_PADRAO}
        caminho={`/obras/${obraId}/compras`}
        parametros={{
          busca: busca || undefined,
          ordem: ordem.valor === ORDENS[0].valor ? undefined : ordem.valor,
          de,
          ate,
          min: f.min,
          max: f.max,
        }}
        rotulo="registros"
      />
    </div>
  );
}
