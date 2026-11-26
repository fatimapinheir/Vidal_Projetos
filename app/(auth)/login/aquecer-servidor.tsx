"use client";

import { useEffect, useRef } from "react";

/**
 * Pede o aquecimento da função de servidor assim que a página de login abre.
 *
 * A página é HTML estático e chega pelo CDN sem acordar a função Node — ótimo
 * para quem olha, inútil para quem envia, porque o "Entrar" é uma Server Action
 * e pagaria os 4,76s de partida a frio. Este pedido usa o tempo em que a pessoa
 * está digitando (10 a 15 segundos) para subir o servidor em paralelo.
 *
 * Não renderiza nada e não mostra erro: se o aquecimento falhar, o login segue
 * funcionando normalmente, apenas mais devagar. Nunca deve atrapalhar.
 */
export function AquecerServidor() {
  const jaPediu = useRef(false);

  useEffect(() => {
    // Em desenvolvimento o StrictMode roda o efeito duas vezes; o segundo
    // pedido não faria mal, mas também não serve para nada.
    if (jaPediu.current) return;
    jaPediu.current = true;

    void fetch("/api/aquecer", { cache: "no-store" }).catch(() => {
      // Silêncio proposital — ver o comentário acima.
    });
  }, []);

  return null;
}
