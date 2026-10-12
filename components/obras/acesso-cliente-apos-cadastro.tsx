"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { AcessoClienteDialog } from "./acesso-cliente-dialog";

/**
 * Abre o modal de acesso do cliente quando a obra acabou de ser criada.
 *
 * O sinal vem da URL (`?nova=1`), posta pelo redirecionamento do cadastro.
 * Assim o modal é consequência de ter criado a obra, e não de ter visitado a
 * tela — abrir a cada visita viraria estorvo na obra que já tem cliente.
 *
 * Ao fechar, o parâmetro sai da URL: senão, um F5 traria o modal de volta.
 */
export function AcessoClienteAposCadastro({
  obraId,
  nova,
}: {
  obraId: string;
  nova: boolean;
}) {
  const [aberto, setAberto] = useState(nova);
  const router = useRouter();
  const pathname = usePathname();

  function fechar() {
    setAberto(false);
    router.replace(pathname);
  }

  return <AcessoClienteDialog obraId={obraId} aberto={aberto} onFechar={fechar} />;
}
