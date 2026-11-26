/**
 * As ações cobertas pelo catálogo de permissões (migração 0082).
 *
 * Mora num arquivo só de dados, sem `server-only` e sem import de Supabase, por
 * duas razões: a tela de gerenciamento roda no cliente e precisa da lista, e o
 * teste de sincronia precisa importá-la sem subir meio servidor.
 *
 * O rótulo e a descrição de cada ação NÃO estão aqui — eles vivem em
 * `permissoes_catalogo`, no banco, que é quem a tela lê. Aqui fica só o
 * identificador, que é o que o compilador precisa para proteger as chamadas.
 */
export const ACOES_PERMISSAO = [
  "obra.criar",
  "obra.excluir",
  "orcamento.ativar",
  "cotacao.decidir",
  "cotacao.excluir",
  "compra.aprovar",
  "compra.pagar",
  "pagamento.sem_comprovante",
  "compra.excluir",
  "fechamento.pagar",
  "diario.reabrir",
  "diario.excluir",
  "cliente.gerenciar",
  "sinapi.publicar",
] as const;

/**
 * União de literais, e não `string`, por um motivo que não é estético: um erro
 * de digitação em `pode("obra.exclir")` devolveria `false` — e seria INVISÍVEL
 * para quem administra, porque administrador passa em qualquer ação, existente
 * ou não. Quem testasse a tela sendo admin veria tudo funcionando, e só o
 * Ardiles bateria na parede.
 */
export type AcaoPermissao = (typeof ACOES_PERMISSAO)[number];

export function ehAcaoPermissao(valor: string): valor is AcaoPermissao {
  return (ACOES_PERMISSAO as readonly string[]).includes(valor);
}
