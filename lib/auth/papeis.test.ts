import { describe, expect, it } from "vitest";
import { destinoDoPerfil } from "./papeis";

describe("destinoDoPerfil", () => {
  it("engenheiro com obra padrão abre na visão geral dela", () => {
    expect(destinoDoPerfil("engenheiro", "abc")).toBe("/obras/abc");
  });

  /*
   * O caso que motivou a mudança: o Dashboard saiu do menu, e quem tem um
   * perfil só nunca é perguntado sobre obra padrão — então a entrada dele caía
   * numa tela sem nenhum caminho de volta.
   */
  it("sem obra padrão, cai na última obra aberta", () => {
    expect(destinoDoPerfil("engenheiro", null, "lembrada")).toBe("/obras/lembrada");
  });

  it("a obra padrão ganha da lembrada — é escolha explícita", () => {
    expect(destinoDoPerfil("engenheiro", "padrao", "lembrada")).toBe("/obras/padrao");
  });

  it("sem padrão e sem lembrada, vai escolher a obra — nunca ao Dashboard", () => {
    expect(destinoDoPerfil("engenheiro", null)).toBe("/selecionar-obra/visao-geral");
    expect(destinoDoPerfil("engenheiro", null, null)).toBe("/selecionar-obra/visao-geral");
  });

  /*
   * A obra padrão vale para os dois perfis: quem é cliente de uma obra só não
   * precisa passar pela lista "Minhas obras" para chegar nela.
   */
  it("cliente com obra padrão abre na obra, no portal", () => {
    expect(destinoDoPerfil("cliente", "abc")).toBe("/portal/obras/abc");
  });

  it("cliente sem obra padrão cai na lista de obras do portal", () => {
    expect(destinoDoPerfil("cliente", null)).toBe("/portal/dashboard");
  });

  /*
   * A obra lembrada é do lado do engenheiro e não atravessa para o portal: lá
   * a tela de lista já redireciona sozinha quando existe uma obra só, e com
   * mais de uma escolher é exatamente o que ela faz.
   */
  it("no portal, a obra lembrada do engenheiro não interfere", () => {
    expect(destinoDoPerfil("cliente", null, "lembrada")).toBe("/portal/dashboard");
  });
});
