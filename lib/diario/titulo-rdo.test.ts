import { describe, expect, it } from "vitest";
import { tituloDoRdo } from "./titulo-rdo";

describe("tituloDoRdo", () => {
  it("monta o padrão pedido, com ano de dois dígitos", () => {
    expect(tituloDoRdo("2026-11-10", "CASA VIDAL ALPHA")).toBe(
      "RDO 10.11.26 - CASA VIDAL ALPHA"
    );
  });

  it("preserva o zero à esquerda do dia e do mês", () => {
    expect(tituloDoRdo("2026-01-05", "OBRA X")).toBe("RDO 05.01.26 - OBRA X");
  });

  /*
   * O motivo de a função existir em vez de uma interpolação solta: `/` é
   * separador de caminho e cada navegador troca por um caractere diferente.
   * O nome do arquivo que a construtora arquiva precisa ser previsível.
   */
  it("não deixa escapar caractere proibido em nome de arquivo", () => {
    const titulo = tituloDoRdo("2026-11-10", 'CASA A/B: "ala" <norte>');
    expect(titulo).not.toMatch(/[\\/:*?"<>|]/);
    expect(titulo).toBe("RDO 10.11.26 - CASA A-B- -ala- -norte-");
  });

  it("remove caractere de controle, que quebra o cabeçalho do download", () => {
    expect(tituloDoRdo("2026-11-10", "OBRA\u0007X\nY")).toBe("RDO 10.11.26 - OBRAXY");
  });

  it("aceita timestamp e usa só a parte da data", () => {
    expect(tituloDoRdo("2026-11-10T03:00:00.000Z", "OBRA X")).toBe("RDO 10.11.26 - OBRA X");
  });

  it("não quebra com data inválida — ainda nomeia a obra", () => {
    expect(tituloDoRdo("", "OBRA X")).toBe("RDO - OBRA X");
  });

  it("obra sem nome utilizável não vira título vazio", () => {
    expect(tituloDoRdo("2026-11-10", "   ")).toBe("RDO 10.11.26 - obra");
  });
});
