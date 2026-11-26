import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ACOES_PERMISSAO, ehAcaoPermissao } from "./acoes-permissao";

/**
 * O risco que este teste existe para cobrir.
 *
 * O catálogo de permissões vive em dois lugares: a tabela `permissoes_catalogo`
 * (que a tela lê) e `ACOES_PERMISSAO` (que o compilador usa). Se alguém
 * acrescentar uma ação só num dos dois, nada quebra de imediato — e o sintoma é
 * cruel: administrador passa em qualquer ação, então quem testa sendo admin vê
 * tudo funcionando. Só um engenheiro comum encontra a parede, em produção.
 *
 * Por isso a comparação é com o ARQUIVO DA MIGRAÇÃO e não com o banco: assim
 * ela roda no CI, sem credencial e sem rede.
 */
function acoesDaMigracao(): string[] {
  const sql = readFileSync("supabase/migrations/0082_permissoes_por_usuario.sql", "utf8");

  const inicio = sql.indexOf("insert into permissoes_catalogo");
  expect(inicio, "o insert do catálogo mudou de forma — ajuste este teste").toBeGreaterThan(-1);
  const bloco = sql.slice(inicio, sql.indexOf("on conflict (acao)", inicio));

  // Cada linha do values abre com ('<acao>',
  return [...bloco.matchAll(/\(\s*'([a-z]+\.[a-z]+)'\s*,/g)].map((m) => m[1]);
}

describe("catálogo de permissões", () => {
  it("a migração e o TypeScript listam exatamente as mesmas ações", () => {
    expect([...acoesDaMigracao()].sort()).toEqual([...ACOES_PERMISSAO].sort());
  });

  it("não tem ação repetida", () => {
    expect(new Set(ACOES_PERMISSAO).size).toBe(ACOES_PERMISSAO.length);
  });

  /*
   * O formato `dominio.verbo` é o que agrupa a tela e o que torna a lista
   * legível de bater o olho. Uma ação fora do padrão passaria pelo compilador.
   */
  it("toda ação segue o padrão dominio.verbo", () => {
    for (const acao of ACOES_PERMISSAO) {
      expect(acao, `"${acao}" fora do padrão`).toMatch(/^[a-z]+\.[a-z]+$/);
    }
  });

  it("reconhece ação do catálogo e rejeita o que não está nele", () => {
    expect(ehAcaoPermissao("obra.excluir")).toBe(true);
    // O erro de digitação que o tipo existe para pegar.
    expect(ehAcaoPermissao("obra.exclir")).toBe(false);
    expect(ehAcaoPermissao("")).toBe(false);
  });
});
