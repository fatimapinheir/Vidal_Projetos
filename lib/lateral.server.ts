import "server-only";
import { cookies } from "next/headers";
import { COOKIE_LATERAL, LATERAL_RECOLHIDA } from "./lateral";

/**
 * A lateral está recolhida?
 *
 * Lido no servidor para a coluna já nascer do tamanho certo. Qualquer valor
 * diferente do esperado conta como aberta — o cookie é editável pelo usuário,
 * e o padrão seguro aqui é o menu por extenso.
 */
export async function lerLateralRecolhida(): Promise<boolean> {
  return (await cookies()).get(COOKIE_LATERAL)?.value === LATERAL_RECOLHIDA;
}
