"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { criarRascunho, type CriarRascunhoState } from "@/app/actions/orcamento";

const initialState: CriarRascunhoState = { error: null };

/**
 * Abre o rascunho direto, sem diálogo.
 *
 * Antes havia um modal pedindo título e uma caixa "começar copiando os itens
 * do orçamento ativo". Os dois eram atrito sem decisão real: editar um
 * orçamento é sempre partir do que está valendo, e o título ninguém escrevia —
 * a revisão acabava em branco no histórico. Agora o clique cria o rascunho com
 * os itens já carregados e leva para a tela; o engenheiro edita à vontade e o
 * orçamento só muda para o cliente quando ele ativa.
 */
export function CriarRascunhoButton({
  obraId,
  copiarDaAtiva,
  label,
}: {
  obraId: string;
  /** Revisão de um orçamento existente: já nasce com os itens dele. */
  copiarDaAtiva: boolean;
  label: string;
}) {
  const action = criarRascunho.bind(null, obraId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      {copiarDaAtiva && <input type="hidden" name="copiar_da_ativa" value="on" />}
      <Button type="submit" variant={copiarDaAtiva ? "outline" : "default"} disabled={pending}>
        {pending ? "Abrindo..." : label}
      </Button>
      {state.error && <FieldError>{state.error}</FieldError>}
    </form>
  );
}
