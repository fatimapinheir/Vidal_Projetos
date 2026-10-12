import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatDateBR } from "@/lib/format-date";
import { hojeIso } from "@/lib/locacoes/calculo";
import { PercentualTarefa, ConcluirEtapaButton } from "./avanco-controles";

const ISO_DATA = /^\d{4}-\d{2}-\d{2}$/;

function Barra({ percentual }: { percentual: number }) {
  return (
    <div
      className="h-1.5 w-full overflow-hidden rounded-full bg-grafico-trilho"
      role="img"
      aria-label={`${percentual.toFixed(0)}% executado`}
    >
      <div
        className="h-full rounded-full bg-grafico-pago transition-[width]"
        style={{ width: `${Math.min(percentual, 100)}%` }}
      />
    </div>
  );
}

export default async function AvancoObraPage({
  params,
  searchParams,
}: {
  params: Promise<{ obraId: string }>;
  searchParams: Promise<{ data?: string }>;
}) {
  const { obraId } = await params;
  const { data: dataParam } = await searchParams;
  const hoje = hojeIso();
  // A data vale para tudo que for lançado nesta tela. Fica na URL em vez de
  // estado de cliente: a tela é servidor, cada linha é um controle separado, e
  // assim a data sobrevive ao refresh que cada lançamento dispara.
  const dataMedicao = dataParam && ISO_DATA.test(dataParam) ? dataParam : hoje;

  const supabase = await createClient();

  const [{ data: etapas }, { data: tarefas }, { data: avancos }] = await Promise.all([
    supabase
      .from("cronograma_etapas")
      .select("id, nome, ordem")
      .eq("obra_id", obraId)
      .order("ordem"),
    supabase
      .from("cronograma_tarefas")
      .select("id, etapa_id, nome, duracao_dias, data_inicio_cedo, data_fim_cedo, critica, ordem")
      .eq("obra_id", obraId)
      .order("ordem"),
    supabase.from("vw_avanco_atual").select("*").eq("obra_id", obraId),
  ]);

  if (!etapas?.length) {
    return (
      <div className="flex flex-col items-start gap-4">
        <p className="text-sm text-muted-foreground">
          O avanço é medido nas tarefas do cronograma. Monte o cronograma da obra para começar a
          registrar.
        </p>
        <Button
          nativeButton={false}
          render={<Link href={`/obras/${obraId}/cronograma`}>Ir para o cronograma</Link>}
        />
      </div>
    );
  }

  const avancoPorTarefa = new Map(avancos?.map((a) => [a.cronograma_tarefa_id, a]) ?? []);

  const tarefasPorEtapa = new Map<string, NonNullable<typeof tarefas>>();
  for (const tarefa of tarefas ?? []) {
    const daEtapa = tarefasPorEtapa.get(tarefa.etapa_id) ?? [];
    daEtapa.push(tarefa);
    tarefasPorEtapa.set(tarefa.etapa_id, daEtapa);
  }

  /**
   * O percentual da etapa e o da obra são ponderados por duração, igual à
   * `vw_progresso_obra`. Média simples faria tarefa de 1 dia pesar o mesmo que
   * uma de 30, e concluir as curtas infla o progresso.
   */
  function percentualDe(lista: NonNullable<typeof tarefas>) {
    const dias = lista.reduce((s, t) => s + t.duracao_dias, 0);
    if (dias <= 0) return 0;
    const executados = lista.reduce(
      (s, t) => s + (t.duracao_dias * (avancoPorTarefa.get(t.id)?.percentual ?? 0)) / 100,
      0
    );
    return (executados / dias) * 100;
  }

  const todasTarefas = tarefas ?? [];
  const percentualObra = percentualDe(todasTarefas);
  const concluidas = todasTarefas.filter(
    (t) => (avancoPorTarefa.get(t.id)?.percentual ?? 0) >= 100
  ).length;
  const emAndamento = todasTarefas.filter((t) => {
    const p = avancoPorTarefa.get(t.id)?.percentual ?? 0;
    return p > 0 && p < 100;
  }).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="max-w-xl text-sm text-muted-foreground">
          O avanço é medido nas tarefas do cronograma. Informe o percentual executado de cada uma —
          quando terminar, 100%. A data abaixo vale para tudo que você lançar nesta tela.
        </p>
        <form method="GET" className="flex items-end gap-2">
          <div className="flex flex-col gap-1">
            <label htmlFor="data" className="text-xs text-muted-foreground">
              Data da medição
            </label>
            <input
              id="data"
              name="data"
              type="date"
              defaultValue={dataMedicao}
              max={hoje}
              className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
            />
          </div>
          <Button type="submit" variant="outline" size="sm">
            Usar esta data
          </Button>
        </form>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-2 py-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm text-muted-foreground">Avanço físico da obra</p>
            <p className="font-heading text-2xl font-semibold tabular-nums">
              {percentualObra.toFixed(1)}%
            </p>
          </div>
          <Barra percentual={percentualObra} />
          <p className="text-xs text-muted-foreground">
            {concluidas} de {todasTarefas.length} tarefas concluídas
            {emAndamento > 0 && `, ${emAndamento} em andamento`} · ponderado pela duração de cada
            tarefa
          </p>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3">
        {etapas.map((etapa) => {
          const daEtapa = tarefasPorEtapa.get(etapa.id) ?? [];
          const percentualEtapa = percentualDe(daEtapa);
          const pendentes = daEtapa.filter(
            (t) => (avancoPorTarefa.get(t.id)?.percentual ?? 0) < 100
          ).length;

          return (
            <div key={etapa.id} className="overflow-hidden rounded-xl border bg-card shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-sm font-medium">{etapa.nome}</p>
                    <p className="text-sm tabular-nums">{percentualEtapa.toFixed(0)}%</p>
                  </div>
                  <div className="mt-2">
                    <Barra percentual={percentualEtapa} />
                  </div>
                </div>
                {pendentes > 0 && (
                  <ConcluirEtapaButton
                    obraId={obraId}
                    etapaId={etapa.id}
                    quantas={pendentes}
                    dataMedicao={dataMedicao}
                  />
                )}
              </div>

              {daEtapa.length ? (
                <ul className="divide-y">
                  {daEtapa.map((tarefa) => {
                    const avanco = avancoPorTarefa.get(tarefa.id);
                    const percentual = avanco?.percentual ?? 0;
                    return (
                      <li
                        key={tarefa.id}
                        className="flex flex-wrap items-center justify-between gap-3 px-4 py-2"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="flex items-center gap-2 text-sm">
                            <span className={percentual >= 100 ? "text-muted-foreground" : ""}>
                              {tarefa.nome}
                            </span>
                            {tarefa.critica && percentual < 100 && (
                              <Badge variant="destructive">Crítica</Badge>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {tarefa.duracao_dias} {tarefa.duracao_dias === 1 ? "dia" : "dias"}
                            {tarefa.data_fim_cedo && ` · previsto até ${formatDateBR(tarefa.data_fim_cedo)}`}
                            {avanco && ` · medido em ${formatDateBR(avanco.data_medicao)}`}
                          </p>
                        </div>
                        <PercentualTarefa
                          obraId={obraId}
                          tarefaId={tarefa.id}
                          percentual={percentual}
                          dataMedicao={dataMedicao}
                        />
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="px-4 py-3 text-sm text-muted-foreground">
                  Nenhuma tarefa nesta etapa.
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
