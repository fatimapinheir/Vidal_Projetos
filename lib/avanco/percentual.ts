/**
 * O percentual de avanço de um conjunto de tarefas — média simples.
 *
 * Era ponderado por duração: uma tarefa de 13 dias pesava 6,5 vezes mais que
 * uma de 2. Tecnicamente defensável, e foi o que levou à troca: na etapa
 * "4.0 — Alvenaria", três das quatro tarefas em 100% mostravam **60%**, porque
 * a única pendente era a mais longa. Três de quatro lê-se 75%, e um número que
 * contraria a leitura direta vira desconfiança no sistema inteiro.
 *
 * A pedido, passa a ser média simples das tarefas. O custo é conhecido e vale
 * dizer: concluir tarefas curtas agora move o número tanto quanto concluir as
 * longas. "Limpeza do terreno" (2 dias) conta igual a "alvenaria interna"
 * (13 dias).
 *
 * MÉDIA DOS PERCENTUAIS, não contagem de concluídas. Uma tarefa em 50% entra
 * como meia — senão o avanço parcial, que é o que o engenheiro digita todo dia,
 * não apareceria em lugar nenhum até a tarefa fechar.
 *
 * Vive aqui porque a mesma régua é usada em três lugares — a tela de avanço, a
 * visão do cliente e a view `vw_progresso_obra` (esta em SQL, espelhando o que
 * está escrito aqui). Três cópias de uma regra é como elas divergem.
 */
export function percentualDeAvanco(percentuais: number[]): number {
  if (!percentuais.length) return 0;
  return percentuais.reduce((soma, p) => soma + p, 0) / percentuais.length;
}
