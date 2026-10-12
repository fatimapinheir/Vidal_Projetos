/**
 * Template de cronograma residencial.
 *
 * Extraído do cronograma real da obra MR — Fase 1, Bloco 1, fornecido pelo
 * engenheiro. As durações são as que ele praticou em obra, não estimativa
 * minha: por isso o template vale.
 *
 * As etapas aqui são FASES FÍSICAS (fundação, térreo, superior, coberta), e
 * não serviços. É de propósito, e é diferente do orçamento, que se organiza
 * por serviço para custear. Cronograma se organiza pela ordem em que a obra
 * sobe. Misturar as duas estruturas foi o erro que a comparação das duas
 * planilhas revelou: só 1 das 7 fases do cronograma existe como etapa do
 * orçamento.
 *
 * ATENÇÃO: a obra de origem tem dois pavimentos. Em casa térrea, a etapa
 * "PAVIMENTO SUPERIOR" não se aplica e deve ser removida depois de aplicar.
 *
 * Gerado a partir da planilha; ao atualizar, regere em vez de editar à mão.
 */

export type TarefaTemplate = { nome: string; duracaoDias: number };
export type EtapaTemplateCronograma = {
  nome: string;
  /** Nota da etapa, quando a lista de origem traz uma (ex: "Antes de fechar paredes"). */
  observacao?: string;
  tarefas: TarefaTemplate[];
};

export const TEMPLATE_CRONOGRAMA_RESIDENCIAL: EtapaTemplateCronograma[] = [
  {
    nome: "SERVIÇOS PRELIMINARES",
    tarefas: [
      { nome: "Ligação de energia elétrica e água provisória", duracaoDias: 1 },
      { nome: "Limpeza inicial do terreno, remoção de camada vegetal", duracaoDias: 1 },
      { nome: "Container escritório", duracaoDias: 1 },
      { nome: "Corte e aterro", duracaoDias: 1 },
      { nome: "Embasamentos e muros - elevação", duracaoDias: 17 },
      { nome: "Marcação do bloco", duracaoDias: 1 },
    ],
  },
  {
    nome: "FUNDAÇÃO",
    tarefas: [
      { nome: "Embasamentos", duracaoDias: 16 },
      { nome: "Distribuição de passagens na estrutura - Térreo", duracaoDias: 3 },
      { nome: "Radier", duracaoDias: 2 },
    ],
  },
  {
    nome: "PAVIMENTO TÉRREO",
    tarefas: [
      { nome: "Alvenarias de bloco cerâmico", duracaoDias: 23 },
      { nome: "Distribuição elétrica de paredes - Térreo", duracaoDias: 3 },
      { nome: "Estrutura de concreto - Armação", duracaoDias: 7 },
      { nome: "Distribuição de vigotas, lajotas e escoramento - Laje - Térreo", duracaoDias: 9 },
      { nome: "Distribuição elétrica caixinhas e tubulação paredes  - Térreo", duracaoDias: 6 },
      { nome: "Distribuição elétrica caixinhas e tubulação teto  - Térreo", duracaoDias: 3 },
      { nome: "Distribuição de malha pop - Laje - Térreo", duracaoDias: 2 },
      { nome: "Formas de madeira - Laje - Térreo", duracaoDias: 2 },
      { nome: "Emestramento - Laje - Térreo", duracaoDias: 1 },
      { nome: "Concretagem - Laje - Térreo", duracaoDias: 1 },
      { nome: "Revestimento argamassado parede e tetos (Emboço, Reboco e Gesso) - Áreas Secas e Áreas Molhadas", duracaoDias: 6 },
      { nome: "Prumadas hidrossanitárias térreo ao 1º pavimento", duracaoDias: 3 },
      { nome: "Distribuição de gás", duracaoDias: 3 },
      { nome: "Prumadas hidraúlicas", duracaoDias: 9 },
      { nome: "Regularização e impermeabilização áreas molhadas (Wc`s e varandas)", duracaoDias: 3 },
      { nome: "Revestimento Cerâmico / Porcelanatos / Filetes / Soleiras - Piso e Parede", duracaoDias: 6 },
      { nome: "Fiação elétrica do apto", duracaoDias: 4 },
      { nome: "Esquadrias de alumínio", duracaoDias: 4 },
      { nome: "Portas", duracaoDias: 5 },
      { nome: "Bancadas", duracaoDias: 3 },
      { nome: "Rejunte de pisos e paredes", duracaoDias: 5 },
      { nome: "Emassamento, lixamento e pintura (Verificar possibilidade de textura interna)", duracaoDias: 6 },
      { nome: "Louças", duracaoDias: 5 },
      { nome: "Instalações finais (metais ou plasticos)", duracaoDias: 3 },
      { nome: "Tomadas, interruptores, fechamento de quadro e instalação de exaustores", duracaoDias: 2 },
      { nome: "Limpeza final", duracaoDias: 3 },
    ],
  },
  {
    nome: "PAVIMENTO SUPERIOR",
    tarefas: [
      { nome: "Marcação de alvenaria - 1º pavimento", duracaoDias: 1 },
      { nome: "Alvenarias de bloco cerâmico e distribuição elétrica de paredes - 1º pavimento", duracaoDias: 13 },
      { nome: "Distribuição elétrica de paredes - Pav Superior", duracaoDias: 3 },
      { nome: "Estrutura de concreto - Armação", duracaoDias: 5 },
      { nome: "Distribuição de vigotas, lajotas e escoramento - Laje - Pav Superior", duracaoDias: 12 },
      { nome: "Distribuição elétrica caixinhas e tubulação paredes  - Pav Superior", duracaoDias: 3 },
      { nome: "Distribuição elétrica caixinhas e tubulação teto  - Pav Superior", duracaoDias: 3 },
      { nome: "Distruição malha pop - Laje - Pav Superior", duracaoDias: 2 },
      { nome: "Formas de madeira - Laje - Pav Superior", duracaoDias: 2 },
      { nome: "Emestramento - Laje - Pav Superior", duracaoDias: 1 },
      { nome: "Concretagem - Laje - Pav Superior", duracaoDias: 1 },
      { nome: "Revestimento argamassado parede e tetos (Emboço, Reboco e Gesso) - Áreas secas e áreas molhadas", duracaoDias: 4 },
      { nome: "Prumadas hidrossanitárias 1º pavimento à coberta", duracaoDias: 4 },
      { nome: "Distribuição de gás", duracaoDias: 3 },
      { nome: "Prumadas hidraúlicas", duracaoDias: 2 },
      { nome: "Regularização e impermeabilização áreas molhadas (Wc`s e varandas)", duracaoDias: 6 },
      { nome: "Preparação, emestramento e contrapiso - Áreas secas", duracaoDias: 6 },
      { nome: "Revestimento Cerâmico / Porcelanatos / Filetes / Soleiras - Piso e Parede", duracaoDias: 3 },
      { nome: "Fiação elétrica do apto", duracaoDias: 4 },
      { nome: "Esquadrias de alumínio", duracaoDias: 3 },
      { nome: "Portas", duracaoDias: 7 },
      { nome: "Bancadas", duracaoDias: 4 },
      { nome: "Rejunte de pisos e paredes", duracaoDias: 3 },
      { nome: "Emassamento, lixamento e pintura (Verificar possibilidade de textura interna)", duracaoDias: 2 },
      { nome: "Louças", duracaoDias: 2 },
      { nome: "Instalações finais (metais ou plasticos)", duracaoDias: 3 },
      { nome: "Tomadas, interruptores, fechamento de quadro e instalação de exaustores", duracaoDias: 2 },
      { nome: "Limpeza final", duracaoDias: 2 },
    ],
  },
  {
    nome: "COBERTA",
    tarefas: [
      { nome: "Empenas, bases da caixa d`água e calhas (caixas d`água já serem instaladas)", duracaoDias: 3 },
      { nome: "Execução da coberta (madeiramento e telha fibrocimento)", duracaoDias: 7 },
      { nome: "Impermeabilização - coberta (após inicio do madeiramento)", duracaoDias: 3 },
    ],
  },
  {
    nome: "FACHADA",
    tarefas: [
      { nome: "Chapins e peitoril das janelas", duracaoDias: 2 },
      { nome: "Emboço de fachada", duracaoDias: 3 },
      { nome: "Manta líquida após execução emboço", duracaoDias: 4 },
      { nome: "Textura de fachada", duracaoDias: 5 },
    ],
  },
  {
    nome: "ÁREA DE VIVÊNCIA",
    tarefas: [
      { nome: "Emboço muro (executar após instalações elétricas)", duracaoDias: 3 },
      { nome: "Instalações elétricas", duracaoDias: 2 },
      { nome: "Execução de caixas de inpesão", duracaoDias: 6 },
      { nome: "Instalações hidraúlicas", duracaoDias: 2 },
      { nome: "Instalação de portões", duracaoDias: 1 },
      { nome: "Execução de piso", duracaoDias: 15 },
      { nome: "Pinturas externas", duracaoDias: 3 },
      { nome: "Acabamentos finais (quadros, interruptores, metais)", duracaoDias: 2 },
      { nome: "Execução deck completo (Churrasqueira, bancada, e coberta, cerâmica)", duracaoDias: 4 },
      { nome: "FINALIZAÇÃO DA OBRA", duracaoDias: 1 },
      { nome: "PREVISÃO DE VISTORIAS", duracaoDias: 1 },
    ],
  },
];

export const TOTAL_TAREFAS_TEMPLATE = 81;
export const DURACAO_TOTAL_TEMPLATE = 343;
