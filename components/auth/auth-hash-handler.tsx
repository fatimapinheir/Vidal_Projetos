"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Consome o retorno dos links de e-mail do Supabase (recuperação de senha,
 * convite, magic link).
 *
 * O Supabase devolve o resultado no **fragmento** da URL (`#access_token=...`
 * ou `#error=...`). Fragmento não é enviado ao servidor: nem o `proxy.ts` nem
 * nenhuma página server-side enxergam aquilo. Sem este componente, clicar no
 * link de recuperação simplesmente caía numa tela normal do sistema — e, se já
 * houvesse uma sessão aberta no navegador, a falha ficava completamente
 * invisível, porque a página autenticada renderizava como se nada tivesse
 * acontecido.
 *
 * Fica no layout raiz de propósito: o Supabase redireciona para a Site URL do
 * projeto, que pode ser qualquer rota — não dá para prever onde o link vai
 * aterrissar.
 */
export function AuthHashHandler() {
  useEffect(() => {
    const fragmento = window.location.hash;
    if (fragmento.length < 2) return;

    const params = new URLSearchParams(fragmento.slice(1));
    const erro = params.get("error_description") ?? params.get("error");
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    const tipo = params.get("type");

    if (!erro && !accessToken) return;

    // Limpa o fragmento antes de qualquer navegação: evita reprocessar e tira
    // o token de acesso da barra de endereço (ele vaza em histórico e print).
    window.history.replaceState(
      null,
      "",
      window.location.pathname + window.location.search
    );

    if (erro) {
      window.location.assign(`/login?erro=${encodeURIComponent(erro)}`);
      return;
    }

    if (!refreshToken) {
      window.location.assign("/login?erro=link_incompleto");
      return;
    }

    const supabase = createClient();
    supabase.auth
      .setSession({ access_token: accessToken!, refresh_token: refreshToken })
      .then(({ error }) => {
        if (error) {
          window.location.assign(`/login?erro=${encodeURIComponent(error.message)}`);
          return;
        }
        // Recuperação e convite caem na tela de definir senha; o resto entra
        // direto e a raiz encaminha para o painel certo conforme o papel.
        window.location.assign(
          tipo === "recovery" || tipo === "invite" ? "/atualizar-senha" : "/"
        );
      });
  }, []);

  return null;
}
