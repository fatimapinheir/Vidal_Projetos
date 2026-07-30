import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ParcelaStatusBadge } from "@/components/compras/status-badges";
import { ordenarParcelasPorPrioridade } from "@/lib/parcelas";
import { formatDateBR } from "@/lib/format-date";
import { ProgressoOrcamento } from "@/components/obras/progresso-orcamento";
import { Rosca } from "@/components/charts/rosca";
import { BarraEmpilhada } from "@/components/charts/barra-empilhada";
import { BarrasPlanejadoExecutado } from "@/components/charts/barras-planejado-executado";
import { CalendarioDiarios } from "@/components/charts/calendario-diarios";
import { calcularCustoLocacao, hojeIso } from "@/lib/locacoes/calculo";
import type { DiarioClima } from "@/lib/types/database.types";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  HardHat,
  Wrench,
  FileClock,
  FileCheck2,
} from "lucide-react";

const statusLabel: Record<string, string> = {
  planejamento: "Planejamento",
  em_andamento: "Em andamento",
  pausada: "Pausada",
  concluida: "Concluída",
};

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** O pior clima do dia é o que explica parada — é ele que vai para o calendário. */
function piorClima(...periodos: (DiarioClima | null)[]): DiarioClima | null {
  const ordem: DiarioClima[] = ["impraticavel", "chuva", "praticavel"];
  for (const nivel of ordem) {
    if (periodos.includes(nivel)) return nivel;
  }
  return null;
}

function Numero({
  rotulo,
  valor,
  detalhe,
  icone: Icone,
}: {
  rotulo: string;
  valor: string;
  detalhe?: string;
  icone: typeof HardHat;
}) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-2 py-4">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{rotulo}</p>
          <p className="font-heading text-2xl font-semibold">{valor}</p>
          {detalhe && <p className="truncate text-xs text-muted-foreground">{detalhe}</p>}
        </div>
        <Icone className="size-5 shrink-0 text-muted-foreground" aria-hidden />
      </CardContent>
    </Card>
  );
}

export default async function PortalObraPage({
  params,
}: {
  params: Promise<{ obraId: string }>;
}) {
  const { obraId } = await params;
  const supabase = await createClient();

  const { data: obra } = await supabase.from("obras").select("*").eq("id", obraId).single();
  if (!obra) notFound();

  const hoje = hojeIso();
  const mesAtual = hoje.slice(0, 7);

  const [
    { data: compras },
    { data: parcelasRaw },
    { data: progresso },
    { data: equipe },
    { data: locacoes },
    { data: diarios },
  ] = await Promise.all([
    supabase
      .from("compras")
      .select("id, descricao, valor_total, status, fornecedores(nome)")
      .eq("obra_id", obraId),
    supabase
      .from("vw_compra_parcelas")
      .select("*, compras!inner(obra_id, descricao)")
      .eq("compras.obra_id", obraId),
    supabase.from("vw_progresso_obra").select("*").eq("obra_id", obraId).maybeSingle(),
    supabase
      .from("vw_equipe_ativa_obra")
      .select("trabalhadores_ativos")
      .eq("obra_id", obraId)
      .maybeSingle(),
    supabase
      .from("locacoes_equipamento")
      .select(
        "equipamento, quantidade, unidade, valor_unitario, data_inicio, horas_utilizadas, data_devolucao"
      )
      .eq("obra_id", obraId),
    supabase
      .from("diario_obra")
      .select("data, clima_manha, clima_tarde, clima_noite")
      .eq("obra_id", obraId)
      .not("fechado_em", "is", null)
      .gte("data", `${mesAtual}-01`)
      .lte("data", `${mesAtual}-31`),
  ]);

  // --- Pagamentos (prioridade 1) ---
  const parcelas = parcelasRaw ?? [];
  const vencido = parcelas
    .filter((p) => p.status_efetivo === "vencida")
    .reduce((s, p) => s + p.valor, 0);
  const aVencer = parcelas
    .filter((p) => p.status_efetivo === "pendente")
    .reduce((s, p) => s + p.valor, 0);
  const pago = parcelas.filter((p) => p.status_efetivo === "paga").reduce((s, p) => s + p.valor, 0);
  const totalParcelado = vencido + aVencer + pago;
  const aPagar = vencido + aVencer;

  const parcelasPrioridade = ordenarParcelasPorPrioridade(
    parcelas.filter((p) => p.status_efetivo !== "paga")
  );

  // --- Ordens de compra (prioridade 2) ---
  const todasCompras = compras ?? [];
  const aguardando = todasCompras.filter((c) => c.status === "cotada");
  const valorAguardando = aguardando.reduce((s, c) => s + c.valor_total, 0);
  const valorAprovado = todasCompras
    .filter((c) => c.status === "aprovada")
    .reduce((s, c) => s + c.valor_total, 0);
  const valorPago = todasCompras
    .filter((c) => c.status === "paga")
    .reduce((s, c) => s + c.valor_total, 0);

  // --- Progresso ---
  const gastoAprovado = valorAprovado + valorPago;
  const orcado = progresso?.valor_orcado_total ?? 0;
  const percentualFinanceiro = orcado > 0 ? (gastoAprovado / orcado) * 100 : 0;

  // --- Equipamentos ---
  const custosLocacao = (locacoes ?? []).map((l) =>
    calcularCustoLocacao(
      {
        quantidade: l.quantidade,
        unidade: l.unidade,
        valorUnitario: l.valor_unitario,
        dataInicio: l.data_inicio,
        horasUtilizadas: l.horas_utilizadas,
        dataDevolucao: l.data_devolucao,
      },
      hoje
    )
  );
  const equipamentosEmUso = custosLocacao.filter((c) => c.emUso).length;
  const custoLocacoes = custosLocacao.reduce((s, c) => s + c.valor, 0);

  const diasDiario = (diarios ?? []).map((d) => ({
    data: d.data,
    clima: piorClima(d.clima_manha, d.clima_tarde, d.clima_noite),
  }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-lg font-semibold">{obra.nome}</h1>
          <p className="text-sm text-muted-foreground">{obra.endereco ?? "Sem endereço"}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href={`/portal/obras/${obraId}/diario`}>Diário de obra</Link>}
          />
          <Badge>{statusLabel[obra.status]}</Badge>
        </div>
      </div>

      {/* 1. PAGAMENTOS — é o que o cliente veio ver primeiro. */}
      <Card className={vencido > 0 ? "border-grafico-vencido/50" : undefined}>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">Pagamentos</CardTitle>
          <p className="text-sm text-muted-foreground">
            A pagar: <span className="font-medium text-foreground">{formatCurrency(aPagar)}</span>
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {totalParcelado > 0 ? (
            <>
              <Rosca
                valorCentral={formatCurrency(totalParcelado)}
                rotuloCentral="parcelado"
                fatias={[
                  {
                    rotulo: "Vencido",
                    valor: vencido,
                    cor: "fill-grafico-vencido",
                    icone: <AlertTriangle className="size-3.5" aria-hidden />,
                  },
                  {
                    rotulo: "A vencer",
                    valor: aVencer,
                    cor: "fill-grafico-a-vencer",
                    icone: <Clock className="size-3.5" aria-hidden />,
                  },
                  {
                    rotulo: "Pago",
                    valor: pago,
                    cor: "fill-grafico-pago",
                    icone: <CheckCircle2 className="size-3.5" aria-hidden />,
                  },
                ]}
              />

              {!!parcelasPrioridade.length && (
                <div className="flex flex-col gap-2 border-t pt-4">
                  {parcelasPrioridade.slice(0, 5).map((p) => {
                    const compra = p.compras as unknown as { descricao: string } | null;
                    const atrasada = p.status_efetivo === "vencida";
                    return (
                      <Link
                        key={p.id}
                        href={`/portal/obras/${obraId}/compras/${p.compra_id}`}
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
                          <p className="font-medium tabular-nums">{formatCurrency(p.valor)}</p>
                          <ParcelaStatusBadge status={p.status_efetivo} />
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Nenhuma parcela registrada nesta obra ainda.
            </p>
          )}
        </CardContent>
      </Card>

      {/* 2. ORDENS DE COMPRA — a segunda coisa que exige ação dele. */}
      <Card className={aguardando.length ? "border-grafico-a-vencer/50" : undefined}>
        <CardHeader>
          <CardTitle className="text-base">
            Ordens de compra
            {!!aguardando.length && (
              <span className="ml-2 text-sm font-normal text-grafico-a-vencer">
                {aguardando.length} aguardando você
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {valorAguardando + valorAprovado + valorPago > 0 ? (
            <BarraEmpilhada
              segmentos={[
                {
                  rotulo: "Aguardando sua aprovação",
                  valor: valorAguardando,
                  cor: "bg-grafico-a-vencer",
                  icone: <FileClock className="size-3.5" aria-hidden />,
                },
                {
                  rotulo: "Aprovadas, ainda não pagas",
                  valor: valorAprovado,
                  cor: "bg-grafico-trilho",
                  icone: <FileCheck2 className="size-3.5" aria-hidden />,
                },
                {
                  rotulo: "Pagas",
                  valor: valorPago,
                  cor: "bg-grafico-pago",
                  icone: <CheckCircle2 className="size-3.5" aria-hidden />,
                },
              ]}
            />
          ) : (
            <p className="py-2 text-center text-sm text-muted-foreground">
              Nenhuma ordem de compra registrada ainda.
            </p>
          )}

          {!!aguardando.length && (
            <div className="flex flex-col gap-2 border-t pt-4">
              {aguardando.map((c) => {
                const fornecedor = c.fornecedores as unknown as { nome: string } | null;
                return (
                  <Link
                    key={c.id}
                    href={`/portal/obras/${obraId}/compras/${c.id}`}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-grafico-a-vencer/40 bg-grafico-a-vencer/10 p-3 text-sm transition-colors hover:bg-grafico-a-vencer/20"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{c.descricao}</p>
                      <p className="text-muted-foreground">{fornecedor?.nome}</p>
                    </div>
                    <p className="shrink-0 font-medium tabular-nums">
                      {formatCurrency(c.valor_total)}
                    </p>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 3. PROGRESSO — planejado × executado. */}
      {progresso && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Avanço da obra</CardTitle>
            </CardHeader>
            <CardContent>
              <ProgressoOrcamento
                percentualFisico={progresso.percentual_fisico}
                percentualFinanceiro={percentualFinanceiro}
              />
              <p className="mt-3 text-xs text-muted-foreground">
                {percentualFinanceiro > progresso.percentual_fisico + 10
                  ? "O gasto está à frente do que já foi executado em obra — vale conversar com o engenheiro."
                  : "Gasto e execução caminham juntos."}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Planejado × executado</CardTitle>
            </CardHeader>
            <CardContent>
              <BarrasPlanejadoExecutado
                linhas={[
                  { rotulo: "Orçamento da obra", planejado: orcado, executado: gastoAprovado },
                ]}
              />
            </CardContent>
          </Card>
        </div>
      )}

      {/* 4. NÚMEROS — valores únicos são números, não gráficos. */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Numero
          rotulo="Equipe em obra"
          valor={String(equipe?.trabalhadores_ativos ?? 0)}
          detalhe="pessoas ativas"
          icone={HardHat}
        />
        <Numero
          rotulo="Equipamentos"
          valor={String(equipamentosEmUso)}
          detalhe="locados agora"
          icone={Wrench}
        />
        <Numero
          rotulo="Custo de locação"
          valor={formatCurrency(custoLocacoes)}
          detalhe="acumulado"
          icone={Wrench}
        />
        <Numero
          rotulo="Total investido"
          valor={formatCurrency(pago)}
          detalhe="já pago"
          icone={CheckCircle2}
        />
      </div>

      {/* 5. DIÁRIO — o dia a dia, com o clima que explica o ritmo. */}
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">Diário de obra</CardTitle>
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href={`/portal/obras/${obraId}/diario`}>Ver todos os dias</Link>}
          />
        </CardHeader>
        <CardContent>
          {diasDiario.length ? (
            <CalendarioDiarios dias={diasDiario} mesReferencia={mesAtual} obraId={obraId} />
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
