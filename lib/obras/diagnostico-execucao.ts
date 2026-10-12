/**
 * O diagnóstico de "obra executada x valores pagos".
 *
 * Vive fora do componente porque é regra de negócio, não desenho: é a frase
 * que o cliente vai ler para decidir se precisa ligar para o engenheiro.
 * Separada, dá para exercitar cada caso sem abrir o navegador — e foi assim
 * que o caso "tudo zerado" apareceu.
 *
 * Antes a comparação era uma linha só (`fisico >= pago`), e com a obra recém
 * cadastrada — zero medido, zero pago — ela caía no ramo positivo e dizia
 * "Ótimo! A obra avançou mais do que os valores pagos". Dizia isso sobre uma
 * obra em que nada aconteceu.
 */

export type DiagnosticoExecucao =
  | "sem_dados"
  | "positivo"
  | "mao_de_obra_adiantada"
  | "materiais_adiantados";

/**
 * Tolerância, em pontos percentuais, antes de apontar descompasso.
 *
 * O avanço físico é medido de vez em quando e o pagamento sai na data da
 * nota: os dois nunca batem no mesmo dia. Sem folga, a mensagem oscilaria
 * entre "ótimo" e "atenção" a cada parcela paga, e o cliente aprenderia a
 * ignorá-la — que é o pior destino de um aviso.
 */
const TOLERANCIA = 2;

export type EntradaDiagnostico = {
  /** Percentual físico executado, da última medição. */
  percentualFisico: number;
  /** Percentual pago de mão de obra sobre o orçado de mão de obra. */
  percentualMaoDeObra: number;
  /** Percentual pago de material/serviço sobre o orçado dessas frentes. */
  percentualMaterial: number;
  /** Houve orçamento ativo com valor nessas frentes? Sem ele não há denominador. */
  temOrcamento: boolean;
  /** Houve ao menos uma medição de avanço? Sem ela, 0% não quer dizer parado. */
  temMedicao: boolean;
};

/**
 * Qual das quatro situações a obra está vivendo.
 *
 * A ordem das comparações é deliberada: mão de obra adiantada vence material
 * adiantado quando os dois acontecem juntos. Material pago antes da execução
 * costuma ser estoque — vira pilha no canteiro e será usado. Mão de obra paga
 * antes da execução é dinheiro que saiu por serviço que ainda não existe, e
 * não há o que estocar. Se só uma frase cabe, é essa.
 */
export function diagnosticarExecucao(e: EntradaDiagnostico): DiagnosticoExecucao {
  if (!e.temOrcamento || !e.temMedicao) return "sem_dados";
  if (e.percentualMaoDeObra > e.percentualFisico + TOLERANCIA) return "mao_de_obra_adiantada";
  if (e.percentualMaterial > e.percentualFisico + TOLERANCIA) return "materiais_adiantados";
  return "positivo";
}
