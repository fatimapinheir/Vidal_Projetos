/**
 * O "hoje" do sistema, no fuso da obra.
 *
 * Isto existe por causa de um bug que só aparecia em produção. `new Date()`
 * devolve a hora do RELÓGIO DA MÁQUINA: no notebook do engenheiro é horário de
 * Brasília, no servidor do Netlify é UTC. Às 21h de um dia 11, em UTC já é
 * dia 12 — e o portal do cliente mostrava o diário de amanhã, a saudação dizia
 * "Bom dia" à noite, e a janela de "próximos 15 dias" começava um dia à
 * frente. Em desenvolvimento nada disso acontecia, porque a máquina de
 * desenvolvimento está no Brasil.
 *
 * A data de uma obra é a data do canteiro, não a do servidor. Por isso o fuso
 * é fixo e não vem do ambiente: amarrar ao relógio da máquina é exatamente o
 * erro que se quer evitar, e uma variável de ambiente esquecida reintroduz o
 * problema sem avisar.
 */

/**
 * Fuso das obras. O Brasil não tem mais horário de verão desde 2019, então
 * São Paulo e Fortaleza (onde as obras estão) são ambos UTC-3 o ano todo.
 */
export const FUSO_OBRA = "America/Sao_Paulo";

const FORMATO_DATA = new Intl.DateTimeFormat("en-CA", {
  timeZone: FUSO_OBRA,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const FORMATO_HORA = new Intl.DateTimeFormat("en-GB", {
  timeZone: FUSO_OBRA,
  hour: "2-digit",
  hourCycle: "h23",
});

/**
 * A data de hoje no canteiro, em ISO (YYYY-MM-DD).
 *
 * Monta a string a partir de `formatToParts`, e não da saída formatada: o
 * resultado de `format` depende do locale pedido, e um dia em que isso mudar
 * a string sairia em outra ordem, sem erro nenhum — só datas erradas.
 */
export function hojeNoFuso(agora: Date = new Date()): string {
  const partes = FORMATO_DATA.formatToParts(agora);
  const pegar = (tipo: Intl.DateTimeFormatPartTypes) =>
    partes.find((p) => p.type === tipo)?.value ?? "";
  return `${pegar("year")}-${pegar("month")}-${pegar("day")}`;
}

/** A hora cheia no canteiro, de 0 a 23. É dela que sai a saudação. */
export function horaNoFuso(agora: Date = new Date()): number {
  const parte = FORMATO_HORA.formatToParts(agora).find((p) => p.type === "hour");
  return Number(parte?.value ?? 0);
}

/**
 * O DIA de um instante gravado no banco, no fuso do canteiro (ISO YYYY-MM-DD).
 *
 * Colunas `timestamptz` — `aprovado_em`, `decidida_em`, `created_at` — chegam
 * do PostgREST em UTC. Cortar os dez primeiros caracteres da string, que é o
 * que `formatDateBR` faz com uma coluna `date`, mostra o dia errado em tudo o
 * que acontece depois das 21h: a decisão tomada às 21h30 de uma terça aparece
 * como quarta. Mesmo bug de `hojeNoFuso`, no outro sentido.
 *
 * Devolve `null` para entrada vazia ou data inválida, para quem chama poder
 * mostrar "—" em vez de "Invalid Date".
 */
export function diaDoInstante(valor: string | null | undefined): string | null {
  if (!valor) return null;
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return null;
  return hojeNoFuso(data);
}
