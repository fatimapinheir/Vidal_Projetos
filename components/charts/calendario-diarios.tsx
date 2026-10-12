import Link from "next/link";
import { CloudRain, Sun, CloudOff, FileText, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Praticabilidade } from "@/lib/diario/condicao";

export type DiaCalendario = {
  data: string;
  /** Pior condição do dia entre os três períodos — é ela que explica parada. */
  clima: Praticabilidade | null;
};

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
 * Um mês de diários publicados. Cada dia com registro é clicável e mostra o
 * clima — que é o que explica, sem precisar de conversa, por que uma semana
 * rendeu menos que a outra.
 *
 * Tudo em UTC a partir da string ISO: montar `Date` e ler em hora local
 * deslocaria o dia para trás em fuso negativo.
 */
export function CalendarioDiarios({
  dias,
  mesReferencia,
  base,
  hoje,
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

  const celulas: ({ dia: number; iso: string } | null)[] = [
    ...Array.from({ length: deslocamento }, () => null),
    ...Array.from({ length: diasNoMes }, (_, i) => {
      const dia = i + 1;
      return { dia, iso: `${mesReferencia}-${String(dia).padStart(2, "0")}` };
    }),
  ];

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

          const registro = porData.get(celula.iso);
          const ehHoje = celula.iso === hoje;
          const noFuturo = !!hoje && celula.iso > hoje;

          if (!registro) {
            // Dia futuro nunca clica: não há o que ter acontecido ainda.
            const clicavel = diasSemRegistroClicaveis && !noFuturo;
            const conteudo = (
              <>
                <span className="leading-none">{celula.dia}</span>
                {clicavel && <Minus className="size-3 opacity-50" aria-hidden />}
              </>
            );
            const classe = cn(
              "flex aspect-square flex-col items-center justify-center gap-0.5 rounded-lg text-xs",
              ehHoje && "ring-2 ring-primary/40",
              clicavel
                ? "border border-dashed text-muted-foreground transition-colors hover:bg-muted/60"
                : "text-muted-foreground/40"
            );

            return clicavel ? (
              <Link
                key={celula.iso}
                href={`${base}/diario/${celula.iso}`}
                title={`${celula.dia} — sem RDO registrado`}
                className={classe}
              >
                {conteudo}
              </Link>
            ) : (
              <div key={celula.iso} className={classe}>
                {conteudo}
              </div>
            );
          }

          const info = registro.clima ? climaInfo[registro.clima] : null;
          const descricao = info ? `${info.label}` : "Diário publicado";

          return (
            <Link
              key={celula.iso}
              href={`${base}/diario/${celula.iso}`}
              title={`${celula.dia} — ${descricao}`}
              className={cn(
                "flex aspect-square flex-col items-center justify-center gap-0.5 rounded-lg border bg-muted/40 text-xs transition-colors hover:bg-muted",
                ehHoje && "ring-2 ring-primary/40"
              )}
            >
              <span className="font-medium leading-none">{celula.dia}</span>
              {info ? (
                <info.Icone className={cn("size-3", info.cor)} aria-hidden />
              ) : (
                <FileText className="size-3 text-muted-foreground" aria-hidden />
              )}
            </Link>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {(Object.keys(climaInfo) as Praticabilidade[]).map((chave) => {
          const { Icone, label, cor } = climaInfo[chave];
          return (
            <span key={chave} className="inline-flex items-center gap-1.5">
              <Icone className={cn("size-3.5", cor)} aria-hidden />
              {label}
            </span>
          );
        })}
        <span className="inline-flex items-center gap-1.5">
          <FileText className="size-3.5" aria-hidden />
          Sem clima informado
        </span>
        {diasSemRegistroClicaveis && (
          <span className="inline-flex items-center gap-1.5">
            <Minus className="size-3.5 opacity-50" aria-hidden />
            Sem RDO
          </span>
        )}
      </div>
    </div>
  );
}
