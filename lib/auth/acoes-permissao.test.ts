import { readFileSync, readdirSync } from "node:fs";
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
/**
 * Varre TODAS as migrações, não uma só.
 *
 * A primeira versão deste teste lia apenas a 0082, que criou o catálogo. Na
 * 0083 entrou `pagamento.sem_comprovante` e o teste falhou acusando deriva
 * que não existia — ele mesmo estava desatualizado. Lendo o diretório, uma
 * permissão nova é encontrada onde quer que tenha sido inserida.
 */
function acoesDasMigracoes(): string[] {
  const dir = "supabase/migrations";
  const acoes: string[] = [];

  for (const arquivo of readdirSync(dir).filter((f) => f.endsWith(".sql"))) {
    const sql = readFileSync(`${dir}/${arquivo}`, "utf8");
    let de = sql.indexOf("insert into permissoes_catalogo");

    while (de !== -1) {
      const fim = sql.indexOf("on conflict", de);
      expect(fim, `insert sem "on conflict" em ${arquivo} — ajuste este teste`).toBeGreaterThan(de);
      // Cada linha do values abre com ('<acao>',
      const bloco = sql.slice(de, fim);
      acoes.push(...[...bloco.matchAll(/\(\s*'([a-z]+\.[a-z_]+)'\s*,/g)].map((m) => m[1]));
      de = sql.indexOf("insert into permissoes_catalogo", fim);
    }
  }

  expect(acoes.length, "nenhuma permissão encontrada nas migrações").toBeGreaterThan(0);
  return acoes;
}

describe("catálogo de permissões", () => {
  it("as migrações e o TypeScript listam exatamente as mesmas ações", () => {
    expect([...acoesDasMigracoes()].sort()).toEqual([...ACOES_PERMISSAO].sort());
  });

  it("não tem ação repetida", () => {
    expect(new Set(ACOES_PERMISSAO).size).toBe(ACOES_PERMISSAO.length);
  });

  /*
   * O formato `dominio.verbo` é o que agrupa a tela e o que torna a lista
   * legível de bater o olho. Uma ação fora do padrão passaria pelo compilador.
   */
  /*
   * O `_` entra no verbo para `pagamento.sem_comprovante` ser legível —
   * "semcomprovante" obriga a soletrar. O domínio segue sem separador, que é
   * o que a tela usa para agrupar.
   */
  it("toda ação segue o padrão dominio.verbo", () => {
    for (const acao of ACOES_PERMISSAO) {
      expect(acao, `"${acao}" fora do padrão`).toMatch(/^[a-z]+\.[a-z_]+$/);
    }
  });

  it("reconhece ação do catálogo e rejeita o que não está nele", () => {
    expect(ehAcaoPermissao("obra.excluir")).toBe(true);
    // O erro de digitação que o tipo existe para pegar.
    expect(ehAcaoPermissao("obra.exclir")).toBe(false);
    expect(ehAcaoPermissao("")).toBe(false);
  });
});
