/**
 * O nome do arquivo quando o RDO vira PDF: `RDO DD.MM.AA - NOME DA OBRA`.
 *
 * O PDF sai da impressão do navegador, e o navegador usa o `document.title`
 * como nome sugerido do arquivo. Então o título da página É o nome do arquivo —
 * não há outro lugar para definir isso sem gerar o PDF no servidor.
 *
 * PONTO NO LUGAR DA BARRA, e isto não é preferência: `/` é separador de
 * caminho e não pode existir num nome de arquivo em sistema nenhum. Pedido
 * como "DD/MM/AA", sairia com o navegador trocando a barra por conta própria —
 * o Chrome usa `_`, e o resultado seria `RDO 10_11_26`. O ponto é o separador
 * de data mais próximo que sobrevive, e mantém a leitura brasileira.
 *
 * Ano com dois dígitos, como pedido. RDO é documento do dia e vive junto dos
 * outros do mesmo período; o século nunca é a dúvida.
 */
export function tituloDoRdo(dataIso: string, obraNome: string): string {
  const [ano = "", mes = "", dia = ""] = dataIso.slice(0, 10).split("-");
  const data = dia && mes && ano ? `${dia}.${mes}.${ano.slice(2)} ` : "";
  return `RDO ${data}- ${nomeSeguro(obraNome)}`.replace(/\s+/g, " ").trim();
}

/**
 * Tira do nome da obra o que nome de arquivo não aceita.
 *
 * O navegador já faz a sua própria limpeza, mas cada um faz de um jeito — e o
 * resultado deixaria de ser previsível justamente no nome que a construtora
 * usa para arquivar. Uma obra chamada "CASA A/B" viraria "CASA A_B" no Chrome
 * e outra coisa no Safari.
 */
function nomeSeguro(nome: string): string {
  return (
    nome
      // Os proibidos no Windows, que é o conjunto mais restritivo: \ / : * ? " < > |
      .replace(/[\\/:*?"<>|]/g, "-")
      // Caracteres de controle não aparecem, mas quebram o cabeçalho do download.
      .replace(/\p{Cc}/gu, "")
      .trim() || "obra"
  );
}
