"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { formatDateBR } from "@/lib/format-date";
import { cn } from "@/lib/utils";
import type { DadosTimeline, TarefaTimeline } from "@/lib/cronograma/timeline-dados";

const MS_POR_DIA = 86_400_000;
const ALTURA_LINHA = 30;
const ALTURA_CABECALHO = 40;
const LARGURA_MINIMA_BARRA = 4;

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** Nível de zoom: quantos pixels vale um dia de calendário. */
const ZOOMS = [
  { id: "dia", label: "Dia", px: 26 },
  { id: "semana", label: "Semana", px: 10 },
  { id: "mes", label: "Mês", px: 4 },
] as const;

type ZoomId = (typeof ZOOMS)[number]["id"];

function paraDia(iso: string): number {
  return Math.round(new Date(`${iso}T00:00:00Z`).getTime() / MS_POR_DIA);
}

function diaParaIso(dia: number): string {
  return new Date(dia * MS_POR_DIA).toISOString().slice(0, 10);
}

/** Hoje no fuso local, convertido para o mesmo "número de dia" usado nas barras. */
function diaDeHoje(): number {
  const agora = new Date();
  const y = agora.getFullYear();
  const m = String(agora.getMonth() + 1).padStart(2, "0");
  const d = String(agora.getDate()).padStart(2, "0");
  return paraDia(`${y}-${m}-${d}`);
}

type Linha =
  | { tipo: "etapa"; id: string; nome: string; inicio: number | null; fim: number | null }
  | { tipo: "tarefa"; id: string; tarefa: TarefaTimeline; inicio: number | null; fim: number | null };

export function CronogramaTimeline({
  etapas,
  tarefas,
  dependencias,
  folgas,
  alturaMaxima,
}: DadosTimeline & {
  /** Limita a altura do quadro e rola na vertical — usado na visão geral, que só tem um pedaço da tela. */
  alturaMaxima?: number;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const hoje = useMemo(() => diaDeHoje(), []);

  const linhas = useMemo<Linha[]>(() => {
    const resultado: Linha[] = [];
    for (const etapa of etapas) {
      const daEtapa = tarefas.filter((t) => t.etapaId === etapa.id);
      const inicios = daEtapa.map((t) => t.inicio).filter((d): d is string => !!d).map(paraDia);
      const fins = daEtapa
        .map((t) => t.fimReal ?? t.fim)
        .filter((d): d is string => !!d)
        .map(paraDia);
      resultado.push({
        tipo: "etapa",
        id: etapa.id,
        nome: etapa.nome,
        inicio: inicios.length ? Math.min(...inicios) : null,
        fim: fins.length ? Math.max(...fins) : null,
      });
      for (const tarefa of daEtapa) {
        resultado.push({
          tipo: "tarefa",
          id: tarefa.id,
          tarefa,
          inicio: tarefa.inicio ? paraDia(tarefa.inicio) : null,
          fim: tarefa.fim ? paraDia(tarefa.fim) : null,
        });
      }
    }
    return resultado;
  }, [etapas, tarefas]);

  /** Intervalo de dias que a timeline cobre, considerando previsto, linha de base, real e hoje. */
  const intervalo = useMemo(() => {
    const datas: number[] = [];
    for (const t of tarefas) {
      for (const iso of [t.inicio, t.fim, t.baselineInicio, t.baselineFim, t.inicioReal, t.fimReal]) {
        if (iso) datas.push(paraDia(iso));
      }
    }
    if (!datas.length) return null;
    datas.push(hoje);
    return { inicio: Math.min(...datas) - 2, fim: Math.max(...datas) + 2 };
  }, [tarefas, hoje]);

  const totalDias = intervalo ? intervalo.fim - intervalo.inicio + 1 : 0;

  const [zoom, setZoom] = useState<ZoomId>(() => {
    if (totalDias <= 70) return "dia";
    if (totalDias <= 220) return "semana";
    return "mes";
  });
  const px = ZOOMS.find((z) => z.id === zoom)!.px;
  const larguraCanvas = totalDias * px;

  // Ao abrir (e ao trocar o zoom), deixa o dia de hoje visível em vez de começar
  // no início da obra — que pode estar meses atrás.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !intervalo) return;
    const xHoje = (hoje - intervalo.inicio) * px;
    el.scrollLeft = Math.max(0, xHoje - el.clientWidth / 3);
  }, [px, hoje, intervalo]);

  if (!intervalo || !linhas.length) {
    return (
      <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
        A timeline aparece aqui depois que as tarefas tiverem datas calculadas.
      </p>
    );
  }

  const x = (dia: number) => (dia - intervalo.inicio) * px;
  const larguraBarra = (inicio: number, fim: number) =>
    Math.max(LARGURA_MINIMA_BARRA, (fim - inicio + 1) * px);

  // Cabeçalho: faixa de meses (rótulos agrupados) + faixa de dias/semanas.
  // Tudo derivado da string ISO em UTC — formatar um Date em hora local
  // deslocaria o dia num fuso negativo (America/Sao_Paulo).
  const meses: { rotulo: string; dias: number }[] = [];
  const marcasDia: { dia: number; rotulo: string; forte: boolean }[] = [];
  for (let d = intervalo.inicio; d <= intervalo.fim; d++) {
    const iso = diaParaIso(d);
    const ano = iso.slice(0, 4);
    const diaDoMes = Number(iso.slice(8, 10));
    const rotulo = `${MESES[Number(iso.slice(5, 7)) - 1]} ${ano}`;
    const ultimo = meses[meses.length - 1];
    if (ultimo?.rotulo === rotulo) ultimo.dias += 1;
    else meses.push({ rotulo, dias: 1 });

    const segunda = new Date(`${iso}T00:00:00Z`).getUTCDay() === 1;
    if (px >= 20) marcasDia.push({ dia: d, rotulo: String(diaDoMes), forte: segunda });
    else if (px >= 8 && segunda) marcasDia.push({ dia: d, rotulo: String(diaDoMes), forte: true });
    else if (px < 8 && diaDoMes === 1) marcasDia.push({ dia: d, rotulo: "", forte: true });
  }

  const diasDeFolga: number[] = [];
  for (const folga of folgas) {
    const inicio = Math.max(paraDia(folga.dataInicio), intervalo.inicio);
    const fim = Math.min(paraDia(folga.dataFim), intervalo.fim);
    for (let d = inicio; d <= fim; d++) diasDeFolga.push(d);
  }

  const indicePorTarefaId = new Map(
    linhas.map((linha, indice) => [linha.tipo === "tarefa" ? linha.id : `etapa:${linha.id}`, indice])
  );
  const tarefaPorId = new Map(tarefas.map((t) => [t.id, t]));

  /** Ponto de ancoragem (x) de cada ponta da seta, conforme o tipo de dependência. */
  function ancora(tarefa: TarefaTimeline, ponta: "inicio" | "termino"): number | null {
    if (!tarefa.inicio || !tarefa.fim) return null;
    return ponta === "inicio" ? x(paraDia(tarefa.inicio)) : x(paraDia(tarefa.fim) + 1);
  }

  const setas = dependencias
    .map((dep) => {
      const pred = tarefaPorId.get(dep.predecessoraId);
      const suc = tarefaPorId.get(dep.sucessoraId);
      const linhaPred = indicePorTarefaId.get(dep.predecessoraId);
      const linhaSuc = indicePorTarefaId.get(dep.sucessoraId);
      if (!pred || !suc || linhaPred === undefined || linhaSuc === undefined) return null;

      const pontaPred = dep.tipo === "termino_inicio" || dep.tipo === "termino_termino" ? "termino" : "inicio";
      const pontaSuc = dep.tipo === "termino_inicio" || dep.tipo === "inicio_inicio" ? "inicio" : "termino";
      const x1 = ancora(pred, pontaPred);
      const x2 = ancora(suc, pontaSuc);
      if (x1 === null || x2 === null) return null;

      const y1 = linhaPred * ALTURA_LINHA + 12;
      const y2 = linhaSuc * ALTURA_LINHA + 12;
      const critica = pred.critica && suc.critica;

      // Rota ortogonal: sai da predecessora, desce/sobe, e entra na sucessora.
      const recuo = 8;
      const d =
        x2 >= x1 + recuo * 2
          ? `M ${x1} ${y1} L ${x1 + recuo} ${y1} L ${x1 + recuo} ${y2} L ${x2} ${y2}`
          : `M ${x1} ${y1} L ${x1 + recuo} ${y1} L ${x1 + recuo} ${(y1 + y2) / 2} L ${x2 - recuo} ${(y1 + y2) / 2} L ${x2 - recuo} ${y2} L ${x2} ${y2}`;

      // A seta sempre entra na sucessora vindo da esquerda, então a ponta aponta pra direita.
      const ponta = `${x2},${y2} ${x2 - 4},${y2 - 3} ${x2 - 4},${y2 + 3}`;

      return { id: `${dep.predecessoraId}-${dep.sucessoraId}`, d, ponta, critica };
    })
    .filter((s): s is { id: string; d: string; ponta: string; critica: boolean } => s !== null);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Legenda />
        <div className="flex items-center gap-1">
          {ZOOMS.map((z) => (
            <Button
              key={z.id}
              type="button"
              size="sm"
              variant={zoom === z.id ? "default" : "outline"}
              onClick={() => setZoom(z.id)}
            >
              {z.label}
            </Button>
          ))}
        </div>
      </div>

      <div
        className={cn(
          "flex rounded-xl border",
          alturaMaxima ? "overflow-y-auto" : "overflow-hidden"
        )}
        style={alturaMaxima ? { maxHeight: alturaMaxima } : undefined}
      >
        {/* Coluna fixa com os nomes — acompanha a rolagem vertical, não a horizontal. */}
        <div className="w-28 shrink-0 border-r sm:w-44 md:w-56">
          <div
            className="sticky top-0 z-30 flex items-end border-b bg-muted px-3 pb-1 text-xs font-medium text-muted-foreground"
            style={{ height: ALTURA_CABECALHO }}
          >
            Etapa / Tarefa
          </div>
          {linhas.map((linha) => (
            <div
              key={`${linha.tipo}-${linha.id}`}
              className={cn(
                "flex items-center truncate border-b px-3 text-xs last:border-b-0",
                linha.tipo === "etapa"
                  ? "bg-muted/30 font-medium"
                  : linha.tarefa.critica && "text-destructive"
              )}
              style={{ height: ALTURA_LINHA }}
              title={linha.tipo === "etapa" ? linha.nome : linha.tarefa.nome}
            >
              <span className={cn("truncate", linha.tipo === "tarefa" && "pl-2")}>
                {linha.tipo === "etapa" ? linha.nome : linha.tarefa.nome}
              </span>
            </div>
          ))}
        </div>

        <div ref={scrollRef} className="min-w-0 flex-1 overflow-x-auto">
          <div className="relative" style={{ width: larguraCanvas }}>
            {/* Cabeçalho: meses em cima, dias/semanas embaixo. */}
            <div
              className="sticky top-0 z-30 flex flex-col border-b bg-muted"
              style={{ height: ALTURA_CABECALHO }}
            >
              <div className="flex flex-1 items-center overflow-hidden">
                {meses.map((mes, i) => (
                  <div
                    key={`${mes.rotulo}-${i}`}
                    className="h-full shrink-0 truncate border-r px-1 text-[11px] font-medium capitalize"
                    style={{ width: mes.dias * px, lineHeight: `${ALTURA_CABECALHO / 2}px` }}
                  >
                    {mes.dias * px >= 34 ? mes.rotulo : ""}
                  </div>
                ))}
              </div>
              <div className="relative flex-1">
                {marcasDia.map((marca) => (
                  <div
                    key={marca.dia}
                    className={cn(
                      "absolute inset-y-0 flex items-center justify-center text-[10px]",
                      marca.forte ? "text-foreground" : "text-muted-foreground"
                    )}
                    style={{ left: x(marca.dia), width: px }}
                  >
                    {marca.rotulo}
                  </div>
                ))}
              </div>
            </div>

            <div className="relative" style={{ height: linhas.length * ALTURA_LINHA }}>
              {/* Fundo: dias de folga e linha do dia de hoje. */}
              {diasDeFolga.map((dia) => (
                <div
                  key={`folga-${dia}`}
                  className="absolute top-0 bottom-0 bg-destructive/[0.07]"
                  style={{ left: x(dia), width: px }}
                  title={`Folga — ${formatDateBR(diaParaIso(dia))}`}
                />
              ))}
              <div
                className="absolute top-0 bottom-0 z-10 w-px bg-primary-texto"
                style={{ left: x(hoje) }}
                title={`Hoje — ${formatDateBR(diaParaIso(hoje))}`}
              />

              {/* Setas de dependência, atrás das barras. */}
              <svg
                className="pointer-events-none absolute inset-0"
                width={larguraCanvas}
                height={linhas.length * ALTURA_LINHA}
              >
                {setas.map((seta) => (
                  <g
                    key={seta.id}
                    className={
                      seta.critica
                        ? "stroke-destructive/70 fill-destructive/70"
                        : "stroke-muted-foreground/50 fill-muted-foreground/50"
                    }
                  >
                    <path d={seta.d} fill="none" strokeWidth={1} />
                    <polygon points={seta.ponta} strokeWidth={0} />
                  </g>
                ))}
              </svg>

              {linhas.map((linha, indice) => (
                <div
                  key={`${linha.tipo}-${linha.id}`}
                  className={cn(
                    "absolute inset-x-0 border-b",
                    linha.tipo === "etapa" && "bg-muted/20"
                  )}
                  style={{ top: indice * ALTURA_LINHA, height: ALTURA_LINHA }}
                >
                  {linha.tipo === "etapa"
                    ? linha.inicio !== null &&
                      linha.fim !== null && (
                        <div
                          className="absolute top-2.5 h-2 rounded-sm bg-muted-foreground"
                          style={{ left: x(linha.inicio), width: larguraBarra(linha.inicio, linha.fim) }}
                          title={`${linha.nome}: ${formatDateBR(diaParaIso(linha.inicio))} – ${formatDateBR(diaParaIso(linha.fim))}`}
                        />
                      )
                    : renderBarrasTarefa(linha.tarefa, x, larguraBarra)}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function renderBarrasTarefa(
  tarefa: TarefaTimeline,
  x: (dia: number) => number,
  larguraBarra: (inicio: number, fim: number) => number
) {
  const previstoInicio = tarefa.inicio ? paraDia(tarefa.inicio) : null;
  const previstoFim = tarefa.fim ? paraDia(tarefa.fim) : null;
  const baseInicio = tarefa.baselineInicio ? paraDia(tarefa.baselineInicio) : null;
  const baseFim = tarefa.baselineFim ? paraDia(tarefa.baselineFim) : null;
  const realInicio = tarefa.inicioReal ? paraDia(tarefa.inicioReal) : null;
  const realFim = tarefa.fimReal ? paraDia(tarefa.fimReal) : null;

  const atraso =
    baseFim !== null && (realFim ?? previstoFim) !== null ? (realFim ?? previstoFim)! - baseFim : null;

  const detalhe = [
    tarefa.nome,
    previstoInicio !== null && previstoFim !== null
      ? `Previsto: ${formatDateBR(diaParaIso(previstoInicio))} – ${formatDateBR(diaParaIso(previstoFim))} (${tarefa.duracaoDias}d)`
      : null,
    baseInicio !== null && baseFim !== null
      ? `Linha de base: ${formatDateBR(diaParaIso(baseInicio))} – ${formatDateBR(diaParaIso(baseFim))}`
      : null,
    realInicio !== null
      ? `Real: ${formatDateBR(diaParaIso(realInicio))} – ${realFim !== null ? formatDateBR(diaParaIso(realFim)) : "em andamento"}`
      : null,
    tarefa.folgaDias !== null ? `Margem: ${tarefa.folgaDias}d` : null,
    atraso !== null && atraso > 0 ? `Atraso: ${atraso}d` : null,
    tarefa.critica ? "Tarefa crítica" : null,
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <>
      {baseInicio !== null && baseFim !== null && (
        <div
          className="absolute top-1 h-5 rounded border border-dashed border-muted-foreground/40"
          style={{ left: x(baseInicio), width: larguraBarra(baseInicio, baseFim) }}
          title={detalhe}
        />
      )}
      {previstoInicio !== null && previstoFim !== null && (
        <div
          className={cn(
            // Tarefa comum em branco, crítica em vermelho. O vermelho aqui é
            // sinal, não decoração — se a barra normal também fosse vermelha
            // (a cor da marca), o caminho crítico sumiria no meio das outras.
            "absolute top-2 h-2 rounded-full",
            tarefa.critica ? "bg-destructive" : "bg-foreground/85"
          )}
          style={{ left: x(previstoInicio), width: larguraBarra(previstoInicio, previstoFim) }}
          title={detalhe}
        />
      )}
      {realInicio !== null && (
        <div
          className={cn(
            "absolute top-5 h-2 rounded-full",
            atraso !== null && atraso > 0
              ? "bg-atencao"
              : "bg-sucesso",
            realFim === null && "opacity-70"
          )}
          style={{
            left: x(realInicio),
            width: larguraBarra(realInicio, realFim ?? Math.max(realInicio, diaDeHoje())),
          }}
          title={detalhe}
        />
      )}
    </>
  );
}

function Legenda() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2 w-4 rounded-full bg-foreground/85" /> Previsto
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2 w-4 rounded-full bg-destructive" /> Crítica
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2 w-4 rounded-full bg-sucesso" /> Real
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2 w-4 rounded-full bg-atencao" /> Real atrasado
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-4 w-4 rounded border border-dashed border-muted-foreground/60" /> Linha de base
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-4 w-px bg-primary-texto" /> Hoje
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-4 w-3 bg-destructive/[0.12]" /> Folga
      </span>
    </div>
  );
}
