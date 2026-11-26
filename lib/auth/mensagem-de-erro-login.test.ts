import { describe, expect, it } from "vitest";
import { mensagemDeErroLogin } from "./mensagem-de-erro-login";

describe("mensagemDeErroLogin", () => {
  it("explica o link gasto quando o Supabase diz que expirou", () => {
    const texto = mensagemDeErroLogin("Email link is invalid or has expired");
    expect(texto).toContain("uso único");
    expect(texto).toContain("Peça um novo");
  });

  /*
   * O código vem do nosso próprio redirect em `app/auth/confirm/route.ts`,
   * não do Supabase — por isso é comparado exato, e não por substring.
   */
  it("reconhece o código que o nosso confirm devolve", () => {
    expect(mensagemDeErroLogin("link_invalido")).toContain("uso único");
    expect(mensagemDeErroLogin("link_incompleto")).toContain("veio incompleto");
  });

  it("não se importa com a caixa da mensagem do Supabase", () => {
    expect(mensagemDeErroLogin("TOKEN HAS EXPIRED")).toContain("uso único");
  });

  /*
   * Mensagem desconhecida passa inteira: é melhor mostrar o texto cru do
   * Supabase do que engolir o erro e deixar a pessoa sem pista nenhuma.
   */
  it("repassa mensagem que não sabe traduzir", () => {
    expect(mensagemDeErroLogin("Senha muito curta")).toBe("Senha muito curta");
  });
});
