import type { NavItem } from "./app-shell";

/**
 * Extrai o id da obra da URL, nos dois lados do sistema.
 *
 * O engenheiro navega em `/obras/<id>/...` e o cliente em
 * `/portal/obras/<id>/...`. Reconhecer só o primeiro deixava o menu do portal
 * sem saber em que obra o cliente está.
 */
export function obraDoCaminho(pathname: string): string | null {
  return pathname.match(/^(?:\/portal)?\/obras\/([0-9a-f-]{36})(?:\/|$)/i)?.[1] ?? null;
}

/**
 * Destino final de um item do menu.
 *
 * Itens de seção da obra não têm href fixo: dependem de qual obra está em
 * foco. A obra da URL vence a lembrada no cookie — e isso não é detalhe. O
 * cookie é escrito pelo navegador depois que a página monta, então ao abrir
 * uma obra diferente da anterior o servidor ainda renderiza com a antiga. Sem
 * essa precedência, o menu apontaria para a obra errada justamente na tela em
 * que você acabou de entrar.
 *
 * Sem obra nenhuma, o item cai na tela de escolha em vez de ficar morto.
 */
export function resolverHref(item: NavItem, obraEmFoco: string | null): string {
  if (!item.obraSecao) return item.href ?? "#";
  const { slug, segmento, prefixo = "/obras" } = item.obraSecao;

  // No portal não existe tela de escolha de obra: sem obra em foco, o item
  // leva à lista "Minhas obras", que é de onde o cliente escolhe.
  if (!obraEmFoco) {
    return prefixo === "/obras" ? `/selecionar-obra/${slug}` : "/portal/dashboard";
  }

  return segmento ? `${prefixo}/${obraEmFoco}/${segmento}` : `${prefixo}/${obraEmFoco}`;
}
