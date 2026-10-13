import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { TableBody, TableRow, TableCell } from "@/components/ui/table";
import { TabelaAjustavel, type ColunaAjustavel } from "@/components/ui/tabela-ajustavel";
import { FiltrosCompras, type TipoFiltro } from "@/components/compras/filtros-compras";
import { CompraStatusBadge } from "@/components/compras/status-badges";
import { ExcluirCompraDialog } from "@/components/compras/excluir-compra-dialog";
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

export default async function ComprasObraPage({
  params,
  searchParams,
}: {
  params: Promise<{ obraId: string }>;
  searchParams: Promise<{ pagina?: string; busca?: string; tipo?: string }>;
}) {
  const { obraId } = await params;
  const { pagina: paginaParam, busca: buscaParam, tipo: tipoParam } = await searchParams;
  const supabase = await createClient();

  // O que vier de fora da lista conhecida é tratado como "sem filtro": a URL é
  // digitável, e tipo inventado não pode virar consulta.
  const tipo: TipoFiltro =
    (["material", "servico", "mao_de_obra"] as const).find((t) => t === tipoParam) ?? "todos";
  const busca = (buscaParam ?? "").trim();

  /*
   * A busca cobre descrição E fornecedor, e o fornecedor custa uma consulta
   * extra.
   *
   * `compras` guarda só `fornecedor_id`; o nome está na outra tabela. O
   * PostgREST não deixa pôr uma tabela embutida dentro de um `or`, então o
   * caminho é descobrir antes quais fornecedores casam com o termo e procurar
   * pelos ids deles. São poucas dezenas de fornecedores — a lista de ids cabe
   * folgada na requisição.
   */
  const termoSeguro = busca.replace(/[,()*]/g, " ").trim();
  const { data: fornecedoresCasando } = termoSeguro
    ? await supabase.from("fornecedores").select("id").ilike("nome", `%${termoSeguro}%`)
    : { data: null };

  const condicaoBusca = termoSeguro
    ? [
        `descricao.ilike.%${termoSeguro}%`,
        ...((fornecedoresCasando ?? []).length
          ? [`fornecedor_id.in.(${(fornecedoresCasando ?? []).map((f) => f.id).join(",")})`]
          : []),
      ].join(",")
    : null;

  /*
   * A contagem vem antes das linhas porque é ela que define a fatia.
   *
   * `head: true` não traz dado nenhum — só o total no cabeçalho —, então é uma
   * consulta barata mesmo com a obra cheia.
   *
   * Os filtros são repetidos aqui e na consulta das linhas, à mão. Tentei
   * extrair num ajudante genérico e o tipo do construtor de consultas do
   * Supabase não atravessa a generalização sem virar `any` — e `any` aqui
   * apagaria justamente a checagem de nome de coluna. Duas linhas repetidas
   * custam menos que isso; o que não pode é divergirem, senão a paginação
   * conta um conjunto e mostra outro.
   */
  let consultaContagem = supabase
    .from("compras")
    .select("id", { count: "exact", head: true })
    .eq("obra_id", obraId);
  if (tipo !== "todos") consultaContagem = consultaContagem.eq("tipo_item", tipo);
  if (condicaoBusca) consultaContagem = consultaContagem.or(condicaoBusca);

  const { count } = await consultaContagem;

  const total = count ?? 0;
  const { pagina, de, ate } = faixaDaPagina(lerPagina(paginaParam), total);

  let consultaLinhas = supabase
    .from("compras")
    .select("*, fornecedores(nome)")
    .eq("obra_id", obraId);
  if (tipo !== "todos") consultaLinhas = consultaLinhas.eq("tipo_item", tipo);
  if (condicaoBusca) consultaLinhas = consultaLinhas.or(condicaoBusca);

  const { data: compras } = await consultaLinhas
    .order("created_at", { ascending: false })
    .range(de, ate);

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
      fornecedor: (c.fornecedores as unknown as { nome: string } | null)?.nome ?? null,
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

      <FiltrosCompras
        base={`/obras/${obraId}/compras`}
        busca={busca}
        tipo={tipo}
        resultados={total}
      />

      <TabelaAjustavel id="ordens-de-compra" colunas={COLUNAS}>
        <TableBody>
          {compras?.map((c) => {
            const fornecedor = c.fornecedores as unknown as { nome: string } | null;
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
                <TableCell className="truncate" title={fornecedor?.nome ?? undefined}>
                  {fornecedor?.nome}
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
                    <ExcluirCompraDialog
                      compraId={c.id}
                      descricao={c.descricao}
                      ehLancamento={c.eh_lancamento}
                    />
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
          {!compras?.length && (
            <TableRow>
              <TableCell colSpan={COLUNAS.length} className="text-center text-muted-foreground">
                {busca || tipo !== "todos"
                  ? "Nenhuma ordem de compra encontrada com esse filtro."
                  : "Nenhuma ordem de compra registrada ainda."}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </TabelaAjustavel>

      <Paginacao
        pagina={pagina}
        total={total}
        porPagina={POR_PAGINA_PADRAO}
        caminho={`/obras/${obraId}/compras`}
        rotulo="registros"
      />
    </div>
  );
}
