import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { CardNumero } from "@/components/ui/card-numero";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { formatDateBR } from "@/lib/format-date";
import { calcularCustoLocacao, hojeIso } from "@/lib/locacoes/calculo";
import { LocacaoDialog } from "./locacao-dialog";
import { DevolverButton, RemoverLocacaoButton } from "./locacoes-actions";

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const SUFIXO: Record<string, string> = { dia: "/dia", hora: "/hora", mes: "/mês" };
import { Paginacao } from "@/components/ui/paginacao";
import { faixaDaPagina, lerPagina, POR_PAGINA_PADRAO } from "@/lib/paginacao";
import { AjudaDaPagina } from "@/components/ui/ajuda-da-pagina";

export default async function LocacoesObraPage({
  params,
  searchParams,
}: {
  params: Promise<{ obraId: string }>;
  searchParams: Promise<{ pagina?: string }>;
}) {
  const { obraId } = await params;
  const { pagina: paginaParam } = await searchParams;
  const supabase = await createClient();

  const { count } = await supabase
    .from("locacoes_equipamento")
    .select("id", { count: "exact", head: true })
    .eq("obra_id", obraId);

  const total = count ?? 0;
  const { pagina, de, ate } = faixaDaPagina(lerPagina(paginaParam), total);

  const [{ data: locacoes }, { data: fornecedores }, { data: resumo }, { data: mensais }] =
    await Promise.all([
    supabase
      .from("locacoes_equipamento")
      .select("*, fornecedores(nome)")
      .eq("obra_id", obraId)
      .order("data_inicio", { ascending: false })
      .range(de, ate),
    supabase.from("fornecedores").select("id, nome").eq("ativo", true).order("nome"),
    /*
     * Pago e contratado vêm das PARCELAS, somados no banco (0063).
     *
     * A tela mostrava o acumulado — mensalidades dos meses já começados — e
     * isso virou mentira quando a regra do sistema passou a ser "gasto é o que
     * saiu do caixa": a betoneira aparecia como R$ 300 sem ninguém ter pago
     * nada. Mês vencido e não pago vale zero, como em todo o resto.
     *
     * A obra inteira, não só a página: os cartões de cima somam tudo.
     */
    supabase.from("vw_locacoes_resumo").select("*").eq("obra_id", obraId),
    /*
     * As locações MENSAIS em uso, da obra inteira.
     *
     * A consulta de cima é paginada, e somar a mensalidade a partir dela
     * responderia "quanto custam por mês as locações desta página" — outra
     * pergunta. São poucas linhas por obra, e só os três campos da conta.
     */
    supabase
      .from("locacoes_equipamento")
      .select("valor_unitario")
      .eq("obra_id", obraId)
      .eq("unidade", "mes")
      .is("data_devolucao", null),
  ]);

  const resumoPorLocacao = new Map((resumo ?? []).map((r) => [r.locacao_id, r]));
  const totalPago = (resumo ?? []).reduce((s, r) => s + r.total_pago, 0);
  const totalContratado = (resumo ?? []).reduce((s, r) => s + r.total_contratado, 0);

  // Uma única referência de "hoje" para a tela inteira, senão duas linhas
  // podem ser calculadas em dias diferentes se a virada acontecer no meio.
  const hoje = hojeIso();

  const linhas = (locacoes ?? []).map((locacao) => {
    const custo = calcularCustoLocacao(
      {
        quantidade: locacao.quantidade,
        unidade: locacao.unidade,
        valorUnitario: locacao.valor_unitario,
        dataInicio: locacao.data_inicio,
        horasUtilizadas: locacao.horas_utilizadas,
        dataDevolucao: locacao.data_devolucao,
        dataPrimeiroVencimento: locacao.data_primeiro_vencimento,
        mesesContratados: locacao.meses_contratados,
      },
      hoje
    );
    const fornecedor = locacao.fornecedores as unknown as { nome: string } | null;
    return { locacao, custo, locadorNome: fornecedor?.nome ?? "—" };
  });

  /*
   * Os quatro cartões respondem quatro perguntas diferentes, sem se repetir:
   * quantos equipamentos, quanto somam os contratos, quanto já saiu do caixa e
   * quanto ainda vai sair.
   *
   * Nenhum deles fala de "acumulado" — isso saiu junto com a regra nova. O que
   * conta como gasto, aqui e em todo o resto do sistema, é parcela PAGA.
   */
  const quantidadeEmUso = linhas.filter((l) => l.custo.emUso).length;
  const previsao = Math.max(0, totalContratado - totalPago);

  /*
   * O custo MENSAL dos contratos ativos: quanto a obra paga de aluguel por mês.
   *
   * Sai da locação e não das parcelas de propósito. Pelas parcelas, um mês sem
   * vencimento marcado mostraria R$ 0,00 ao lado de seis equipamentos em uso —
   * e a pergunta "quanto me custa por mês ter isso aqui" tem resposta mesmo
   * nos meses em que nada vence.
   *
   * Equipamento devolvido sai da conta, e dia/hora não entram: eles não têm
   * mensalidade.
   */
  // Sem multiplicar pela quantidade: o valor informado já é o aluguel do
  // CONJUNTO. Dez andaimes a R$ 144 custam R$ 144 por mês, não R$ 1.440 — ver
  // a migração 0064.
  const mensalidadeDoMes = (mensais ?? []).reduce((soma, l) => soma + l.valor_unitario, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-1 font-heading text-lg font-semibold">
            Locação de equipamentos
            <AjudaDaPagina titulo="Locação de equipamentos">
              <p>
                Por dia e por hora o valor <strong>continua correndo</strong> enquanto o
                equipamento estiver aqui: por dia, o sistema conta sozinho os dias desde a data
                inicial; por hora, o valor sai das horas que você informar. Marcar como{" "}
                <strong>devolvido</strong> encerra a contagem e congela o valor na data da
                devolução.
              </p>
              <p>
                Na cobrança <strong>por mês</strong> é diferente: o sistema gera uma ordem de
                compra com uma parcela por mês, e a mensalidade vira conta a pagar.
              </p>
              <p>
                A coluna <strong>Total pago</strong> conta só o que já foi{" "}
                <strong>marcado como pago</strong> na ordem de compra. Mensalidade vencida e não
                paga vale zero aqui — é a mesma regra do gasto da obra.
              </p>
            </AjudaDaPagina>
          </h1>
        </div>
        <LocacaoDialog obraId={obraId} fornecedores={fornecedores ?? []} />
      </div>

      {!!linhas.length && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <CardNumero
            rotulo="Equipamentos em uso"
            valor={quantidadeEmUso}
            descricao={`de ${linhas.length} ${linhas.length === 1 ? "locação" : "locações"} nesta obra`}
            ajuda={
              <p>
                Quantos equipamentos ainda não foram devolvidos. Marcar a devolução encerra a
                contagem e congela o valor na data informada.
              </p>
            }
          />
          <CardNumero
            rotulo="Total em locações no mês"
            valor={formatCurrency(mensalidadeDoMes)}
            descricao="custo mensal dos contratos ativos"
            ajuda={
              <>
                <p>
                  Quanto as locações em uso custam por mês somadas — a conta de aluguel que a obra
                  paga enquanto os equipamentos estiverem aqui.
                </p>
                <p>
                  Equipamento devolvido sai da conta. Não é gasto realizado: o que já saiu do caixa
                  está em <strong>Total já pago</strong>.
                </p>
              </>
            }
          />
          <CardNumero
            rotulo="Total já pago"
            valor={formatCurrency(totalPago)}
            tom="sucesso"
            descricao="mensalidades com pagamento lançado"
            ajuda={
              <>
                <p>
                  Só o que já saiu do caixa: a mensalidade entra aqui quando a parcela é marcada
                  como <strong>paga</strong> na ordem de compra.
                </p>
                <p>
                  Mensalidade vencida e não paga vale zero — é a mesma regra do gasto da obra.
                </p>
              </>
            }
          />
          <CardNumero
            rotulo="Previsão orçamentária"
            valor={formatCurrency(previsao)}
            descricao="ainda a pagar nos contratos"
            ajuda={
              <p>
                O que falta pagar: o total dos contratos menos o que já foi pago. É esse valor que
                ainda vai aparecer em contas a pagar ao longo dos próximos meses.
              </p>
            }
          />
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Equipamento</TableHead>
              <TableHead>Locador</TableHead>
              <TableHead>Qtd.</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Início</TableHead>
              <TableHead>Devolução</TableHead>
              <TableHead>Total pago</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {linhas.map(({ locacao, custo, locadorNome }) => {
              const pago = resumoPorLocacao.get(locacao.id)?.total_pago ?? 0;
              return (
              <TableRow key={locacao.id}>
                <TableCell className="font-medium">
                  {locacao.equipamento}
                  {custo.emUso ? (
                    <Badge variant="outline" className="ml-2">
                      Em uso
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="ml-2">
                      Devolvido
                    </Badge>
                  )}
                  {locacao.observacoes && (
                    <span className="block text-xs font-normal text-muted-foreground">
                      {locacao.observacoes}
                    </span>
                  )}
                </TableCell>
                <TableCell>{locadorNome}</TableCell>
                <TableCell>{locacao.quantidade}</TableCell>
                <TableCell className="whitespace-nowrap">
                  {formatCurrency(locacao.valor_unitario)}
                  <span className="text-muted-foreground">{SUFIXO[locacao.unidade]}</span>
                </TableCell>
                <TableCell>{formatDateBR(locacao.data_inicio)}</TableCell>
                <TableCell>
                  {locacao.data_devolucao ? (
                    formatDateBR(locacao.data_devolucao)
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                {/*
                  Uma coluna, um significado: o que JÁ SAIU DO CAIXA.
                  
                  Mostrava o acumulado — as mensalidades dos meses já
                  começados —, e isso dava R$ 300 numa betoneira que ninguém
                  pagou. Mês vencido e não pago vale ZERO aqui, como em todo o
                  resto do sistema: só soma quando a parcela é marcada como
                  paga na ordem de compra.
                  
                  O contratado fica em cinza embaixo, como referência: é ele
                  que explica por que o pago é só uma fração.
                */}
                {/*
                  Só o valor pago, sem linha de apoio.
                  
                  Trazia "de R$ X contratados · 0 de 3 mensalidades pagas"
                  embaixo, e com seis linhas na tela isso virava mais texto que
                  número — a coluna tem uma pergunta só, e a resposta é um
                  valor. O contratado continua na conta: é ele menos o pago que
                  dá a previsão orçamentária, no cartão de cima.
                */}
                <TableCell className={custo.emUso ? "font-medium" : ""}>
                  <span className="whitespace-nowrap">{formatCurrency(pago)}</span>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <DevolverButton
                      obraId={obraId}
                      locacaoId={locacao.id}
                      devolvido={!custo.emUso}
                    />
                    <LocacaoDialog
                      obraId={obraId}
                      fornecedores={fornecedores ?? []}
                      locacao={locacao}
                    />
                    <RemoverLocacaoButton obraId={obraId} locacaoId={locacao.id} />
                  </div>
                </TableCell>
                </TableRow>
              );
            })}
            {!linhas.length && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  Nenhuma locação registrada nessa obra ainda.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Paginacao
        pagina={pagina}
        total={total}
        porPagina={POR_PAGINA_PADRAO}
        caminho={`/obras/${obraId}/locacoes`}
        rotulo="locações"
      />
    </div>
  );
}
