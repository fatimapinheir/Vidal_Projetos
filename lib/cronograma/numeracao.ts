/**
 * O número da tarefa — "3.4" — é mantido pelo sistema, não digitado.
 *
 * Ele vive DENTRO do nome, e isso é escolha consciente, não descuido. A
 * alternativa era calcular o número pela posição na hora de desenhar, o que é
 * estruturalmente mais correto — mas o diário e o RDO CONGELAM o nome da tarefa
 * num snapshot quando o dia é fechado. Número calculado não entra em snapshot:
 * os relatórios que o cliente recebe passariam a dizer "Concretagem da laje" em
 * vez de "3.8 Concretagem da laje".
 *
 * Mantê-lo no texto faz o número viajar de graça para todo lugar que mostra o
 * nome — oito telas, mais os documentos congelados. O preço é este arquivo:
 * alguém precisa reescrever o prefixo sempre que a posição muda.
 *
 * Quem faz isso é `reordenarEtapaPorData`, que já roda depois de criar, editar
 * e apagar tarefa. Apagar a 3.3 move a 3.4 para a terceira posição, e ela vira
 * 3.3 no mesmo passo.
 */

/**
 * Tira o prefixo numérico, se houver. "4.1 Marcação" vira "Marcação".
 *
 * Exige ao menos um ponto: "2 camadas de impermeabilização" não é numeração e
 * continua inteira. Aceita mais de um nível ("4.1.2 Sub") porque nomes vindos
 * de planilha às vezes trazem.
 */
export function semNumero(nome: string): string {
  return nome.replace(/^\s*\d+(?:\.\d+)+\s+/, "").trim();
}

/**
 * O nome com o número certo na frente, dado onde a tarefa está.
 *
 * `posicao` é 1 para a primeira tarefa da etapa. O prefixo antigo sai antes —
 * senão editar duas vezes empilharia "4.1 4.1 Marcação".
 */
export function comNumero(nome: string, etapaOrdem: number, posicao: number): string {
  return `${etapaOrdem}.${posicao} ${semNumero(nome)}`.trim();
}

/** O número sozinho, para quando a tela precisa dele separado do texto. */
export function numeroDaTarefa(nome: string): string | null {
  const achado = nome.match(/^\s*(\d+(?:\.\d+)+)\s+/);
  return achado ? achado[1] : null;
}
