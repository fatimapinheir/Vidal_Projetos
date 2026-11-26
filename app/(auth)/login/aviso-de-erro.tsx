"use client";

import { useSearchParams } from "next/navigation";
import { mensagemDeErroLogin } from "@/lib/auth/mensagem-de-erro-login";

/**
 * Mostra o `?erro=` que o `/auth/confirm` anexa quando o link de e-mail falha.
 *
 * Lê o parâmetro no NAVEGADOR, de propósito. Ler `searchParams` no servidor
 * obrigava o Next a renderizar a página de login a cada visita, e isso fazia a
 * porta de entrada do sistema acordar a função Node — 5,2s de espera medidos em
 * produção para, quase sempre, não mostrar erro nenhum. Ver o comentário em
 * `page.tsx`.
 */
export function AvisoDeErro() {
  const erro = useSearchParams().get("erro");

  if (!erro) return null;

  return (
    <p
      role="alert"
      className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
    >
      {mensagemDeErroLogin(erro)}
    </p>
  );
}
