import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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

  const [{ data: locacoes }, { data: fornecedores }] = await Promise.all([
    supabase
      .from("locacoes_equipamento")
      .select("*, fornecedores(nome)")
      .eq("obra_id", obraId)
      .order("data_inicio", { ascending: false })
      .range(de, ate),
    supabase.from("fornecedores").select("id, nome").eq("ativo", true).order("nome"),
  ]);

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
      },
      hoje
    );
    const fornecedor = locacao.fornecedores as unknown as { nome: string } | null;
    return { locacao, custo, locadorNome: fornecedor?.nome ?? "—" };
  });

  const totalEmUso = linhas.filter((l) => l.custo.emUso).reduce((s, l) => s + l.custo.valor, 0);
  const totalDevolvido = linhas.filter((l) => !l.custo.emUso).reduce((s, l) => s + l.custo.valor, 0);
  const quantidadeEmUso = linhas.filter((l) => l.custo.emUso).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-lg font-semibold">Locação de equipamentos</h1>
          <p className="text-sm text-muted-foreground">
            Equipamentos alugados para a obra. Por dia e por hora o valor{" "}
            <strong>continua correndo</strong> enquanto o equipamento estiver aqui: por dia, o
            sistema conta sozinho os dias desde a data inicial; por hora, o valor sai das horas que
            você informar. Marcar como <strong>devolvido</strong> encerra a contagem e congela o
            valor na data da devolução. Na cobrança <strong>por mês</strong> é diferente: o sistema
            gera uma ordem de compra com uma parcela por mês, e a mensalidade vira conta a pagar.
          </p>
        </div>
        <LocacaoDialog obraId={obraId} fornecedores={fornecedores ?? []} />
      </div>

      {!!linhas.length && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="flex items-center justify-between py-4">
              <p className="text-sm text-muted-foreground">Em uso</p>
              <p className="font-heading text-xl font-semibold">{quantidadeEmUso}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center justify-between py-4">
              <p className="text-sm text-muted-foreground">Acumulado em uso</p>
              <p className="font-heading text-xl font-semibold">{formatCurrency(totalEmUso)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center justify-between py-4">
              <p className="text-sm text-muted-foreground">Já devolvido</p>
              <p className="font-heading text-xl font-semibold">{formatCurrency(totalDevolvido)}</p>
            </CardContent>
          </Card>
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
              <TableHead>Cobrado</TableHead>
              <TableHead>Total</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {linhas.map(({ locacao, custo, locadorNome }) => (
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
                <TableCell className="whitespace-nowrap text-xs">
                  {locacao.unidade === "mes"
                    ? `${locacao.meses_contratados ?? 1} ${(locacao.meses_contratados ?? 1) === 1 ? "mês" : "meses"}`
                    : locacao.unidade === "dia"
                      ? `${custo.dias} ${custo.dias === 1 ? "dia" : "dias"}`
                      : `${custo.unidadesCobradas}h em ${custo.dias} ${custo.dias === 1 ? "dia" : "dias"}`}
                </TableCell>
                {/*
                  Na cobrança mensal o total não vem da fórmula de dias: vem
                  da ordem de compra que o sistema gerou, e é lá que se paga.
                  Repetir o número aqui daria a impressão de dois gastos.
                */}
                <TableCell className={custo.emUso ? "font-medium" : ""}>
                  {locacao.unidade === "mes" ? (
                    <span className="whitespace-nowrap">
                      {formatCurrency(
                        locacao.quantidade *
                          locacao.valor_unitario *
                          (locacao.meses_contratados ?? 1)
                      )}
                      <span className="block text-xs font-normal text-muted-foreground">
                        em contas a pagar
                      </span>
                    </span>
                  ) : (
                    formatCurrency(custo.valor)
                  )}
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
            ))}
            {!linhas.length && (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground">
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
