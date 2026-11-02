import { describe, expect, it } from "vitest";
import { calcularCustoLocacao, somarMeses, totalLocacoes } from "./calculo";

/*
 * Esta função já errou em produção, e caro.
 *
 * A mensalidade multiplicava pela quantidade: dez andaimes a R$ 144 por mês
 * viravam R$ 1.440. Os contratos das duas obras somavam R$ 16.210 quando valem
 * R$ 9.550 — R$ 6.660 a mais, e esse número aparecia na previsão orçamentária
 * que o cliente lê. O erro foi de ENTENDIMENTO da regra, não de digitação, e é
 * exatamente o tipo que um teste congela para nunca voltar.
 */
const BASE = {
  quantidade: 1,
  valorUnitario: 100,
  dataInicio: "2026-01-10",
  horasUtilizadas: 0,
  dataDevolucao: null,
} as const;

describe("locação mensal", () => {
  it("o aluguel é do CONJUNTO: a quantidade não multiplica", () => {
    const dez = calcularCustoLocacao(
      {
        ...BASE,
        unidade: "mes",
        quantidade: 10,
        valorUnitario: 144,
        dataPrimeiroVencimento: "2026-01-10",
        mesesContratados: 1,
      },
      "2026-01-15"
    );
    // R$ 144 pelos dez andaimes, não 10 × 144.
    expect(dez.valor).toBe(144);
    expect(dez.valorContratado).toBe(144);
  });

  it("quantidade 1 dá o mesmo número — é por isso que a betoneira parecia certa", () => {
    const um = calcularCustoLocacao(
      {
        ...BASE,
        unidade: "mes",
        quantidade: 1,
        valorUnitario: 300,
        dataPrimeiroVencimento: "2026-01-10",
        mesesContratados: 1,
      },
      "2026-01-15"
    );
    expect(um.valor).toBe(300);
  });

  it("o contrato soma os meses combinados, mesmo sem terem corrido", () => {
    const seis = calcularCustoLocacao(
      {
        ...BASE,
        unidade: "mes",
        valorUnitario: 300,
        dataPrimeiroVencimento: "2026-01-10",
        mesesContratados: 6,
      },
      "2026-01-15"
    );
    expect(seis.valorContratado).toBe(1800);
    // Mas só UMA mensalidade correu: o contrato começou neste mês.
    expect(seis.valor).toBe(300);
  });

  it("acumula por mês do vencimento, não por dia corrido", () => {
    const tres = calcularCustoLocacao(
      {
        ...BASE,
        unidade: "mes",
        valorUnitario: 300,
        dataPrimeiroVencimento: "2026-01-10",
        mesesContratados: 6,
      },
      // Já estamos em março: janeiro, fevereiro e março venceram.
      "2026-03-02"
    );
    expect(tres.unidadesCobradas).toBe(3);
    expect(tres.valor).toBe(900);
  });

  it("sem data de vencimento não há mensalidade a cobrar", () => {
    const nada = calcularCustoLocacao(
      { ...BASE, unidade: "mes", valorUnitario: 300, dataPrimeiroVencimento: null },
      "2026-06-01"
    );
    expect(nada.valor).toBe(0);
  });
});

describe("locação por dia e por hora", () => {
  it("por dia, a quantidade MULTIPLICA — regra mantida a pedido", () => {
    const r = calcularCustoLocacao(
      { ...BASE, unidade: "dia", quantidade: 4, valorUnitario: 50 },
      "2026-01-12"
    );
    // 10, 11 e 12 de janeiro: três dias, inclusivo nas duas pontas.
    expect(r.dias).toBe(3);
    expect(r.valor).toBe(4 * 50 * 3);
  });

  it("por hora, cobra as horas informadas", () => {
    const r = calcularCustoLocacao(
      { ...BASE, unidade: "hora", quantidade: 2, valorUnitario: 30, horasUtilizadas: 5 },
      "2026-01-12"
    );
    expect(r.valor).toBe(2 * 30 * 5);
  });

  it("início no futuro não acumula nada", () => {
    const r = calcularCustoLocacao(
      { ...BASE, unidade: "dia", dataInicio: "2026-02-01", valorUnitario: 50 },
      "2026-01-15"
    );
    expect(r.dias).toBe(0);
    expect(r.valor).toBe(0);
  });

  it("devolvido para de contar na data da devolução", () => {
    const r = calcularCustoLocacao(
      { ...BASE, unidade: "dia", valorUnitario: 50, dataDevolucao: "2026-01-11" },
      "2026-06-01"
    );
    expect(r.emUso).toBe(false);
    expect(r.dias).toBe(2);
    expect(r.valor).toBe(100);
  });
});

/*
 * `somarMeses` existe para dar o MESMO resultado que o Postgres, porque as
 * parcelas da mensalidade são geradas lá. Divergir faria a tela dizer um número
 * de mensalidades e o financeiro cobrar outro.
 */
describe("somarMeses prende no último dia do mês curto", () => {
  it("31 de janeiro + 1 mês = 28 de fevereiro, não 3 de março", () => {
    expect(somarMeses("2026-01-31", 1)).toBe("2026-02-28");
  });

  it("respeita o ano bissexto", () => {
    // 2028 é bissexto.
    expect(somarMeses("2028-01-31", 1)).toBe("2028-02-29");
  });

  it("31 de março + 1 mês = 30 de abril", () => {
    expect(somarMeses("2026-03-31", 1)).toBe("2026-04-30");
  });

  it("atravessa o ano", () => {
    expect(somarMeses("2026-12-15", 2)).toBe("2027-02-15");
  });

  it("dia que existe nos dois meses não se move", () => {
    expect(somarMeses("2026-01-10", 1)).toBe("2026-02-10");
  });
});

describe("totalLocacoes", () => {
  it("lista vazia soma zero e não conta nada", () => {
    expect(totalLocacoes([], "2026-01-15")).toEqual({ total: 0, emUso: 0, devolvidas: 0 });
  });

  it("separa o que está em uso do que foi devolvido", () => {
    const r = totalLocacoes(
      [
        { ...BASE, unidade: "dia", valorUnitario: 50 },
        { ...BASE, unidade: "dia", valorUnitario: 50, dataDevolucao: "2026-01-11" },
      ],
      "2026-01-12"
    );
    expect(r.emUso).toBe(1);
    expect(r.devolvidas).toBe(1);
    // 3 dias em uso + 2 dias devolvido, a R$ 50
    expect(r.total).toBe(50 * 3 + 50 * 2);
  });
});
