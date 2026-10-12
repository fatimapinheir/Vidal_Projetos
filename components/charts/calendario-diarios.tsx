import Link from "next/link";
import { CloudRain, Sun, CloudOff, FileText, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Praticabilidade } from "@/lib/diario/condicao";

export type DiaCalendario = {
  data: string;
  /** Condição do dia, já convertida em praticabilidade. */
  clima: Praticabilidade | null;
};

/** Intervalo de folga cadastrado na obra, fechado nas duas pontas. */
export type FolgaCalendario = { dataInicio: string; dataFim: string };

const DIAS_SEMANA = ["D", "S", "T", "Q", "Q", "S", "S"];
const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

const climaInfo: Record<Praticabilidade, { Icone: typeof Sun; label: string; cor: string }> = {
  praticavel: { Icone: Sun, label: "Praticável", cor: "text-grafico-pago" },
  chuva: { Icone: CloudRain, label: "Chuva", cor: "text-grafico-a-vencer" },
  impraticavel: { Icone: CloudOff, label: "Impraticável", cor: "text-grafico-vencido" },
};

/**
 * O que cada quadrado do calendário quer dizer.
 *
 * Três cores e um estado neutro, e a conta é sempre a mesma: o dia foi de
 * trabalho? houve registro?
 *
 * - **verde**: trabalhou e tem RDO. O dia está documentado.
 * - **amarelo**: era dia de trabalho e não tem RDO. É uma lacuna, não um erro
 *   — pode ser que o engenheiro ainda vá lançar.
 * - **vermelho**: dia não trabalhado, por ser domingo ou folga cadastrada.
 *   Aqui vermelho não é alarme: é "não se esperava registro neste dia", e é o
 *   que impede o cliente de ler um domingo em branco como falha.
 * - **neutro**: dia futuro. Nada a cobrar de um dia que não chegou.
 */
type TipoDia = "registrado" | "sem_registro" | "nao_trabalhado" | "futuro";

const ESTILO: Record<TipoDia, { caixa: string; numero: string }> = {
  registrado: {
    caixa: "border border-sucesso/30 bg-sucesso/12 hover:bg-sucesso/20",
    numero: "font-semibold text-sucesso",
  },
  sem_registro: {
    caixa: "border border-atencao/35 bg-atencao/12 hover:bg-atencao/20",
    numero: "font-medium text-atencao",
  },
  nao_trabalhado: {
    caixa: "border border-destructive/25 bg-destructive/10",
    numero: "text-destructive/80",
  },
  futuro: { caixa: "", numero: "text-muted-foreground/40" },
};

/**
 * Sábado e domingo são dias não trabalhados; o resto vem das folgas.
 *
 * A mesma semana de segunda a sexta que o motor do cronograma usa — ver
 * `ehFimDeSemana` em `lib/cronograma/cpm`. Marcava só o domingo, e o sábado
 * aparecia em amarelo como se faltasse um RDO que ninguém deveria ter feito.
 */
function ehFimDeSemana(iso: string) {
  const dia = new Date(`${iso}T00:00:00Z`).getUTCDay();
  return dia === 0 || dia === 6;
}

/**
 * Um mês de diários. Cada dia com registro é clicável e mostra o clima — que é
 * o que explica, sem precisar de conversa, por que uma semana rendeu menos que
 * a outra.
 *
 * Tudo em UTC a partir da string ISO: montar `Date` e ler em hora local
 * deslocaria o dia para trás em fuso negativo.
 */
export function CalendarioDiarios({
  dias,
  mesReferencia,
  base,
  hoje,
  folgas = [],
  diasSemRegistroClicaveis = false,
  className,
}: {
  dias: DiaCalendario[];
  /** "YYYY-MM" do mês a desenhar. */
  mesReferencia: string;
  /**
   * Prefixo da rota do diário. O engenheiro e o cliente veem o mesmo
   * calendário, mas cada um abre o dia na sua própria tela — com o caminho
   * fixo em `/portal`, o engenheiro era jogado para fora da área dele.
   */
  base: string;
  /**
   * Data de hoje, para destacar o dia e saber o que é futuro.
   *
   * Vem de fora, e não de `new Date()`, porque "hoje" depende do fuso da obra
   * e este componente roda no servidor — ver `lib/fuso`.
   */
  hoje?: string;
  /** Folgas cadastradas da obra. Sem elas, só o domingo é dia não trabalhado. */
  folgas?: FolgaCalendario[];
  /**
   * Deixa clicar em dia sem registro.
   *
   * Desligado por padrão: no cartão da visão geral o calendário é resumo, e
   * cada célula vazia clicável seria um convite a abrir uma tela que só diz
   * "não tem nada aqui". Na tela do diário é o contrário — é lá que o cliente
   * vai justamente conferir se o dia tem RDO.
   */
  diasSemRegistroClicaveis?: boolean;
  className?: string;
}) {
  const [ano, mes] = mesReferencia.split("-").map(Number);
  const primeiroDia = new Date(Date.UTC(ano, mes - 1, 1));
  const diasNoMes = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  const deslocamento = primeiroDia.getUTCDay();

  const porData = new Map(dias.map((d) => [d.data, d]));

  /** Comparação de string ISO resolve o intervalo sem construir `Date`. */
  const emFolga = (iso: string) =>
    folgas.some((f) => iso >= f.dataInicio && iso <= f.dataFim);

  const celulas: ({ dia: number; iso: string } | null)[] = [
    ...Array.from({ length: deslocamento }, () => null),
    ...Array.from({ length: diasNoMes }, (_, i) => {
      const dia = i + 1;
      return { dia, iso: `${mesReferencia}-${String(dia).padStart(2, "0")}` };
    }),
  ];

  function tipoDoDia(iso: string): TipoDia {
    // Registro vence tudo: se há RDO num domingo, trabalhou-se no domingo.
    if (porData.has(iso)) return "registrado";
    if (ehFimDeSemana(iso) || emFolga(iso)) return "nao_trabalhado";
    if (hoje && iso > hoje) return "futuro";
    return "sem_registro";
  }

  const usados = new Set(celulas.filter(Boolean).map((c) => tipoDoDia(c!.iso)));

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {/* `capitalize` no parágrafo inteiro viraria "Julho De 2026" — só o mês sobe. */}
      <p className="text-sm font-medium">
        <span className="capitalize">{MESES[mes - 1]}</span> de {ano}
      </p>

      <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-muted-foreground">
        {DIAS_SEMANA.map((d, i) => (
          <div key={i}>{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {celulas.map((celula, i) => {
          if (!celula) return <div key={`vazio-${i}`} />;

          const tipo = tipoDoDia(celula.iso);
          const estilo = ESTILO[tipo];
          const ehHoje = celula.iso === hoje;
          const registro = porData.get(celula.iso);
          const info = registro?.clima ? climaInfo[registro.clima] : null;

          const classe = cn(
            "flex aspect-square flex-col items-center justify-center gap-0.5 rounded-lg text-xs transition-colors",
            estilo.caixa,
            // O anel de hoje vem por último e com offset, para não ser
            // confundido com a borda que marca o tipo do dia.
            ehHoje && "ring-2 ring-primary ring-offset-1 ring-offset-card"
          );

          const conteudo = (
            <>
              <span className={cn("leading-none", estilo.numero)}>{celula.dia}</span>
              {registro ? (
                info ? (
                  <info.Icone className={cn("size-3", info.cor)} aria-hidden />
                ) : (
                  <FileText className="size-3 text-muted-foreground" aria-hidden />
                )
              ) : (
                tipo === "sem_registro" && <Minus className="size-3 text-atencao/70" aria-hidden />
              )}
            </>
          );

          const descricao = registro
            ? `${celula.dia} — ${info?.label ?? "diário publicado"}`
            : tipo === "nao_trabalhado"
              ? `${celula.dia} — dia não trabalhado`
              : tipo === "sem_registro"
                ? `${celula.dia} — sem RDO registrado`
                : String(celula.dia);

          // Dia futuro e dia não trabalhado não abrem: num não há o que ter
          // acontecido, no outro não se esperava registro.
          const clicavel = !!registro || (diasSemRegistroClicaveis && tipo === "sem_registro");

          return clicavel ? (
            <Link
              key={celula.iso}
              href={`${base}/diario/${celula.iso}`}
              title={descricao}
              className={classe}
            >
              {conteudo}
            </Link>
          ) : (
            <div key={celula.iso} title={descricao} className={classe}>
              {conteudo}
            </div>
          );
        })}
      </div>

      {/* A legenda só lista o que apareceu no mês — explicar uma cor ausente
          é ruído, e num mês inteiro registrado sobrariam três linhas mortas. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
        {usados.has("registrado") && (
          <span className="inline-flex items-center gap-1.5">
            <span className="size-3 rounded-sm border border-sucesso/30 bg-sucesso/25" />
            Com RDO
          </span>
        )}
        {usados.has("sem_registro") && (
          <span className="inline-flex items-center gap-1.5">
            <span className="size-3 rounded-sm border border-atencao/35 bg-atencao/25" />
            Sem RDO
          </span>
        )}
        {usados.has("nao_trabalhado") && (
          <span className="inline-flex items-center gap-1.5">
            <span className="size-3 rounded-sm border border-destructive/25 bg-destructive/20" />
            Não trabalhado
          </span>
        )}
        <span className="mx-1 hidden h-3 w-px bg-border sm:block" />
        {(Object.keys(climaInfo) as Praticabilidade[]).map((chave) => {
          const { Icone, label, cor } = climaInfo[chave];
          return (
            <span key={chave} className="inline-flex items-center gap-1.5">
              <Icone className={cn("size-3.5", cor)} aria-hidden />
              {label}
            </span>
          );
        })}
      </div>
    </div>
  );
}
