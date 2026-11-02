import { describe, expect, it } from "vitest";
import { parseNumeroBR } from "./parse-numero-br";

/*
 * Esta função lê o que vem de planilha do engenheiro e de campo de moeda.
 *
 * Já custou um orçamento inteiro: a planilha trazia " R$20,000.00 " e "1.00", a
 * versão anterior devolvia null para os dois, e a importação descartava tudo
 * por "preço inválido" sem dizer o motivo. Os casos abaixo são os formatos que
 * de fato aparecem.
 */
describe("formato brasileiro", () => {
  it("lê milhar com ponto e decimal com vírgula", () => {
    expect(parseNumeroBR("1.234,56")).toBe(1234.56);
  });

  it("lê só decimal com vírgula", () => {
    expect(parseNumeroBR("317,78")).toBe(317.78);
  });

  it("lê valor grande com vários milhares", () => {
    expect(parseNumeroBR("1.234.567,89")).toBe(1234567.89);
  });
});

describe("formato americano, que a planilha às vezes traz", () => {
  it("lê milhar com vírgula e decimal com ponto", () => {
    expect(parseNumeroBR("1,234.56")).toBe(1234.56);
  });

  it('lê "1.00", que é o que o Excel devolve', () => {
    expect(parseNumeroBR("1.00")).toBe(1);
  });
});

describe("sujeira em volta do número", () => {
  it("ignora símbolo de moeda e espaço", () => {
    expect(parseNumeroBR(" R$20,000.00 ")).toBe(20000);
  });

  it("aceita número que já vem numérico", () => {
    expect(parseNumeroBR(144)).toBe(144);
  });

  it("aceita negativo", () => {
    expect(parseNumeroBR("-50,00")).toBe(-50);
  });
});

describe("o que NÃO é número devolve null, e não NaN", () => {
  it.each([["", "vazio"], ["   ", "só espaço"], ["abc", "texto"], ["R$", "só moeda"]])(
    "%s (%s)",
    (entrada) => {
      expect(parseNumeroBR(entrada)).toBeNull();
    }
  );

  it("null e undefined", () => {
    expect(parseNumeroBR(null)).toBeNull();
    expect(parseNumeroBR(undefined)).toBeNull();
  });

  it("Infinity não passa", () => {
    expect(parseNumeroBR(Infinity)).toBeNull();
    expect(parseNumeroBR(NaN)).toBeNull();
  });
});

/*
 * O valor que o campo de moeda manda para o servidor.
 *
 * `CampoMoeda` envia o texto FORMATADO ("1.234,56"), e `String(total)` de um
 * número JS manda "1234.5". As duas formas têm de dar o mesmo número — foi aqui
 * que eu suspeitei de um bug no lançamento e precisei conferir.
 */
describe("os dois jeitos que o formulário envia valor", () => {
  it("texto formatado pelo campo de moeda", () => {
    expect(parseNumeroBR("3.770,00")).toBe(3770);
  });

  it("número cru convertido para string", () => {
    expect(parseNumeroBR(String(1234.5))).toBe(1234.5);
  });

  it("os dois caminhos concordam", () => {
    const valor = 9550.4;
    expect(parseNumeroBR(String(valor))).toBe(valor);
    expect(parseNumeroBR(valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 }))).toBe(valor);
  });
});
