import type { DiarioCondicao } from "@/lib/types/database.types";

/** Condições do tempo, na ordem do mais seco ao mais severo. */
export const CONDICOES: { valor: DiarioCondicao; label: string }[] = [
  { valor: "ensolarado", label: "Ensolarado" },
  { valor: "nublado", label: "Nublado" },
  { valor: "chuvoso", label: "Chuvoso" },
  { valor: "chuva_forte", label: "Chuva forte" },
];

export const rotuloCondicao = (c: DiarioCondicao | null) =>
  CONDICOES.find((x) => x.valor === c)?.label ?? "—";

/**
 * Praticabilidade derivada da condição do tempo.
 *
 * O clima do diário descreve o tempo; o calendário e o indicador "dias
 * parados" precisam saber se deu para trabalhar. Em vez de pedir os dois ao
 * engenheiro todo dia, derivamos um do outro — e foi por isso que as quatro
 * condições foram escolhidas de forma a colapsar nos três níveis antigos.
 *
 * Aproximação assumida: chuva forte conta como dia perdido. Um dia pode parar
 * por outros motivos (falta de material, por exemplo), e isso o diário conta
 * em ocorrências, não aqui.
 */
export type Praticabilidade = "praticavel" | "chuva" | "impraticavel";

export function praticabilidade(c: DiarioCondicao | null): Praticabilidade | null {
  if (!c) return null;
  if (c === "chuva_forte") return "impraticavel";
  if (c === "chuvoso") return "chuva";
  return "praticavel";
}
