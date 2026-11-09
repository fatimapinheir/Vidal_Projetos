import { describe, expect, it } from "vitest";
import { diaDoInstante, hojeNoFuso, horaNoFuso } from "./fuso";

describe("diaDoInstante", () => {
  /*
   * O caso que motivou a função: 21h30 em Fortaleza já é o dia seguinte em UTC,
   * e o banco grava em UTC. Cortar a string crua mostraria quarta-feira numa
   * decisão tomada na terça.
   */
  it("devolve o dia do canteiro, não o de UTC", () => {
    expect(diaDoInstante("2026-11-11T00:30:00+00:00")).toBe("2026-11-10");
    expect(diaDoInstante("2026-11-11T02:59:00Z")).toBe("2026-11-10");
    expect(diaDoInstante("2026-11-11T03:00:00Z")).toBe("2026-11-11");
  });

  it("não desloca o que já está no meio do dia", () => {
    expect(diaDoInstante("2026-11-11T15:00:00Z")).toBe("2026-11-11");
  });

  it("devolve null em vez de data inválida", () => {
    expect(diaDoInstante(null)).toBeNull();
    expect(diaDoInstante(undefined)).toBeNull();
    expect(diaDoInstante("")).toBeNull();
    expect(diaDoInstante("nem data")).toBeNull();
  });
});

describe("hojeNoFuso e horaNoFuso", () => {
  it("usam o fuso da obra, e não o relógio da máquina", () => {
    // 01h00 UTC = 22h do dia anterior em São Paulo.
    const instante = new Date("2026-03-15T01:00:00Z");
    expect(hojeNoFuso(instante)).toBe("2026-03-14");
    expect(horaNoFuso(instante)).toBe(22);
  });
});
