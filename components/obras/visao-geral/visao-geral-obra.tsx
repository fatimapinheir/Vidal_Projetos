import Link from "next/link";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  CircleHelp,
  Clock,
  FileCheck2,
  FileClock,
  Hammer,
  HardHat,
  PackageCheck,
  Send,
  Truck,
  Wallet,
  Wrench,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Rosca } from "@/components/charts/rosca";
import { BarraEmpilhada } from "@/components/charts/barra-empilhada";
import { BarrasPlanejadoExecutado } from "@/components/charts/barras-planejado-executado";
import { CalendarioDiarios } from "@/components/charts/calendario-diarios";
import { ProgressoOrcamento } from "@/components/obras/progresso-orcamento";
import { SituacaoFinanceiraBadge } from "@/components/compras/situacao-badges";
import { situacaoFinanceiraParcela } from "@/lib/compras/situacao";
import { formatDateBR } from "@/lib/format-date";
import type { DadosVisaoGeral } from "@/lib/obras/visao-geral";
import { Indicador, Leitura, type Tom } from "./indicadores";

function moeda(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/**
 * Visão geral da obra para quem a conduz.
 *
 * Servia aos dois papéis, com um `visao` ligando e desligando pedaços. O
 * portal do cliente tem componente próprio desde que a tela dele passou a não
 * falar de atraso — e aí cada interruptor escondia mais do que mostrava. Ver
 * `visao-geral-cliente.tsx`.
 */
export function VisaoGeralObra({
  dados,
  obraId,
}: {
  dados: DadosVisaoGeral;
  obraId: string;
}) {
  const base = `/obras/${obraId}`;

  const d = dados;
  const temOrcamento = d.orcado > 0;
  // Gasto correndo à frente da execução é o sinal mais útil da tela: significa
  // que o dinheiro sai mais rápido do que a obra anda.
  const descolamento = d.percentualFinanceiro - d.percentualFisico;
  const tomDescolamento: Tom =
    descolamento > 20 ? "critico" : descolamento > 10 ? "alerta" : "bom";

  return (
    <div className="flex flex-col gap-4">
      {/* 1. FAIXA DE SAÚDE — a resposta de "a obra está bem?" em cinco números. */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Indicador
          rotulo="Avanço físico"
          valor={`${d.percentualFisico.toFixed(0)}%`}
          detalhe={
            d.ultimaMedicao ? `medido em ${formatDateBR(d.ultimaMedicao)}` : "sem medição ainda"
          }
          icone={HardHat}
          tom={d.ultimaMedicao ? "neutro" : "alerta"}
        />
        <Indicador
          rotulo="Custo da obra"
          valor={moeda(d.custoTotal)}
          detalhe={temOrcamento ? `${d.percentualFinanceiro.toFixed(0)}% do orçado` : "sem orçamento ativo"}
          icone={Wallet}
          tom={temOrcamento && d.saldoOrcamento < 0 ? "critico" : "neutro"}
        />
        <Indicador
          rotulo="A pagar em 30 dias"
          valor={moeda(d.proximos30)}
          detalhe={d.vencido > 0 ? `${moeda(d.vencido)} já vencido` : "nada vencido"}
          icone={Clock}
          tom={d.vencido > 0 ? "critico" : d.proximos30 > 0 ? "alerta" : "bom"}
        />
        <Indicador
          rotulo="Entregas pendentes"
          valor={String(d.entregasPendentes.length)}
          detalhe={
            d.entregasAtrasadas.length
              ? `${d.entregasAtrasadas.length} em atraso`
              : "nenhuma atrasada"
          }
          icone={Truck}
          tom={d.entregasAtrasadas.length ? "critico" : "neutro"}
        />
      </div>

      {/* 2. CUSTO — as três fontes. Antes só materiais entravam nesta conta. */}
      {d.custoTotal > 0 && (
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base">Custo da obra</CardTitle>
            {temOrcamento && (
              <p className="text-sm text-muted-foreground">
                Orçado:{" "}
                <span className="font-medium text-foreground">{moeda(d.orcado)}</span>
              </p>
            )}
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <BarraEmpilhada
              segmentos={[
                {
                  rotulo: "Materiais",
                  valor: d.materiais,
                  cor: "bg-grafico-pago",
                  icone: <PackageCheck className="size-3.5" aria-hidden />,
                },
                {
                  rotulo: "Serviços",
                  valor: d.servicos,
                  cor: "bg-grafico-enviado",
                  icone: <Hammer className="size-3.5" aria-hidden />,
                },
                {
                  rotulo: "Mão de obra",
                  valor: d.custoMaoDeObra,
                  cor: "bg-grafico-a-vencer",
                  icone: <HardHat className="size-3.5" aria-hidden />,
                },
                {
                  rotulo: "Equipamentos",
                  valor: d.custoLocacoes,
                  cor: "bg-grafico-trilho",
                  icone: <Wrench className="size-3.5" aria-hidden />,
                },
                {
                  // Sem isto a barra somaria menos que o custo total, e a
                  // diferença não teria nome em lugar nenhum.
                  rotulo: "Outros",
                  valor: d.semClassificacao,
                  cor: "bg-chart-5",
                  icone: <CircleHelp className="size-3.5" aria-hidden />,
                },
              ]}
            />
            {temOrcamento && (
              <Leitura tom={d.saldoOrcamento < 0 ? "critico" : "neutro"}>
                {d.saldoOrcamento < 0
                  ? `A obra já passou do orçamento em ${moeda(-d.saldoOrcamento)}.`
                  : `Restam ${moeda(d.saldoOrcamento)} do orçamento previsto.`}
              </Leitura>
            )}
            {d.maoDeObraAberto > 0 && (
              <Leitura tom="alerta">
                {moeda(d.maoDeObraAberto)} de mão de obra em fechamentos ainda não pagos.
              </Leitura>
            )}
          </CardContent>
        </Card>
      )}

      {/* 3. AVANÇO — físico contra financeiro, com a leitura do que isso quer dizer. */}
      {temOrcamento && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Avanço × gasto</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <ProgressoOrcamento
                percentualFisico={d.percentualFisico}
                percentualFinanceiro={d.percentualFinanceiro}
              />
              <Leitura tom={tomDescolamento}>
                {descolamento > 10
                  ? `O gasto está ${descolamento.toFixed(0)} pontos à frente do que já foi executado em obra.`
                  : "Gasto e execução caminham juntos."}
              </Leitura>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Planejado × executado</CardTitle>
            </CardHeader>
            <CardContent>
              <BarrasPlanejadoExecutado
                linhas={[{ rotulo: "Orçamento da obra", planejado: d.orcado, executado: d.custoTotal }]}
              />
            </CardContent>
          </Card>
        </div>
      )}

      {/* 4. PAGAMENTOS */}
      {d.totalParcelado > 0 && (
        <Card className={d.vencido > 0 ? "border-grafico-vencido/50" : undefined}>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base">Pagamentos</CardTitle>
            <p className="text-sm text-muted-foreground">
              A pagar: <span className="font-medium text-foreground">{moeda(d.aPagar)}</span>
            </p>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Rosca
              valorCentral={moeda(d.totalParcelado)}
              rotuloCentral="parcelado"
              fatias={[
                { rotulo: "Vencido", valor: d.vencido, cor: "fill-grafico-vencido", icone: <AlertTriangle className="size-3.5" aria-hidden /> },
                { rotulo: "A vencer", valor: d.aVencer, cor: "fill-grafico-a-vencer", icone: <Clock className="size-3.5" aria-hidden /> },
                { rotulo: "Pagamento enviado", valor: d.pagamentoEnviado, cor: "fill-grafico-enviado", icone: <Send className="size-3.5" aria-hidden /> },
                { rotulo: "Pago", valor: d.pagoParcelas, cor: "fill-grafico-pago", icone: <CheckCircle2 className="size-3.5" aria-hidden /> },
                { rotulo: "Aguardando recebimento", valor: d.aguardandoRecebimento, cor: "fill-grafico-trilho", icone: <PackageCheck className="size-3.5" aria-hidden /> },
              ]}
            />
            {!!d.parcelasPrioridade.length && (
              <div className="flex flex-col gap-2 border-t pt-4">
                {d.parcelasPrioridade.slice(0, 5).map((p) => {
                  const compra = p.compras as unknown as { descricao: string } | null;
                  const situacao = situacaoFinanceiraParcela(p);
                  // Pagamento já lançado não é mais atraso de quem olha a tela:
                  // o destaque vermelho sai junto com o selo.
                  const atrasada = situacao.chave === "vencido";
                  return (
                    <Link
                      key={p.id}
                      href={`${base}/compras/${p.compra_id}`}
                      className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm transition-colors hover:bg-muted ${
                        atrasada ? "border-grafico-vencido/50 bg-grafico-vencido/10" : ""
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">{compra?.descricao}</p>
                        <p className="text-muted-foreground">
                          Vencimento: {formatDateBR(p.data_vencimento)}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <p className="font-medium tabular-nums">{moeda(p.valor)}</p>
                        <SituacaoFinanceiraBadge situacao={situacao} />
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 5. ENTREGAS PENDENTES */}
      {!!d.entregasPendentes.length && (
        <Card className={d.entregasAtrasadas.length ? "border-destructive/50" : undefined}>
          <CardHeader>
            <CardTitle className="text-base">
              Entregas pendentes
              {!!d.entregasAtrasadas.length && (
                <span className="ml-2 text-sm font-normal text-destructive">
                  {d.entregasAtrasadas.length} em atraso
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {d.entregasPendentes.slice(0, 6).map((p) => {
              const compra = p.compras as unknown as { descricao: string } | null;
              const atrasada = (p.entrega_prevista_ordem ?? "") < d.hoje;
              return (
                <Link
                  key={p.id}
                  href={`${base}/compras/${p.compra_id}`}
                  className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm transition-colors hover:bg-muted ${
                    atrasada ? "border-destructive/40 bg-destructive/5" : ""
                  }`}
                >
                  <p className="min-w-0 truncate font-medium">{compra?.descricao}</p>
                  <p className={atrasada ? "shrink-0 text-destructive" : "shrink-0 text-muted-foreground"}>
                    Previsto para {formatDateBR(p.entrega_prevista_ordem)}
                  </p>
                </Link>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* 6. ORDENS DE COMPRA */}
      {d.valorAguardando + d.valorAprovado + d.valorPagoCompras > 0 && (
        <Card className={d.comprasAguardando.length ? "border-grafico-a-vencer/50" : undefined}>
          <CardHeader>
            <CardTitle className="text-base">
              Ordens de compra
              {!!d.comprasAguardando.length && (
                <span className="ml-2 text-sm font-normal text-grafico-a-vencer">
                  {d.comprasAguardando.length}{" "}
                  aguardando o cliente
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <BarraEmpilhada
              segmentos={[
                { rotulo: "Aguardando o cliente", valor: d.valorAguardando, cor: "bg-grafico-a-vencer", icone: <FileClock className="size-3.5" aria-hidden /> },
                { rotulo: "Aprovadas, ainda não pagas", valor: d.valorAprovado, cor: "bg-grafico-trilho", icone: <FileCheck2 className="size-3.5" aria-hidden /> },
                { rotulo: "Pagas", valor: d.valorPagoCompras, cor: "bg-grafico-pago", icone: <CheckCircle2 className="size-3.5" aria-hidden /> },
              ]}
            />
            {!!d.comprasAguardando.length && (
              <div className="flex flex-col gap-2 border-t pt-4">
                {d.comprasAguardando.map((c) => {
                  const fornecedor = c.fornecedores as unknown as { nome: string } | null;
                  return (
                    <Link
                      key={c.id}
                      href={`${base}/compras/${c.id}`}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-grafico-a-vencer/40 bg-grafico-a-vencer/10 p-3 text-sm transition-colors hover:bg-grafico-a-vencer/20"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">{c.descricao}</p>
                        <p className="text-muted-foreground">{fornecedor?.nome}</p>
                      </div>
                      <p className="shrink-0 font-medium tabular-nums">{moeda(c.valor_total)}</p>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 7. CRONOGRAMA — o cliente vê andamento e previsão; a lista de tarefas
          atrasadas e a contagem de dias de atraso ficam do lado do engenheiro. */}
      {d.totalTarefas > 0 && (
        <Card className={d.atrasoDias > 0 ? "border-destructive/50" : undefined}>
          <CardHeader>
            <CardTitle className="text-base">Cronograma</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
              <Indicador
                rotulo="Tarefas concluídas"
                valor={`${d.tarefasConcluidas}/${d.totalTarefas}`}
                icone={CheckCircle2}
              />
              <Indicador
                rotulo="Previsão de término"
                valor={d.previsaoTermino ? formatDateBR(d.previsaoTermino) : "—"}
                icone={CalendarClock}
              />
              <Indicador
                rotulo="Atraso"
                valor={d.atrasoDias > 0 ? `${d.atrasoDias} dias` : "em dia"}
                detalhe={
                  d.tarefasAtrasadas.length ? `${d.tarefasAtrasadas.length} tarefa(s)` : undefined
                }
                icone={AlertTriangle}
                tom={d.atrasoDias > 0 ? "critico" : "bom"}
              />
            </div>

            {!!d.tarefasAtrasadas.length && (
              <div className="flex flex-col gap-2 border-t pt-3">
                {d.tarefasAtrasadas.slice(0, 5).map((t) => (
                  <div
                    key={t.nome}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-2.5 text-sm"
                  >
                    <span className="min-w-0 truncate font-medium">{t.nome}</span>
                    <span className="shrink-0 text-destructive">
                      previsto para {formatDateBR(t.data_fim_cedo)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 8. NÚMEROS DE CAMPO */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Indicador rotulo="Equipe em obra" valor={String(d.trabalhadoresAtivos)} detalhe="pessoas ativas" icone={HardHat} />
        <Indicador rotulo="Equipamentos" valor={String(d.equipamentosEmUso)} detalhe="locados agora" icone={Wrench} />
        <Indicador rotulo="Já pago" valor={moeda(d.pagoParcelas)} detalhe="em parcelas quitadas" icone={CheckCircle2} tom="bom" />
        <Indicador
          rotulo="Dias parados"
          valor={String(d.diasImpraticaveis)}
          detalhe="por chuva, neste mês"
          icone={AlertTriangle}
          tom={d.diasImpraticaveis > 3 ? "alerta" : "neutro"}
        />
      </div>

      {/* 9. DIÁRIO */}
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">Diário de obra</CardTitle>
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href={`${base}/diario`}>Ver todos os dias</Link>}
          />
        </CardHeader>
        <CardContent>
          {/* `hoje` não é opcional na prática: sem ele o calendário não
              distingue dia futuro de dia sem registro, e o mês inteiro à
              frente apareceria como lacuna a preencher. */}
          {d.diasDiario.length ? (
            <CalendarioDiarios
              dias={d.diasDiario}
              mesReferencia={d.mesAtual}
              base={base}
              hoje={d.hoje}
            />
          ) : (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Nenhum diário publicado neste mês ainda.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
