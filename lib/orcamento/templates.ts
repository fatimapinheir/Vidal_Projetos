/**
 * Templates de orçamento residencial.
 *
 * A estrutura de etapas segue a discriminação de serviços consagrada na
 * construção brasileira (NBR 12722 / Anexo B da NBR 12721). Os serviços
 * apontam para composições da SINAPI por BUSCA, não por código fixo: código
 * SINAPI muda de uma tabela mensal para outra, e template com código cravado
 * apontaria para o item errado — ou para nenhum — meses depois.
 *
 * AS QUANTIDADES SÃO ESTIMATIVA, NÃO MEDIÇÃO.
 *
 * Elas saem de proporções típicas sobre a área construída, porque é a única
 * informação que o cadastro tem — a quantidade real sai do projeto
 * arquitetônico, que o sistema não conhece. Por isso cada regra carrega um
 * texto que aparece na tela: o engenheiro vê a premissa, confere e corrige.
 * Número sem premissa à vista é o que transforma estimativa em erro assinado.
 */

export type ParametrosObra = {
  /** Área construída em m². Sem ela o template de serviços não se sustenta. */
  area: number;
  quartos: number;
  suites: number;
  banheiros: number;
};

export type ServicoTemplate = {
  /** Termos para achar a composição na tabela SINAPI ativa, do mais específico ao mais genérico. */
  busca: string[];
  /** Usado quando a busca não acha nada — o item entra para o engenheiro completar. */
  descricao: string;
  unidade: string;
  /** Premissa mostrada na tela, em português. */
  regra: string;
  calcular: (p: ParametrosObra) => number;
};

export type EtapaTemplate = { nome: EtapaOrcamento; servicos: ServicoTemplate[] };

const arred = (n: number) => Math.round(n * 100) / 100;

/**
 * Parede construída por m² de área.
 *
 * ~2,8 m² de alvenaria para cada m² de piso é a proporção usual em residência
 * térrea com compartimentação normal. Casa muito recortada passa disso; planta
 * aberta fica abaixo.
 */
const PAREDE_POR_M2 = 2.8;

/**
 * Etapas do orçamento. Lista única — é esta que os dois templates declaram.
 *
 * Extraídas da planilha "ORÇAMENTO ARDILES CIDADE ALPHA": a estrutura real é
 * organizada por SERVIÇO e é bem mais detalhada que as 12 etapas genéricas da
 * NBR 12722 que eu havia proposto — separa água fria de água quente,
 * revestimento interno de externo, e traz mão de obra como etapa própria
 * (empreitada global).
 *
 * Duas mudanças sobre a planilha, ambas pedidas:
 *
 * - Numeradas. A numeração é o que ordena a etapa na tela (ver a migração
 *   0035), e sem ela "10. PISOS" vinha antes de "02. MÃO DE OBRA".
 * - "06. COBERTURA" é nova. A planilha não tinha etapa de telhado, e os três
 *   serviços de cobertura do template não tinham onde ficar.
 *
 * Note que ela é diferente da estrutura do cronograma, e deve ser mesmo:
 * orçamento se organiza por serviço, para custear; cronograma por fase
 * física, para sequenciar.
 */
export const ETAPAS_ORCAMENTO = [
  "01. SERVIÇOS PRELIMINARES",
  "02. MÃO DE OBRA",
  "03. INFRA-ESTRUTURA",
  "04. SUPRA-ESTRUTURA",
  "05. PAREDES E PAINEIS",
  "06. COBERTURA",
  "07. ESQUADRIAS DE MADEIRA",
  "08. ESQUADRIAS DE ALUMÍNIO",
  "09. IMPERMEABILIZAÇÃO",
  "10. REVESTIMENTOS INTERNOS",
  "11. FORRO",
  "12. REVESTIMENTOS EXTERNOS",
  "13. PISOS",
  "14. PINTURA",
  "15. GRANITOS E MÁRMORES",
  "16. INSTALAÇÃO ELÉTRICA",
  "17. INSTALAÇÃO ÁGUA FRIA",
  "18. INSTALAÇÃO ÁGUA QUENTE",
  "19. INSTALAÇÃO AR CONDICIONADO",
  "20. INSTALAÇÃO ESGOTO E PLUVIAL",
  "21. LOUÇAS E METAIS",
  "22. PISCINA",
  "23. COMPLEMENTOS E OUTROS SERVIÇOS",
] as const;

/**
 * Nome de etapa válido. Amarra o template de serviços a esta lista: etapa
 * escrita fora dela não compila, que é a trava que faltava quando as duas
 * listas eram independentes.
 */
export type EtapaOrcamento = (typeof ETAPAS_ORCAMENTO)[number];

/**
 * Serviços típicos por etapa, para o template "etapas + materiais".
 *
 * As etapas são as de `ETAPAS_ORCAMENTO` — a MESMA lista do template "só
 * etapas". É o que faz a diferença entre os dois templates ser apenas os itens:
 * antes cada um tinha sua própria lista de etapas, e aplicar os dois no mesmo
 * rascunho somava 34 grupos com cara de dois orçamentos embaralhados.
 *
 * O tipo de `nome` é a própria lista, então um nome fora dela não compila — as
 * duas não podem mais divergir por descuido.
 *
 * Etapa sem serviço aqui (mão de obra, forro, revestimentos externos, água
 * quente, ar condicionado, piscina) entra no rascunho vazia, de propósito:
 * aparece no roteiro para o engenheiro preencher sabendo que não pode esquecer.
 */
export const TEMPLATE_RESIDENCIAL: EtapaTemplate[] = [
  {
    nome: "01. SERVIÇOS PRELIMINARES",
    servicos: [
{
          busca: ["LIMPEZA MECANIZADA DO TERRENO", "LIMPEZA DE TERRENO"],
          descricao: "Limpeza do terreno",
          unidade: "M2",
          regra: "1,3 × área construída (área do terreno a limpar excede a projeção da casa)",
          calcular: (p) => arred(p.area * 1.3),
        },
{
          busca: ["LOCACAO CONVENCIONAL DE OBRA", "GABARITO"],
          descricao: "Locação da obra (gabarito)",
          unidade: "M2",
          regra: "igual à área construída",
          calcular: (p) => arred(p.area),
        },
    ],
  },
  {
    nome: "03. INFRA-ESTRUTURA",
    servicos: [
{
          busca: ["ESCAVACAO MANUAL DE VALA", "ESCAVACAO MANUAL"],
          descricao: "Escavação manual de valas",
          unidade: "M3",
          regra: "0,12 m³ por m² construído (baldrame raso)",
          calcular: (p) => arred(p.area * 0.12),
        },
{
          busca: ["LASTRO DE CONCRETO MAGRO", "CONCRETO MAGRO"],
          descricao: "Lastro de concreto magro",
          unidade: "M3",
          regra: "0,02 m³ por m² construído",
          calcular: (p) => arred(p.area * 0.02),
        },
{
          busca: ["CONCRETO FCK = 25", "CONCRETO FCK"],
          descricao: "Concreto estrutural para fundação",
          unidade: "M3",
          regra: "0,05 m³ por m² construído",
          calcular: (p) => arred(p.area * 0.05),
        },
    ],
  },
  {
    nome: "04. SUPRA-ESTRUTURA",
    servicos: [
{
          busca: ["CONCRETO FCK = 25", "CONCRETO FCK"],
          descricao: "Concreto estrutural",
          unidade: "M3",
          regra: "0,18 m³ por m² construído (estrutura convencional, vãos de 3 a 4 m)",
          calcular: (p) => arred(p.area * 0.18),
        },
{
          busca: ["ARMACAO DE PILAR OU VIGA", "ARMACAO"],
          descricao: "Armação de aço CA-50",
          unidade: "KG",
          regra: "15 kg por m² construído",
          calcular: (p) => arred(p.area * 15),
        },
{
          busca: ["FABRICACAO, MONTAGEM E DESMONTAGEM DE FORMA", "FORMA PARA VIGA"],
          descricao: "Fôrma de madeira para estrutura",
          unidade: "M2",
          regra: "1,8 m² de fôrma por m² construído",
          calcular: (p) => arred(p.area * 1.8),
        },
    ],
  },
  {
    nome: "05. PAREDES E PAINEIS",
    servicos: [
{
          busca: ["ALVENARIA DE VEDACAO DE BLOCOS CERAMICOS", "ALVENARIA DE VEDACAO"],
          descricao: "Alvenaria de vedação em bloco cerâmico",
          unidade: "M2",
          regra: `${PAREDE_POR_M2} × área construída`,
          calcular: (p) => arred(p.area * PAREDE_POR_M2),
        },
{
          busca: ["VERGA MOLDADA IN LOCO"],
          descricao: "Vergas e contravergas",
          unidade: "M",
          regra: "0,5 m por m² construído",
          calcular: (p) => arred(p.area * 0.5),
        },
    ],
  },
  {
    nome: "06. COBERTURA",
    servicos: [
{
          busca: ["TRAMA DE MADEIRA COMPOSTA POR RIPAS", "TRAMA DE MADEIRA"],
          descricao: "Estrutura de madeira para telhado",
          unidade: "M2",
          regra: "1,15 × área construída (inclinação do telhado)",
          calcular: (p) => arred(p.area * 1.15),
        },
{
          busca: ["TELHAMENTO COM TELHA CERAMICA", "TELHAMENTO"],
          descricao: "Telhamento",
          unidade: "M2",
          regra: "1,15 × área construída",
          calcular: (p) => arred(p.area * 1.15),
        },
{
          busca: ["CALHA EM CHAPA DE ACO GALVANIZADO", "CALHA"],
          descricao: "Calhas e rufos",
          unidade: "M",
          regra: "0,35 m por m² construído",
          calcular: (p) => arred(p.area * 0.35),
        },
    ],
  },
  {
    nome: "07. ESQUADRIAS DE MADEIRA",
    servicos: [
{
          busca: ["PORTA DE MADEIRA PARA PINTURA", "PORTA DE MADEIRA"],
          descricao: "Porta interna de madeira",
          unidade: "UN",
          regra: "1 por quarto + 1 por banheiro + 2 (cozinha e serviço)",
          calcular: (p) => p.quartos + Math.max(p.banheiros, 1) + 2,
        },
    ],
  },
  {
    nome: "08. ESQUADRIAS DE ALUMÍNIO",
    servicos: [
{
          busca: ["JANELA DE ALUMINIO", "JANELA"],
          descricao: "Janela de alumínio",
          unidade: "M2",
          regra: "1/6 da área construída (mínimo de iluminação natural)",
          calcular: (p) => arred(p.area / 6),
        },
    ],
  },
  {
    nome: "09. IMPERMEABILIZAÇÃO",
    servicos: [
{
          busca: ["IMPERMEABILIZACAO DE SUPERFICIE", "IMPERMEABILIZACAO"],
          descricao: "Impermeabilização do baldrame",
          unidade: "M2",
          regra: "0,5 × área construída (faixa sobre o baldrame)",
          calcular: (p) => arred(p.area * 0.5),
        },
    ],
  },
  {
    nome: "10. REVESTIMENTOS INTERNOS",
    servicos: [
{
          busca: ["CHAPISCO APLICADO EM ALVENARIA", "CHAPISCO"],
          descricao: "Chapisco",
          unidade: "M2",
          regra: `${PAREDE_POR_M2 * 2} × área construída (duas faces da parede)`,
          calcular: (p) => arred(p.area * PAREDE_POR_M2 * 2),
        },
{
          busca: ["MASSA UNICA, PARA RECEBIMENTO DE PINTURA", "MASSA UNICA", "REBOCO"],
          descricao: "Massa única / reboco",
          unidade: "M2",
          regra: `${PAREDE_POR_M2 * 2} × área construída (duas faces)`,
          calcular: (p) => arred(p.area * PAREDE_POR_M2 * 2),
        },
{
          busca: ["REVESTIMENTO CERAMICO PARA PAREDES", "REVESTIMENTO CERAMICO PAREDE"],
          descricao: "Revestimento cerâmico de parede (áreas molhadas)",
          unidade: "M2",
          regra: "18 m² por banheiro + 12 m² de cozinha e área de serviço",
          calcular: (p) => arred(Math.max(p.banheiros, 1) * 18 + 12),
        },
    ],
  },
  {
    nome: "13. PISOS",
    servicos: [
{
          busca: ["CONTRAPISO EM ARGAMASSA", "CONTRAPISO"],
          descricao: "Contrapiso",
          unidade: "M2",
          regra: "igual à área construída",
          calcular: (p) => arred(p.area),
        },
{
          busca: ["REVESTIMENTO CERAMICO PARA PISO", "PISO CERAMICO", "PORCELANATO"],
          descricao: "Revestimento de piso",
          unidade: "M2",
          regra: "igual à área construída",
          calcular: (p) => arred(p.area),
        },
{
          busca: ["RODAPE CERAMICO", "RODAPE"],
          descricao: "Rodapé",
          unidade: "M",
          regra: "1,1 m por m² construído",
          calcular: (p) => arred(p.area * 1.1),
        },
    ],
  },
  {
    nome: "14. PINTURA",
    servicos: [
{
          busca: ["APLICACAO MANUAL DE MASSA", "MASSA CORRIDA", "SELADOR"],
          descricao: "Massa corrida / selador",
          unidade: "M2",
          regra: `${PAREDE_POR_M2 * 2} × área construída`,
          calcular: (p) => arred(p.area * PAREDE_POR_M2 * 2),
        },
{
          busca: ["APLICACAO MANUAL DE PINTURA COM TINTA LATEX ACRILICA", "PINTURA LATEX"],
          descricao: "Pintura látex",
          unidade: "M2",
          regra: `${PAREDE_POR_M2 * 2} × área + teto (área construída)`,
          calcular: (p) => arred(p.area * PAREDE_POR_M2 * 2 + p.area),
        },
    ],
  },
  {
    nome: "15. GRANITOS E MÁRMORES",
    servicos: [
{
          busca: ["BANCADA DE GRANITO", "BANCADA"],
          descricao: "Bancadas",
          unidade: "M2",
          regra: "1,5 m² por banheiro + 3 m² de cozinha",
          calcular: (p) => arred(Math.max(p.banheiros, 1) * 1.5 + 3),
        },
    ],
  },
  {
    nome: "16. INSTALAÇÃO ELÉTRICA",
    servicos: [
{
          busca: ["PONTO DE ILUMINACAO", "PONTO DE LUZ"],
          descricao: "Ponto de iluminação",
          unidade: "UN",
          regra: "1 ponto a cada 12 m² construídos",
          calcular: (p) => Math.max(Math.round(p.area / 12), 1),
        },
{
          busca: ["PONTO DE TOMADA", "TOMADA"],
          descricao: "Ponto de tomada",
          unidade: "UN",
          regra: "1 ponto a cada 8 m² construídos",
          calcular: (p) => Math.max(Math.round(p.area / 8), 1),
        },
{
          busca: ["QUADRO DE DISTRIBUICAO DE ENERGIA", "QUADRO DE DISTRIBUICAO"],
          descricao: "Quadro de distribuição",
          unidade: "UN",
          regra: "1 por residência",
          calcular: () => 1,
        },
    ],
  },
  {
    nome: "17. INSTALAÇÃO ÁGUA FRIA",
    servicos: [
{
          busca: ["TUBO, PVC, SOLDAVEL", "TUBO PVC SOLDAVEL"],
          descricao: "Tubulação de água fria",
          unidade: "M",
          regra: "8 m por ambiente molhado (banheiros + cozinha + área de serviço)",
          calcular: (p) => arred((p.banheiros + 2) * 8),
        },
    ],
  },
  {
    nome: "20. INSTALAÇÃO ESGOTO E PLUVIAL",
    servicos: [
{
          busca: ["TUBO PVC, SERIE NORMAL, ESGOTO", "TUBO PVC ESGOTO"],
          descricao: "Tubulação de esgoto",
          unidade: "M",
          regra: "10 m por ambiente molhado",
          calcular: (p) => arred((p.banheiros + 2) * 10),
        },
    ],
  },
  {
    nome: "21. LOUÇAS E METAIS",
    servicos: [
{
          busca: ["VASO SANITARIO SIFONADO COM CAIXA ACOPLADA", "VASO SANITARIO"],
          descricao: "Vaso sanitário com caixa acoplada",
          unidade: "UN",
          regra: "1 por banheiro",
          calcular: (p) => Math.max(p.banheiros, 1),
        },
{
          busca: ["LAVATORIO LOUCA", "LAVATORIO"],
          descricao: "Lavatório",
          unidade: "UN",
          regra: "1 por banheiro",
          calcular: (p) => Math.max(p.banheiros, 1),
        },
    ],
  },
  {
    nome: "23. COMPLEMENTOS E OUTROS SERVIÇOS",
    servicos: [
{
          busca: ["LIMPEZA FINAL DA OBRA", "LIMPEZA FINAL"],
          descricao: "Limpeza final da obra",
          unidade: "M2",
          regra: "igual à área construída",
          calcular: (p) => arred(p.area),
        },
    ],
  },
];



export function totalDeServicos() {
  return TEMPLATE_RESIDENCIAL.reduce((n, e) => n + e.servicos.length, 0);
}
