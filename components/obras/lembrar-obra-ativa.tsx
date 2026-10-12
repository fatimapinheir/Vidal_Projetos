"use client";

import { useEffect } from "react";
import { COOKIE_OBRA_ATIVA } from "@/lib/obra-ativa";

/**
 * Marca esta obra como a última aberta.
 *
 * Grava do cliente e não do servidor porque Server Component não pode escrever
 * cookie no Next — só Server Action ou Route Handler pode. Transformar uma
 * visita de leitura em ação de escrita só para lembrar uma preferência de
 * navegação seria caro demais para o que isso vale.
 *
 * `SameSite=Lax` e sem `Secure` para seguir funcionando em http://localhost;
 * em produção o site é https e o cookie viaja protegido pelo próprio esquema.
 */
export function LembrarObraAtiva({ obraId }: { obraId: string }) {
  useEffect(() => {
    const umAno = 60 * 60 * 24 * 365;
    document.cookie = `${COOKIE_OBRA_ATIVA}=${obraId}; path=/; max-age=${umAno}; SameSite=Lax`;
  }, [obraId]);

  return null;
}
