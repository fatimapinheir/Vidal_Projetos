"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { formatDateBR } from "@/lib/format-date";
import { cn } from "@/lib/utils";
import type { DadosTimeline, TarefaTimeline } from "@/lib/cronograma/timeline-dados";
import { PERIODOS, janelaDoPeriodo, encaixarNosDados, type PeriodoId } from "@/lib/cronograma/periodos";

const MS_POR_DIA = 86_400_000;
const ALTURA_LINHA = 30;
const ALTURA_CABECALHO = 40;
const LARGURA_MINIMA_BARRA = 4;

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** Pixels por dia mínimos — abaixo disso a barra some e o cabeçalho embola. */
const PX_MINIMO = 2;
const PX_MAXIMO = 160;

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
  simplificado = false,
}: DadosTimeline & {
  /** Limita a altura do quadro e rola na vertical — usado na visão geral, que só tem um pedaço da tela. */
  alturaMaxima?: number | string;
  /**
   * Esconde tudo o que fala de atraso: caminho crítico, linha de base, margem
   * e a barra de real em amarelo. É o modo do portal do cliente.
   *
   * Não é uma versão "pobre" da timeline — é outra pergunta. O engenheiro
   * olha o quadro para saber onde intervir, e para isso precisa ver o que
   * escorregou. O cliente olha para saber o que está acontecendo e quando
   * termina; apontar-lhe um atraso que ele não pode resolver só gera
   * preocupação. As datas mostradas são as mesmas — o que sai é o julgamento
   * sobre elas.
   */
  simplificado?: boolean;
}) {
  const quadroRef = useRef<HTMLDivElement>(null);
  const colunaNomesRef = useRef<HTMLDivElement>(null);
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

  const [periodo, setPeriodo] = useState<PeriodoId>("mes");

  /**
   * Largura visível da área rolável — é ela que decide quantos pixels vale um
   * dia para a janela escolhida caber exatamente.
   *
   * Medida com ResizeObserver porque o quadro divide espaço com a coluna de
   * nomes e muda com a janela do navegador; um valor fixo deixaria a semana
   * sobrando ou faltando na tela.
   */
  const [larguraVisivel, setLarguraVisivel] = useState(0);
  useEffect(() => {
    const el = quadroRef.current;
    if (!el) return;
    // Desconta a coluna de nomes: ela fica presa à esquerda e come largura
    // útil do calendário. Sem descontar, a semana escolhida não cabe na tela.
    const medir = () => {
      const nomes = colunaNomesRef.current?.offsetWidth ?? 0;
      setLarguraVisivel(Math.max(0, el.clientWidth - nomes));
    };
    const observador = new ResizeObserver(medir);
    observador.observe(el);
    medir();
    return () => observador.disconnect();
  }, []);

  /*
   * A janela do período, encaixada onde há tarefa.
   *
   * O período sai do calendário, mas a obra não acompanha o calendário: numa
   * obra que começa em março, clicar em "Semana" mostrava um quadro em branco.
   * Havendo tarefa na janela, ela fica onde está; não havendo, desliza até os
   * dados mantendo a largura.
   */
  const janela = useMemo(() => {
    const j = janelaDoPeriodo(periodo, diaParaIso(hoje));
    if (!j) return null;
    const bruta = { inicio: paraDia(j.inicioIso), fim: paraDia(j.fimIso) };
    /*
     * Só as barras de TAREFA entram na conta.
     *
     * A barra da etapa é o agregado das tarefas dela e atravessa meses — ela
     * cruzaria qualquer janela e diria "tem dado aqui" mesmo quando nenhuma
     * tarefa cai no período.
     */
    const barras = linhas
      .filter((l) => l.tipo === "tarefa" && l.inicio !== null && l.fim !== null)
      .map((l) => ({ inicio: l.inicio!, fim: l.fim! }));
    return encaixarNosDados(bruta, barras, periodo === "semana");
  }, [periodo, hoje, linhas]);

  const px = useMemo(() => {
    if (!larguraVisivel || !intervalo) return 10;
    const dias = janela ? janela.fim - janela.inicio + 1 : totalDias;
    if (dias <= 0) return 10;
    return Math.min(PX_MAXIMO, Math.max(PX_MINIMO, larguraVisivel / dias));
  }, [larguraVisivel, janela, totalDias, intervalo]);

  const larguraCanvas = totalDias * px;

  /*
   * Rola para o começo da janela escolhida.
   *
   * Em "obra inteira" não há janela: aí o alvo é hoje, um terço à esquerda,
   * porque o início da obra pode estar meses atrás e abrir ali não mostra
   * nada do que está acontecendo.
   */
  useEffect(() => {
    const el = quadroRef.current;
    if (!el || !intervalo) return;
    if (janela) {
      el.scrollLeft = Math.max(0, (janela.inicio - intervalo.inicio) * px);
    } else {
      const xHoje = (hoje - intervalo.inicio) * px;
      el.scrollLeft = Math.max(0, xHoje - larguraVisivel / 3);
    }
  }, [px, hoje, intervalo, janela, larguraVisivel]);

  /*
   * Rola também na VERTICAL, até a primeira linha com barra na janela.
   *
   * Sem isto o filtro acertava o período e errava a altura: numa obra de 130
   * tarefas ordenadas por etapa, escolher "Mês" levava a outubro — que tem 28
   * tarefas — mas deixava na tela as vinte primeiras linhas, que são de
   * setembro e aparecem vazias. Parecia filtro sem efeito.
   *
   * Para na etapa que contém a primeira tarefa, e não na tarefa em si: o nome
   * da frente de serviço é o que situa quem olha.
   */
  useEffect(() => {
    const quadro = quadroRef.current;
    if (!quadro || !janela) return;

    const primeira = linhas.findIndex(
      (l) =>
        l.tipo === "tarefa" &&
        l.inicio !== null &&
        l.fim !== null &&
        l.inicio <= janela.fim &&
        l.fim >= janela.inicio
    );
    if (primeira < 0) return;

    // Sobe uma linha para a faixa da etapa ficar visível acima da tarefa.
    const alvo = Math.max(0, (primeira - 1) * ALTURA_LINHA);
    quadro.scrollTop = alvo;
  }, [janela, linhas]);

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
        <Legenda simplificado={simplificado} />
        <div className="flex items-center gap-1">
          {PERIODOS.map((p) => (
            <Button
              key={p.id}
              type="button"
              size="sm"
              variant={periodo === p.id ? "default" : "outline"}
              onClick={() => setPeriodo(p.id)}
            >
              {p.label}
            </Button>
          ))}
        </div>
      </div>

      {/*
        UM container de rolagem, para os dois eixos.
        
        Eram dois aninhados — o de fora rolava na vertical, o de dentro na
        horizontal — e um `position: sticky` gruda no container de rolagem mais
        próximo, não no de fora. Por isso o cabeçalho de datas, que vive dentro
        do container horizontal, sumia ao rolar para baixo: ele estava preso a
        uma caixa que não rola na vertical.
        
        Com um container só, a coluna de nomes se prende pela esquerda
        (`sticky left-0`) e o cabeçalho pelo topo (`sticky top-0`), que é o
        arranjo padrão de Gantt.
      */}
      <div
        ref={quadroRef}
        className="barra-rolagem overflow-auto rounded-xl border bg-card"
        style={{ maxHeight: alturaMaxima ?? "70vh" }}
      >
        <div className="relative w-fit">
          {/* Linha de cabeçalho: presa no topo, inteira. */}
          <div className="sticky top-0 z-40 flex" style={{ height: ALTURA_CABECALHO }}>
            <div
              ref={colunaNomesRef}
              className="sticky left-0 z-50 flex w-28 shrink-0 items-end border-r border-b bg-muted px-3 pb-1 text-xs font-medium text-muted-foreground sm:w-44 md:w-56"
            >
              Etapa / Tarefa
            </div>
            <div
              className="relative flex shrink-0 flex-col border-b bg-muted"
              style={{ width: larguraCanvas }}
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
          </div>

          {/* Corpo: nomes presos à esquerda, barras rolando com o calendário. */}
          <div className="flex">
            <div className="sticky left-0 z-30 w-28 shrink-0 border-r bg-card sm:w-44 md:w-56">
              {linhas.map((linha) => (
                <div
                  key={`nome-${linha.tipo}-${linha.id}`}
                  className={cn(
                    "flex items-center truncate border-b px-3 text-xs last:border-b-0",
                    linha.tipo === "etapa"
                      ? "bg-muted/30 font-medium"
                      : !simplificado && linha.tarefa.critica && "text-destructive"
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

            <div
              className="relative shrink-0"
              style={{ width: larguraCanvas, height: linhas.length * ALTURA_LINHA }}
            >
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
                      seta.critica && !simplificado
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
                    : renderBarrasTarefa(linha.tarefa, x, larguraBarra, simplificado)}
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
  larguraBarra: (inicio: number, fim: number) => number,
  simplificado: boolean
) {
  const previstoInicio = tarefa.inicio ? paraDia(tarefa.inicio) : null;
  const previstoFim = tarefa.fim ? paraDia(tarefa.fim) : null;
  const baseInicio = tarefa.baselineInicio ? paraDia(tarefa.baselineInicio) : null;
  const baseFim = tarefa.baselineFim ? paraDia(tarefa.baselineFim) : null;
  const realInicio = tarefa.inicioReal ? paraDia(tarefa.inicioReal) : null;
  const realFim = tarefa.fimReal ? paraDia(tarefa.fimReal) : null;

  const atraso =
    baseFim !== null && (realFim ?? previstoFim) !== null ? (realFim ?? previstoFim)! - baseFim : null;

  // No modo simplificado o detalhe para nas datas. Linha de base, margem,
  // atraso e "tarefa crítica" são leitura de desvio — sairiam da tela e
  // voltariam pelo tooltip.
  const detalhe = [
    tarefa.nome,
    previstoInicio !== null && previstoFim !== null
      ? `${simplificado ? "Programado" : "Previsto"}: ${formatDateBR(diaParaIso(previstoInicio))} – ${formatDateBR(diaParaIso(previstoFim))} (${tarefa.duracaoDias}d)`
      : null,
    !simplificado && baseInicio !== null && baseFim !== null
      ? `Linha de base: ${formatDateBR(diaParaIso(baseInicio))} – ${formatDateBR(diaParaIso(baseFim))}`
      : null,
    realInicio !== null
      ? `${simplificado ? "Executado" : "Real"}: ${formatDateBR(diaParaIso(realInicio))} – ${realFim !== null ? formatDateBR(diaParaIso(realFim)) : "em andamento"}`
      : null,
    !simplificado && tarefa.folgaDias !== null ? `Margem: ${tarefa.folgaDias}d` : null,
    !simplificado && atraso !== null && atraso > 0 ? `Atraso: ${atraso}d` : null,
    !simplificado && tarefa.critica ? "Tarefa crítica" : null,
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <>
      {!simplificado && baseInicio !== null && baseFim !== null && (
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
            "absolute h-2 rounded-full",
            // Sem a linha de base, a barra programada ocupa o topo da faixa:
            // ela foi desenhada deslocada para caber dentro do retângulo
            // tracejado, que aqui não existe.
            simplificado ? "top-1.5" : "top-2",
            !simplificado && tarefa.critica ? "bg-destructive" : "bg-foreground/85"
          )}
          style={{ left: x(previstoInicio), width: larguraBarra(previstoInicio, previstoFim) }}
          title={detalhe}
        />
      )}
      {realInicio !== null && (
        <div
          className={cn(
            "absolute h-2 rounded-full",
            simplificado ? "top-4.5" : "top-5",
            // Verde sempre, no modo do cliente: a barra existe para mostrar o
            // que já foi executado, e o amarelo a transformaria em alerta.
            !simplificado && atraso !== null && atraso > 0 ? "bg-atencao" : "bg-sucesso",
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

function Legenda({ simplificado }: { simplificado: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2 w-4 rounded-full bg-foreground/85" />{" "}
        {simplificado ? "Programado" : "Previsto"}
      </span>
      {!simplificado && (
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-4 rounded-full bg-destructive" /> Crítica
        </span>
      )}
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2 w-4 rounded-full bg-sucesso" /> {simplificado ? "Executado" : "Real"}
      </span>
      {!simplificado && (
        <>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-4 rounded-full bg-atencao" /> Real atrasado
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-4 w-4 rounded border border-dashed border-muted-foreground/60" /> Linha
            de base
          </span>
        </>
      )}
      <span className="inline-flex items-center gap-1.5">
        <span className="h-4 w-px bg-primary-texto" /> Hoje
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-4 w-3 bg-destructive/[0.12]" /> Folga
      </span>
    </div>
  );
}
