import {
  BrickWall,
  Cable,
  Check,
  Columns3,
  Construction,
  DoorOpen,
  Droplets,
  Hammer,
  LayoutGrid,
  PaintRoller,
  Paintbrush,
  PencilRuler,
  Plug,
  Shovel,
  Sofa,
  SprayCan,
  Trees,
  Umbrella,
  WavesLadder,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { EtapaResumo } from "@/lib/obras/visao-cliente";

/**
 * Ícone e cor de cada etapa, por palavra-chave do nome.
 *
 * Mapa por palavra, e não por posição na lista, porque o nome da etapa é
 * livre: o engenheiro renomeia, usa um template diferente, cria uma etapa
 * nova. Casar por posição erraria na primeira obra fora do padrão; casar por
 * palavra acerta "Alvenaria e vedações", "Alvenaria do térreo" e "ALVENARIA"
 * com a mesma entrada.
 *
 * A ORDEM importa: a primeira palavra encontrada vence. "Instalações finais"
 * precisa ser testada antes de "instala", senão cairia no ícone de
 * infraestrutura embutida.
 *
 * As cores são decorativas — quem carrega o status é o preenchimento do
 * círculo e o rótulo embaixo, nunca a matiz sozinha. Por isso elas podem ser
 * variadas sem virar código de significado.
 */
const POR_PALAVRA: { chaves: string[]; Icone: LucideIcon; cor: string }[] = [
  { chaves: ["projeto", "planejamento", "aprovac"], Icone: PencilRuler, cor: "text-chart-2" },
  { chaves: ["preliminar", "canteiro", "terraplanagem"], Icone: Construction, cor: "text-atencao" },
  { chaves: ["fundac", "infraestrutura enterrada", "sapata", "estaca"], Icone: Shovel, cor: "text-chart-4" },
  { chaves: ["estrutura", "concreto", "supra"], Icone: Columns3, cor: "text-chart-1" },
  { chaves: ["cobertura", "telhado", "estanqueidade"], Icone: Umbrella, cor: "text-chart-3" },
  // Antes de "alvenaria": "Revestimentos de paredes e tetos" tem a palavra
  // "parede" e cairia no tijolo.
  { chaves: ["revestimento", "forro", "teto"], Icone: PaintRoller, cor: "text-grafico-a-vencer" },
  { chaves: ["alvenaria", "vedac", "parede", "muro"], Icone: BrickWall, cor: "text-grafico-vencido" },
  { chaves: ["impermeabiliz", "contrapiso"], Icone: Droplets, cor: "text-chart-2" },
  { chaves: ["piso", "pedra", "ceramic", "porcelanato"], Icone: LayoutGrid, cor: "text-chart-3" },
  { chaves: ["esquadria", "vidro", "porta", "janela"], Icone: DoorOpen, cor: "text-chart-2" },
  { chaves: ["pintura", "decorativ"], Icone: Paintbrush, cor: "text-grafico-enviado" },
  { chaves: ["marcenaria", "mobiliario", "planejado"], Icone: Sofa, cor: "text-chart-4" },
  { chaves: ["fachada", "paisagismo", "jardim", "externa"], Icone: Trees, cor: "text-grafico-pago" },
  // Antes de "instalac": "Piscina e equipamentos de lazer" tem "equipamento".
  { chaves: ["piscina", "lazer"], Icone: WavesLadder, cor: "text-chart-2" },
  { chaves: ["teste", "limpeza", "entrega"], Icone: SprayCan, cor: "text-grafico-pago" },
  // Também antes de "instalac", para separar o que corre dentro da parede do
  // que se instala no fim da obra.
  { chaves: ["embutida", "eletric", "hidraul"], Icone: Cable, cor: "text-grafico-enviado" },
  { chaves: ["instalac", "equipamento"], Icone: Plug, cor: "text-grafico-enviado" },
  { chaves: ["acabamento", "final"], Icone: Paintbrush, cor: "text-grafico-enviado" },
];

/** Último recurso: martelo. Melhor um ícone genérico que um ícone errado. */
const PADRAO = { Icone: Hammer, cor: "text-muted-foreground" };

function visualDaEtapa(nome: string) {
  const limpo = nome
    .toLowerCase()
    .normalize("NFD")
    // \u0300-\u036f é a faixa dos acentos combinantes que o NFD separa.
    // Escrita assim e não com os caracteres literais: literais são invisíveis
    // no editor e somem num copiar-e-colar sem deixar rastro.
    .replace(/[\u0300-\u036f]/g, "");
  for (const entrada of POR_PALAVRA) {
    if (entrada.chaves.some((c) => limpo.includes(c))) return entrada;
  }
  return PADRAO;
}

const SITUACAO = {
  concluida: { rotulo: "Concluída", texto: "text-sucesso" },
  andamento: { rotulo: "Em andamento", texto: "text-primary-texto" },
  a_iniciar: { rotulo: "A iniciar", texto: "text-muted-foreground" },
} as const;

/**
 * Um passo da trilha: o círculo e o que vem embaixo dele.
 *
 * O círculo diz o estado por PREENCHIMENTO, não por cor: cheio e verde com
 * visto para concluída, cheio e azul com halo para a que está rodando, claro
 * e contornado para as que ainda não começaram. A cor própria da etapa só
 * aparece nas que não começaram — nas outras, o estado tem precedência e
 * misturar as duas coisas tornaria as duas ilegíveis.
 */
function Marcador({ etapa }: { etapa: EtapaResumo }) {
  const { Icone, cor } = visualDaEtapa(etapa.nome);

  if (etapa.situacao === "concluida") {
    return (
      <span className="relative z-10 flex size-12 shrink-0 items-center justify-center rounded-full bg-sucesso text-white shadow-sm">
        <Check className="size-5" strokeWidth={3} aria-hidden />
      </span>
    );
  }

  if (etapa.situacao === "andamento") {
    return (
      <span className="relative z-10 flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm ring-4 ring-primary/15">
        <Icone className="size-5" aria-hidden />
      </span>
    );
  }

  return (
    <span
      className={cn(
        "relative z-10 flex size-12 shrink-0 items-center justify-center rounded-full bg-card ring-2 ring-border",
        cor
      )}
    >
      <Icone className="size-5" aria-hidden />
    </span>
  );
}

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
export function TrilhaEtapas({ etapas }: { etapas: EtapaResumo[] }) {
  return (
    <div className="barra-rolagem -mx-1 overflow-x-auto px-1 pt-1 pb-2">
      <ol className="flex min-w-max items-start">
        {etapas.map((etapa, i) => {
          const estilo = SITUACAO[etapa.situacao];
          const proxima = etapas[i + 1];
          return (
            <li key={etapa.id} className="flex items-start">
              <div className="flex w-36 flex-col items-center gap-2 text-center">
                <Marcador etapa={etapa} />
                <div className="flex w-full flex-col gap-1">
                  <p className="line-clamp-2 text-[13px] leading-snug font-semibold">
                    {etapa.nome}
                  </p>
                  <p className={cn("text-xs font-medium", estilo.texto)}>{estilo.rotulo}</p>
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

              {/*
                O traço que liga uma etapa à seguinte.
                
                Fica na altura do centro do círculo (`mt-[22px]` para uma
                bolinha de 48px) e é grosso o bastante para ler como trilho, não
                como borda. Verde até onde a obra chegou: o trecho que sai de
                uma etapa concluída já foi percorrido.
              */}
              {proxima && (
                <span
                  aria-hidden
                  className={cn(
                    "mt-[22px] h-1 w-8 shrink-0 rounded-full",
                    etapa.situacao === "concluida" ? "bg-sucesso/50" : "bg-border"
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
