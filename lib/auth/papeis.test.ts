import { describe, expect, it } from "vitest";
import { destinoDoPerfil } from "./papeis";

describe("destinoDoPerfil", () => {
  it("engenheiro sem obra padrão cai no Dashboard", () => {
    expect(destinoDoPerfil("engenheiro", null)).toBe("/dashboard");
  });

  it("engenheiro com obra padrão abre na visão geral dela", () => {
    expect(destinoDoPerfil("engenheiro", "abc")).toBe("/obras/abc");
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
});
