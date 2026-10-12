import {
  TEMPLATE_CRONOGRAMA_RESIDENCIAL,
  type EtapaTemplateCronograma,
} from "./template-residencial";
import { TEMPLATE_CRONOGRAMA_ALTO_PADRAO } from "./template-alto-padrao";

/**
 * Templates de cronograma, um por faixa de obra.
 *
 * A faixa já existe no cadastro da obra, então a tela consegue sugerir o
 * template certo em vez de obrigar a escolher — e o engenheiro troca se
 * quiser.
 *
 * Os dois não têm a mesma qualidade de dado, e isso importa: o de MCMV traz
 * durações praticadas numa obra real; o de alto padrão traz só a estrutura,
 * com 1 dia em cada tarefa. A tela avisa a diferença antes de aplicar, porque
 * cronograma com duração falsa que parece verdadeira é pior que cronograma
 * vazio.
 */
export type TemplateCronograma = {
  id: string;
  nome: string;
  /** Faixa do cadastro da obra que este template atende. */
  faixa: string;
  /** Verdadeiro quando as durações vieram de obra real. */
  duracoesReais: boolean;
  observacao: string;
  etapas: EtapaTemplateCronograma[];
};

export const TEMPLATES_CRONOGRAMA: TemplateCronograma[] = [
  {
    id: "mcmv",
    nome: "MCMV / Habitação Popular",
    faixa: "MCMV / Habitação Popular",
    duracoesReais: true,
    observacao:
      "Durações praticadas na obra MR — Fase 1. A obra de origem tem dois pavimentos: em casa térrea, remova a fase PAVIMENTO SUPERIOR.",
    etapas: TEMPLATE_CRONOGRAMA_RESIDENCIAL,
  },
  {
    id: "alto-padrao",
    nome: "Alto Padrão",
    faixa: "Alto Padrão",
    duracoesReais: false,
    observacao:
      "Estrutura completa, de projetos até entrega das chaves. As durações entram com 1 dia e precisam ser ajustadas tarefa a tarefa.",
    etapas: TEMPLATE_CRONOGRAMA_ALTO_PADRAO,
  },
];

export function acharTemplate(id: string) {
  return TEMPLATES_CRONOGRAMA.find((t) => t.id === id);
}

/** Template sugerido pela faixa da obra; null quando a faixa não tem um. */
export function templateDaFaixa(faixa: string | null) {
  return TEMPLATES_CRONOGRAMA.find((t) => t.faixa === faixa) ?? null;
}

export function contarTarefas(t: TemplateCronograma) {
  return t.etapas.reduce((n, e) => n + e.tarefas.length, 0);
}
