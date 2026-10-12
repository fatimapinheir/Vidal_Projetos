/**
 * Gera public/modelo-orcamento.xlsx — a planilha-modelo de importação.
 *
 * Fica como script, e não como arquivo binário editado à mão, porque os nomes
 * das colunas e a lista de etapas precisam acompanhar o código: os apelidos que
 * o importador reconhece estão em lib/orcamento/colunas-planilha.ts e as etapas
 * em lib/orcamento/templates.ts. Mudando um, roda-se isto de novo.
 *
 *   node scripts/gerar-modelo-orcamento.mjs
 */
import { writeFileSync } from "node:fs";
import { utils, write } from "xlsx";

const ETAPAS = [
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
];

// --- Aba 1: o orçamento em si ---
const cabecalho = ["ETAPA", "CÓDIGO", "DESCRIÇÃO", "UNIDADE", "QUANTIDADE", "PREÇO UNITÁRIO"];

const exemplos = [
  ["01. SERVIÇOS PRELIMINARES", "99059", "Limpeza mecanizada do terreno", "M2", 195, 4.37],
  ["01. SERVIÇOS PRELIMINARES", "99059", "Locação da obra com gabarito de tábuas", "M2", 150, 8.12],
  ["03. INFRA-ESTRUTURA", "93358", "Escavação manual de valas até 1,5 m", "M3", 18, 72.5],
  ["03. INFRA-ESTRUTURA", "", "Lastro de concreto magro, espessura 5 cm", "M3", 3, 465.8],
  ["04. SUPRA-ESTRUTURA", "92265", "Concreto estrutural FCK 25 MPa, lançado", "M3", 27, 712.4],
  ["04. SUPRA-ESTRUTURA", "92916", "Armação de aço CA-50, corte e dobra", "KG", 2250, 12.85],
  ["05. PAREDES E PAINEIS", "103333", "Alvenaria de bloco cerâmico 14x19x39", "M2", 420, 68.9],
  ["06. COBERTURA", "92543", "Estrutura de madeira para telha cerâmica", "M2", 172.5, 98.3],
  ["06. COBERTURA", "94207", "Telhamento com telha cerâmica capa-canal", "M2", 172.5, 54.6],
  ["10. REVESTIMENTOS INTERNOS", "87878", "Chapisco em parede interna", "M2", 840, 6.45],
  ["13. PISOS", "87630", "Contrapiso em argamassa, espessura 3 cm", "M2", 150, 34.2],
  ["16. INSTALAÇÃO ELÉTRICA", "91926", "Ponto de tomada 2P+T 10A", "UN", 19, 118.7],
  ["21. LOUÇAS E METAIS", "86888", "Vaso sanitário com caixa acoplada", "UN", 2, 486.9],
  ["23. COMPLEMENTOS E OUTROS SERVIÇOS", "", "Limpeza final da obra", "M2", 150, 5.8],
];

const abaOrcamento = utils.aoa_to_sheet([cabecalho, ...exemplos]);
abaOrcamento["!cols"] = [
  { wch: 36 }, // ETAPA
  { wch: 10 }, // CÓDIGO
  { wch: 46 }, // DESCRIÇÃO
  { wch: 9 }, // UNIDADE
  { wch: 12 }, // QUANTIDADE
  { wch: 16 }, // PREÇO UNITÁRIO
];

// --- Aba 2: as regras, para quem for preencher ---
const instrucoes = [
  ["COMO PREENCHER ESTA PLANILHA"],
  [],
  ["O sistema lê a aba chamada “Orçamento”. Você escolhe a aba na importação,"],
  ["então o nome não é obrigatório — mas deixe os itens numa aba só."],
  [],
  ["AS COLUNAS"],
  [],
  ["Coluna", "Obrigatória?", "O que é"],
  ["ETAPA", "não", "A etapa do orçamento. Use um nome da lista da aba “Etapas”."],
  ["", "", "Em branco, o item entra em “Sem etapa” e você move depois."],
  ["CÓDIGO", "não", "Código SINAPI da composição, se houver. Serve de referência."],
  ["DESCRIÇÃO", "SIM", "O que é o serviço ou material. Linha sem descrição é ignorada."],
  ["UNIDADE", "SIM", "M2, M3, M, KG, UN, VB... Linha sem unidade é ignorada."],
  ["QUANTIDADE", "SIM", "Número. Aceita 1.234,56 ou 1234.56."],
  ["PREÇO UNITÁRIO", "SIM", "Número, só o valor unitário. O total o sistema calcula."],
  [],
  ["O cabeçalho pode estar em qualquer linha — o sistema procura. Pode ter"],
  ["logotipo, título e linhas em branco acima dele."],
  [],
  ["Os nomes das colunas podem variar. O sistema também reconhece:"],
  ["ETAPA", "", "ETAPAS, FASE, GRUPO, SERVIÇO/ETAPA"],
  ["CÓDIGO", "", "COD, CÓD, CODIGO SINAPI, REFERÊNCIA"],
  ["DESCRIÇÃO", "", "DESCRICAO, SERVIÇO, SERVICOS, ESPECIFICAÇÃO, ITEM"],
  ["UNIDADE", "", "UND, UN, UNID, MEDIDA"],
  ["QUANTIDADE", "", "QTD, QTDE, QUANT"],
  ["PREÇO UNITÁRIO", "", "PRECO UNITARIO, VALOR UNITÁRIO, P. UNIT, CUSTO UNITÁRIO"],
  [],
  ["O QUE O SISTEMA NÃO IMPORTA"],
  [],
  ["Linhas de subtotal e total — elas não têm unidade nem quantidade, então"],
  ["caem fora sozinhas. Mas confira a prévia antes de confirmar: tudo que for"],
  ["importado aparece numa lista, e você pode desmarcar linha por linha."],
  [],
  ["Colunas de total, BDI, peso, curva ABC: ignoradas. O sistema só usa as"],
  ["seis colunas acima."],
  [],
  ["DEPOIS DE IMPORTAR"],
  [],
  ["Os itens entram no RASCUNHO do orçamento. Nada vai para o cliente até"],
  ["você revisar e ativar a versão."],
];

const abaInstrucoes = utils.aoa_to_sheet(instrucoes);
abaInstrucoes["!cols"] = [{ wch: 18 }, { wch: 13 }, { wch: 72 }];

// --- Aba 3: a lista de etapas, para copiar ---
const abaEtapas = utils.aoa_to_sheet([
  ["ETAPAS DO ORÇAMENTO"],
  ["Copie o nome exatamente como está aqui, com o número."],
  [],
  ...ETAPAS.map((e) => [e]),
]);
abaEtapas["!cols"] = [{ wch: 40 }];

const livro = utils.book_new();
utils.book_append_sheet(livro, abaOrcamento, "Orçamento");
utils.book_append_sheet(livro, abaInstrucoes, "Como preencher");
utils.book_append_sheet(livro, abaEtapas, "Etapas");

const destino = "public/modelo-orcamento.xlsx";
writeFileSync(destino, write(livro, { type: "buffer", bookType: "xlsx" }));
console.log(
  `${destino} gerado: ${exemplos.length} linhas de exemplo, ${ETAPAS.length} etapas, 3 abas.`
);
