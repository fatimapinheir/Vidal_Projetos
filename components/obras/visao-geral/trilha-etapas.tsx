import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EtapaResumo } from "@/lib/obras/visao-cliente";

/**
 * As etapas da obra como uma trilha horizontal.
 *
 * É a tradução do cronograma para quem não lê Gantt. O Gantt responde "quando
 * cada coisa acontece"; esta trilha responde "onde a obra está agora", que é
 * a única pergunta que o cliente faz de pé, no celular.
 *
 * Rola na horizontal em vez de quebrar linha: a sequência é a informação, e
 * uma trilha quebrada em duas fileiras deixa de parecer uma sequência.
 *
 * Nada aqui diz atraso. Uma etapa só pode estar concluída, em andamento ou a
 * iniciar — "a iniciar" não carrega juízo sobre estar cedo ou tarde.
 */
const SITUACAO = {
  concluida: {
    rotulo: "Concluída",
    circulo: "bg-sucesso/12 text-sucesso ring-1 ring-sucesso/25",
    texto: "text-sucesso",
  },
  andamento: {
    rotulo: "Em andamento",
    circulo: "bg-primary text-primary-foreground shadow-sm",
    texto: "text-primary-texto",
  },
  a_iniciar: {
    rotulo: "A iniciar",
    circulo: "bg-muted text-muted-foreground ring-1 ring-border",
    texto: "text-muted-foreground",
  },
} as const;

/**
 * O número da etapa dentro do círculo, não um ícone.
 *
 * A referência usa um pictograma por etapa (trator, pilar, tijolo). Isso só
 * funciona com uma lista fixa de etapas — e as daqui são livres: o engenheiro
 * nomeia como quiser, e um dicionário de ícones erraria na primeira obra que
 * fugisse do padrão. O número sempre acerta, e a etapa concluída troca o
 * número pelo visto, que é a informação que importa nela.
 */
function Marcador({ etapa, indice }: { etapa: EtapaResumo; indice: number }) {
  const estilo = SITUACAO[etapa.situacao];
  return (
    <span
      className={cn(
        "flex size-11 shrink-0 items-center justify-center rounded-full font-heading text-sm font-semibold",
        estilo.circulo
      )}
    >
      {etapa.situacao === "concluida" ? (
        <Check className="size-5" aria-hidden />
      ) : (
        String(indice + 1).padStart(2, "0")
      )}
    </span>
  );
}

export function TrilhaEtapas({ etapas }: { etapas: EtapaResumo[] }) {
  return (
    <div className="barra-rolagem -mx-1 overflow-x-auto px-1 pb-2">
      <ol className="flex min-w-max items-start gap-1">
        {etapas.map((etapa, i) => {
          const estilo = SITUACAO[etapa.situacao];
          return (
            <li key={etapa.id} className="flex items-start">
              <div className="flex w-36 flex-col items-center gap-2 text-center">
                <Marcador etapa={etapa} indice={i} />
                <div className="flex flex-col gap-1">
                  <p className="line-clamp-2 text-[13px] leading-snug font-medium">
                    {etapa.nome}
                  </p>
                  <p className={cn("text-xs", estilo.texto)}>{estilo.rotulo}</p>
                  {etapa.situacao === "andamento" && (
                    <div className="flex items-center gap-1.5">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-grafico-trilho">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${etapa.percentual}%` }}
                        />
                      </div>
                      <span className="text-[11px] text-muted-foreground tabular-nums">
                        {etapa.percentual}%
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* O traço que liga uma etapa à seguinte. Fica na altura do
                  círculo, e não no meio do bloco, porque é o círculo que
                  marca o passo. */}
              {i < etapas.length - 1 && (
                <span
                  aria-hidden
                  className={cn(
                    "mt-[22px] h-px w-6 shrink-0",
                    etapa.situacao === "concluida" ? "bg-sucesso/40" : "bg-border"
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
