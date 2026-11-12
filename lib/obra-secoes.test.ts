import { describe, expect, it } from "vitest";
import { entradasDaObra, SECOES_OBRA, type SecaoObra } from "./obra-secoes";

type Grupo = { label: string; items: { label: string }[] };
const ehGrupo = (e: unknown): e is Grupo =>
  typeof e === "object" && e !== null && "items" in e;

const secao = (slug: string, grupo?: SecaoObra["grupo"]): SecaoObra => ({
  slug,
  segmento: slug,
  label: slug.toUpperCase(),
  icone: "obras",
  ...(grupo ? { grupo } : {}),
});

describe("entradasDaObra", () => {
  it("não perde nenhuma seção ao dobrar os grupos", () => {
    const entradas = entradasDaObra();
    const rotulos = entradas.flatMap((e) => (ehGrupo(e) ? e.items.map((i) => i.label) : [(e as { label: string }).label]));
    const soltos = entradas.filter((e) => !ehGrupo(e)).length;
    const agrupados = entradas.filter(ehGrupo).reduce((n, g) => n + g.items.length, 0);

    expect(soltos + agrupados).toBe(SECOES_OBRA.length);
    // Toda seção aparece, dentro ou fora de cartão.
    for (const s of SECOES_OBRA) expect(rotulos).toContain(s.label);
  });

  it("junta Folgas, Presenças e Fechamentos num cartão RH", () => {
    const rh = entradasDaObra().filter(ehGrupo).find((g) => g.label === "RH");
    expect(rh).toBeDefined();
    expect(rh!.items.map((i) => i.label)).toEqual(["Folgas", "Presenças", "Fechamentos"]);
  });

  it("deixa fora do cartão quem não tem grupo", () => {
    const entradas = entradasDaObra();
    const soltos = entradas.filter((e) => !ehGrupo(e)).map((e) => (e as { label: string }).label);
    expect(soltos).toContain("Visão geral");
    expect(soltos).toContain("Cotações");
    expect(soltos).not.toContain("Folgas");
  });

  /*
   * O laço anda o índice para dentro do grupo e volta um passo para o `for`
   * continuar. Errar esse passo engole a seção seguinte em silêncio — o grupo
   * no fim da lista é o caso em que isso não daria erro nenhum, só uma seção
   * a menos no menu.
   */
  it("mantém a seção que vem DEPOIS de um grupo", () => {
    const entradas = entradasDaObra([
      secao("a"),
      secao("b", "rh"),
      secao("c", "rh"),
      secao("d"),
    ]);
    expect(entradas).toHaveLength(3);
    expect(ehGrupo(entradas[1])).toBe(true);
    expect((entradas[2] as { label: string }).label).toBe("D");
  });

  it("aceita grupo no fim da lista", () => {
    const entradas = entradasDaObra([secao("a"), secao("b", "rh")]);
    expect(entradas).toHaveLength(2);
    expect((entradas[1] as Grupo).items.map((i) => i.label)).toEqual(["B"]);
  });

  it("o cartão nasce na posição da primeira seção do grupo", () => {
    const entradas = entradasDaObra([secao("x", "rh"), secao("y")]);
    expect((entradas[0] as Grupo).label).toBe("RH");
  });

  it("carrega o prefixo do portal para os itens, quando pedido", () => {
    const [primeiro] = entradasDaObra([secao("a")], "/portal/obras");
    expect(primeiro).toMatchObject({
      obraSecao: { slug: "a", segmento: "a", prefixo: "/portal/obras" },
    });
  });

  it("sem prefixo, não grava a chave — o engenheiro usa o padrão /obras", () => {
    const [primeiro] = entradasDaObra([secao("a")]);
    expect((primeiro as { obraSecao: Record<string, unknown> }).obraSecao).not.toHaveProperty(
      "prefixo"
    );
  });
});
