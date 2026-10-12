/**
 * Nome do cookie que guarda se a lateral está recolhida.
 *
 * Mesmo arranjo de `obra-ativa`: arquivo sem import nenhum, porque quem grava é
 * o navegador e quem lê é o servidor. Em cookie e não em localStorage pelo
 * motivo de sempre — é o servidor que renderiza a lateral, e lido só no
 * cliente o menu nasceria aberto e encolheria depois, piscando em toda
 * navegação.
 */
export const COOKIE_LATERAL = "vidal-lateral";

/** O valor que significa recolhida. Qualquer outro é tratado como aberta. */
export const LATERAL_RECOLHIDA = "icones";
