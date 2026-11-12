"use client";

import { useTransition } from "react";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logout } from "@/lib/auth/actions";

/**
 * O aviso para o estado em que a moldura e os dados discordam.
 *
 * `getSessao` lê o perfil do TOKEN, para não gastar uma ida ao banco em toda
 * navegação. A RLS lê `profiles.role`, no banco, sempre. Quando os dois
 * divergem — e isso aconteceu de verdade, numa troca de perfil que atualizou o
 * banco sem reemitir o token — a pessoa vê o menu de um perfil sobre telas
 * vazias do outro, sem nada explicando.
 *
 * Telas vazias sem explicação são indistinguíveis de sistema quebrado. Com a
 * correção da troca isto deixou de acontecer, mas o aviso fica: o descompasso
 * também surge quando alguém muda o papel de uma pessoa direto no SQL, e aí o
 * token dela segue antigo até expirar.
 *
 * Não redireciona de propósito. Mandar para o outro lado faria o layout de lá
 * conferir o token de novo, não gostar, e mandar de volta — um laço. Sair e
 * entrar emite um token novo e realinha os dois de uma vez.
 */
export function AvisoPerfilDivergente({
  papelNaTela,
  papelNoBanco,
}: {
  papelNaTela: string;
  papelNoBanco: string;
}) {
  const [saindo, iniciarSaida] = useTransition();

  return (
    <div
      role="alert"
      className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/40 bg-destructive/5 p-3.5"
    >
      <div className="flex items-start gap-2.5">
        <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
        <div className="text-sm">
          <p className="font-medium">Seu perfil mudou nesta conta</p>
          <p className="text-muted-foreground">
            A tela ainda está montada como <strong>{papelNaTela}</strong>, mas o sistema já trata
            você como <strong>{papelNoBanco}</strong> — por isso as telas aparecem vazias. Saia e
            entre de novo para alinhar.
          </p>
        </div>
      </div>

      <Button
        size="sm"
        variant="destructive"
        disabled={saindo}
        onClick={() => iniciarSaida(() => logout())}
      >
        {saindo ? "Saindo..." : "Sair e entrar de novo"}
      </Button>
    </div>
  );
}
