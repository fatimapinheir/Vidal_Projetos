import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * Testes de função pura, sem banco e sem navegador.
 *
 * O alvo é `lib/`: as funções que recebem dados e devolvem números. Foi ali que
 * nasceram os três erros que chegaram em produção — a mensalidade da locação
 * multiplicando pela quantidade (R$ 6.660 a mais na previsão da obra), o Zod
 * recusando `null` e travando o diário, e o "já gasto" somando o que não tinha
 * sido pago. Nenhum dos três precisava de banco para ser pego.
 *
 * Deliberadamente SEM ambiente de DOM e sem testar componente: teste de tela é
 * outro investimento, e começar por ele costuma significar nunca começar.
 */
export default defineConfig({
  test: {
    include: ["lib/**/*.test.ts"],
    environment: "node",
  },
  resolve: {
    // O mesmo `@/` do tsconfig: sem isto os imports dos módulos não resolvem.
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
});
