/**
 * Nome do cookie que guarda a última obra aberta.
 *
 * Fica num arquivo sem nenhum import de propósito: quem grava é o navegador e
 * quem lê é o servidor, então as duas pontas precisam do mesmo nome. Se a
 * constante morasse junto da leitura (que usa `next/headers`), o componente
 * cliente arrastaria `next/headers` para o bundle e o build quebraria.
 */
export const COOKIE_OBRA_ATIVA = "vidal-obra";
