import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ACOES_PERMISSAO, type AcaoPermissao } from "@/lib/auth/acoes-permissao";

/**
 * O risco que este arquivo existe para cobrir.
 *
 * A tela de permissões mostra treze chaves. Se uma delas não estiver ligada a
 * nenhuma ação de servidor, ela MENTE: quem administra desliga a chave,
 * acredita ter tirado o poder, e a ação continua acontecendo. É pior do que
 * não ter a chave, porque passa confiança falsa.
 *
 * O inverso também é risco: alguém acrescenta uma ação destrutiva nova em
 * `app/actions/` e esquece o portão. Nada quebra, nenhum teste reclama, e a
 * permissão simplesmente não cobre o caso novo — enquanto a tela continua
 * parecendo completa.
 *
 * Os dois são verificados aqui por leitura dos arquivos, sem banco e sem rede,
 * para rodar no CI junto com o resto.
 */

const DIR = "app/actions";

function fonteDasAcoes(): string {
  return readdirSync(DIR)
    .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
    .map((f) => readFileSync(`${DIR}/${f}`, "utf8"))
    .join("\n");
}

/** O corpo de uma função exportada, até a próxima declaração exportada. */
function corpoDaFuncao(arquivo: string, nome: string): string {
  const fonte = readFileSync(`${DIR}/${arquivo}`, "utf8");
  const inicio = fonte.indexOf(`export async function ${nome}(`);
  expect(inicio, `${nome} não existe em ${arquivo} — foi renomeada?`).toBeGreaterThan(-1);
  const resto = fonte.slice(inicio + 10);
  const fim = resto.indexOf("\nexport ");
  return fim === -1 ? resto : resto.slice(0, fim);
}

/**
 * As ações sensíveis e a permissão que cada uma exige.
 *
 * Esta tabela é o contrato. Quem remover um portão numa refatoração quebra
 * aqui, com o nome da função na mensagem — em vez de descobrir em produção que
 * a chave da tela parou de ter efeito.
 */
/**
 * `portao`   — `exigirPermissao`: sem a permissão a ação não acontece.
 * `condicao` — `pode`: a ação acontece de qualquer forma, e a permissão muda
 *              uma REGRA dentro dela. É o caso de `pagamento.sem_comprovante`,
 *              que não libera pagar — libera pagar sem anexo.
 */
type Forma = "portao" | "condicao";

const FIACAO: [arquivo: string, funcao: string, acao: AcaoPermissao, forma: Forma][] = [
  ["obras.ts", "createObra", "obra.criar", "portao"],
  ["obras.ts", "excluirObra", "obra.excluir", "portao"],
  ["orcamento.ts", "ativarOrcamento", "orcamento.ativar", "portao"],
  ["cotacoes.ts", "escolherPropostaAction", "cotacao.decidir", "portao"],
  ["cotacoes.ts", "recusarCotacaoAction", "cotacao.decidir", "portao"],
  ["cotacoes.ts", "excluirCotacao", "cotacao.excluir", "portao"],
  ["cotacoes.ts", "excluirProposta", "cotacao.excluir", "portao"],
  ["compras.ts", "aprovarCompraAction", "compra.aprovar", "portao"],
  ["compras.ts", "recusarCompraAction", "compra.aprovar", "portao"],
  ["compras.ts", "marcarPagamentoEnviado", "compra.pagar", "portao"],
  ["compras.ts", "pagarParcelaAction", "compra.pagar", "portao"],
  ["compras.ts", "pagarCompraAgoraAction", "compra.pagar", "portao"],
  ["compras.ts", "excluirCompra", "compra.excluir", "portao"],
  ["fechamentos.ts", "marcarFechamentoPago", "fechamento.pagar", "portao"],
  ["fechamentos.ts", "marcarFechamentoEquipePago", "fechamento.pagar", "portao"],
  ["fechamentos.ts", "marcarFechamentoEntregaPago", "fechamento.pagar", "portao"],
  ["diario.ts", "reabrirDia", "diario.reabrir", "portao"],
  ["diario.ts", "removerDiario", "diario.excluir", "portao"],
  ["obra-clientes.ts", "vincularCliente", "cliente.gerenciar", "portao"],
  ["obra-clientes.ts", "desvincularCliente", "cliente.gerenciar", "portao"],
  ["obra-clientes.ts", "criarClienteParaObra", "cliente.gerenciar", "portao"],
  ["sinapi.ts", "ativarNovaTabelaSinapi", "sinapi.publicar", "portao"],

  // Afrouxam uma regra em vez de barrar a ação — ver `Forma`.
  ["lancamentos.ts", "criarLancamento", "pagamento.sem_comprovante", "condicao"],
  ["compras.ts", "pagarParcelaAction", "pagamento.sem_comprovante", "condicao"],
  ["compras.ts", "pagarCompraAgoraAction", "pagamento.sem_comprovante", "condicao"],
];

describe("fiação das permissões", () => {
  it.each(FIACAO)("%s · %s consulta %s (%s)", (arquivo, funcao, acao, forma) => {
    const corpo = corpoDaFuncao(arquivo, funcao);
    const esperado = forma === "portao" ? /exigirPermissao(SeEngenheiro)?\(/ : /\bpode\(/;
    expect(corpo, `${funcao} não consulta a permissão`).toMatch(esperado);
    expect(corpo, `${funcao} consulta outra ação`).toContain(`"${acao}"`);
  });

  /*
   * O teste que fecha o buraco da tela mentirosa: toda chave mostrada precisa
   * gatear ALGO. Uma permissão órfã no catálogo é uma chave que não faz nada.
   */
  it("nenhuma permissão do catálogo fica órfã", () => {
    const fonte = fonteDasAcoes();
    const orfas = ACOES_PERMISSAO.filter((acao) => !fonte.includes(`"${acao}"`));
    expect(orfas, `permissões na tela que não gateiam nada: ${orfas.join(", ")}`).toEqual([]);
  });

  /*
   * E o inverso: nenhum portão aponta para ação fora do catálogo. O tipo já
   * impede no código novo, mas um `as AcaoPermissao` ou um JSON escaparia.
   */
  it("nenhum portão usa ação fora do catálogo", () => {
    const fonte = fonteDasAcoes();
    const usadas = [
      ...fonte.matchAll(/(?:exigirPermissao(?:SeEngenheiro)?|pode)\(\s*"([^"]+)"/g),
    ].map((m) => m[1]);
    const forasteiras = usadas.filter((a) => !(ACOES_PERMISSAO as readonly string[]).includes(a));
    expect([...new Set(forasteiras)]).toEqual([]);
  });

  it("a tabela de fiação cobre todas as permissões do catálogo", () => {
    const cobertas = new Set(FIACAO.map(([, , acao]) => acao));
    expect([...cobertas].sort()).toEqual([...ACOES_PERMISSAO].sort());
  });
});
