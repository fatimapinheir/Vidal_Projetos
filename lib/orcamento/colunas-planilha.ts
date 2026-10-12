/**
 * Reconhecimento das colunas de uma planilha de orçamento.
 *
 * Existe porque mapear coluna à mão é onde a importação morria: o engenheiro
 * seleciona o arquivo, não entende por que a prévia está vazia, e desiste. Com
 * os apelidos abaixo, uma planilha que use qualquer nome usual de coluna é
 * reconhecida sozinha — e o mapeamento manual continua lá para o resto.
 *
 * Os apelidos são os mesmos documentados na aba "Como preencher" de
 * `public/modelo-orcamento.xlsx` (gerado por scripts/gerar-modelo-orcamento.mjs).
 * Mexendo aqui, gere o modelo de novo.
 */

export type CampoPlanilha =
  | "etapa"
  | "codigo_sinapi"
  | "descricao"
  | "unidade"
  | "quantidade"
  | "preco_unitario";

/**
 * Compara nome de coluna ignorando acento, caixa, pontuação e espaço.
 *
 * Planilha real escreve "P. UNIT.", "PREÇO UNITÁRIO", "Preco Unitario" e
 * "VALOR_UNITARIO" para a mesma coisa. Sem normalizar, cada variação viraria um
 * apelido novo e a lista nunca fecharia.
 */
export function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

/**
 * Apelidos por campo, do mais específico para o mais genérico.
 *
 * Ordem importa: "VALORUNITARIO" tem de ser testado antes de "VALOR", senão uma
 * coluna "VALOR TOTAL" seria tomada por preço unitário — e o orçamento entraria
 * com o total no lugar do unitário, errando tudo por um fator igual à
 * quantidade.
 */
const APELIDOS: Record<CampoPlanilha, string[]> = {
  etapa: ["ETAPA", "ETAPAS", "SERVICOETAPA", "FASE", "GRUPO", "SUBGRUPO"],
  codigo_sinapi: [
    "CODIGOSINAPI",
    "CODSINAPI",
    "CODIGO",
    "COD",
    "REFERENCIA",
    "REF",
    "CODIGOREFERENCIA",
  ],
  /*
   * "ITEM" NÃO entra aqui.
   *
   * Em planilha de orçamento brasileira "ITEM" é quase sempre a coluna de
   * numeração ("1", "1.1", "1.2"), e ela vem à esquerda da descrição. Como a
   * primeira coluna reconhecida ganha o campo, "ITEM" roubava o lugar e o
   * orçamento era importado com "1.1" no nome de cada item — conferido na
   * planilha real do engenheiro, cujo cabeçalho é
   * "ITEM | DESCRIÇÃO DOS SERVIÇOS | unID. | QUANT. | ...".
   */
  descricao: [
    "DESCRICAO",
    "DESCRICAODOSERVICO",
    "DESCRICAODOSSERVICOS",
    "ESPECIFICACAO",
    "SERVICO",
    "SERVICOS",
    "DISCRIMINACAO",
  ],
  unidade: ["UNIDADE", "UNID", "UND", "UN", "MEDIDA", "UNIDADEMEDIDA"],
  quantidade: ["QUANTIDADE", "QTDE", "QTD", "QUANT", "QUANTITATIVO"],
  preco_unitario: [
    "PRECOUNITARIO",
    "VALORUNITARIO",
    "CUSTOUNITARIO",
    "PUNIT",
    "PRECOUNIT",
    "VALORUNIT",
    "UNITARIO",
    "PRECO",
    "VALOR",
    "CUSTO",
  ],
};

/** Quantos apelidos de campos distintos uma linha precisa casar para ser cabeçalho. */
const MINIMO_PARA_CABECALHO = 3;

function campoDaColuna(nomeColuna: string): CampoPlanilha | null {
  const alvo = normalizar(nomeColuna);
  if (!alvo) return null;

  // Igualdade antes de prefixo: "UN" casaria dentro de "UNITARIO" por prefixo,
  // e a unidade roubaria a coluna de preço.
  for (const [campo, apelidos] of Object.entries(APELIDOS) as [CampoPlanilha, string[]][]) {
    if (apelidos.includes(alvo)) return campo;
  }
  for (const [campo, apelidos] of Object.entries(APELIDOS) as [CampoPlanilha, string[]][]) {
    if (apelidos.some((apelido) => alvo.startsWith(apelido))) return campo;
  }
  return null;
}

/**
 * Mapeia os nomes de uma linha de cabeçalho para os campos do sistema.
 *
 * Primeira coluna ganha o campo: planilha de orçamento costuma ter mais de uma
 * coluna de valor ("PREÇO UNITÁRIO" e "VALOR TOTAL"), e a da esquerda é a
 * unitária na esmagadora maioria.
 */
export function detectarColunas(cabecalho: string[]): Partial<Record<CampoPlanilha, number>> {
  const mapa: Partial<Record<CampoPlanilha, number>> = {};
  cabecalho.forEach((nome, indice) => {
    const campo = campoDaColuna(nome);
    if (campo && mapa[campo] === undefined) mapa[campo] = indice;
  });
  return mapa;
}

/**
 * Acha a linha de cabeçalho: a que reconhece mais colunas.
 *
 * Procura em vez de assumir a primeira linha porque planilha de obra real tem
 * logotipo, nome do cliente e linhas em branco antes da tabela — e o
 * importador antigo obrigava a apontar a linha na mão, numa lista que só
 * mostrava as 20 primeiras.
 */
export function detectarCabecalho(
  linhas: string[][],
  limite = 60
): { linha: number; colunas: Partial<Record<CampoPlanilha, number>> } | null {
  type Candidata = {
    linha: number;
    colunas: Partial<Record<CampoPlanilha, number>>;
    acertos: number;
  };

  const candidatas: Candidata[] = linhas
    .slice(0, limite)
    .map((linha, indice) => {
      const colunas = detectarColunas(linha);
      return { linha: indice, colunas, acertos: Object.keys(colunas).length };
    })
    .filter((c) => c.acertos >= MINIMO_PARA_CABECALHO);

  if (!candidatas.length) return null;

  // Empate fica com a primeira: o cabeçalho de verdade vem antes de qualquer
  // repetição dele no meio da planilha.
  const melhor = candidatas.reduce((a, b) => (b.acertos > a.acertos ? b : a));
  return { linha: melhor.linha, colunas: melhor.colunas };
}

/* -------------------------------------------------------------------------- *
 * Etapa vinda da estrutura da planilha
 * -------------------------------------------------------------------------- */

/** Numeração de item: "1", "1.1", "2.10.3". */
const PADRAO_NUMERACAO = /^\d+(\.\d+)*\.?$/;

/** Linha de soma, que parece cabeçalho de etapa mas não é. */
const PADRAO_TOTAL = /^(TOTAL|SUBTOTAL|SOMA|TOTALGERAL|TOTALDAETAPA|ACUMULADO)/;

/**
 * Acha a coluna de numeração ("ITEM", "1.1", "1.2"...).
 *
 * Por conteúdo e não por nome do cabeçalho: ela se chama "ITEM", "Nº", "COD",
 * ou nada, e o nome não é confiável. O que não varia é o formato dos valores.
 */
export function detectarColunaNumeracao(
  linhas: string[][],
  primeiraLinhaDados: number
): number | null {
  const amostra = linhas.slice(primeiraLinhaDados, primeiraLinhaDados + 60);
  if (!amostra.length) return null;

  const largura = Math.max(...amostra.map((l) => l.length), 0);
  let melhor: { coluna: number; acertos: number } | null = null;

  for (let coluna = 0; coluna < largura; coluna++) {
    const acertos = amostra.filter((linha) =>
      PADRAO_NUMERACAO.test((linha[coluna] ?? "").trim())
    ).length;
    if (acertos >= 3 && (!melhor || acertos > melhor.acertos)) melhor = { coluna, acertos };
  }

  return melhor?.coluna ?? null;
}

/**
 * Casa o nome vindo da planilha com a etapa oficial, para o orçamento importado
 * cair na mesma lista dos templates.
 *
 * Compara sem número, acento nem caixa: "SERVIÇOS PRELIMINARES" na planilha
 * encontra "01. SERVIÇOS PRELIMINARES" na lista. Sem isso, cada planilha
 * importada criaria etapas paralelas às oficiais, com nome quase igual — que é
 * exatamente a confusão que a unificação das listas acabou de resolver.
 */
export function casarEtapaOficial(nome: string, oficiais: readonly string[]): string | null {
  const semNumero = (texto: string) => normalizar(texto.replace(/^\s*\d+(\.\d+)*\.?\s*/, ""));
  const alvo = semNumero(nome);
  if (!alvo) return null;
  return oficiais.find((oficial) => semNumero(oficial) === alvo) ?? null;
}

export type LinhaClassificada =
  | { tipo: "item"; etapa: string | null }
  | { tipo: "etapa"; nome: string }
  | { tipo: "ignorar" };

/**
 * Deduz a etapa de cada linha pela estrutura da planilha.
 *
 * A assinatura do cabeçalho de etapa é **descrição preenchida e nenhum valor**:
 * sem unidade, sem quantidade e sem preço unitário. Cobre os dois jeitos que
 * aparecem na prática — a linha de etapa sem numeração alguma, e a numerada no
 * primeiro nível ("1", "2") como na planilha do engenheiro, onde os itens vêm
 * como "1.1", "1.2".
 *
 * Não depende da numeração de propósito: ela existe em algumas planilhas e não
 * em outras, e quando existe serve só para montar o nome ("1" + "SERVIÇOS
 * PRELIMINARES" → "01. SERVIÇOS PRELIMINARES").
 *
 * Linha de total é descartada: tem descrição e nenhum valor nas colunas
 * mapeadas, então passaria por etapa.
 */
export function classificarLinhas({
  linhas,
  cabecalho,
  colunas,
  colunaNumeracao,
  etapasOficiais = [],
}: {
  linhas: string[][];
  cabecalho: number;
  colunas: Partial<Record<CampoPlanilha, number>>;
  colunaNumeracao: number | null;
  etapasOficiais?: readonly string[];
}): Map<number, LinhaClassificada> {
  const resultado = new Map<number, LinhaClassificada>();
  let etapaAtual: string | null = null;

  const celula = (linha: string[], indice?: number) =>
    indice === undefined ? "" : (linha[indice] ?? "").trim();

  for (let i = cabecalho + 1; i < linhas.length; i++) {
    const linha = linhas[i] ?? [];
    const descricao = celula(linha, colunas.descricao);

    if (!descricao) {
      resultado.set(i, { tipo: "ignorar" });
      continue;
    }

    const temValor =
      !!celula(linha, colunas.unidade) ||
      !!celula(linha, colunas.quantidade) ||
      !!celula(linha, colunas.preco_unitario);

    if (temValor) {
      resultado.set(i, { tipo: "item", etapa: etapaAtual });
      continue;
    }

    if (PADRAO_TOTAL.test(normalizar(descricao))) {
      resultado.set(i, { tipo: "ignorar" });
      continue;
    }

    // Cabeçalho de etapa. O número, quando existe, entra no nome com dois
    // dígitos — é ele que ordena a etapa na tela.
    const numeracao = celula(linha, colunaNumeracao ?? undefined);
    const nivel1 = PADRAO_NUMERACAO.test(numeracao) ? numeracao.replace(/\.$/, "") : "";
    const soNivel1 = nivel1 && !nivel1.includes(".");

    const comNumero = soNivel1
      ? `${nivel1.padStart(2, "0")}. ${descricao}`
      : descricao;

    const oficial = casarEtapaOficial(descricao, etapasOficiais);
    etapaAtual = oficial ?? comNumero;
    resultado.set(i, { tipo: "etapa", nome: etapaAtual });
  }

  return resultado;
}
