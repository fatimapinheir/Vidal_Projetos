"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/**
 * A lixeira do fim da linha. É assim que se exclui em toda listagem do sistema.
 *
 * O padrão é um só por decisão: ícone, no fim da linha, com uma confirmação
 * que diz o que vai embora. Já houve exclusão como botão cheio dentro da tela
 * de detalhe, e o efeito foi ter de abrir o item para apagá-lo — três cliques
 * para desfazer um registro aberto por engano, e nenhuma pista na lista de que
 * aquilo era possível.
 *
 * A ação pode RECUSAR devolvendo `error`. É o que acontece com colaborador que
 * já tem presença lançada: a recusa vira um aviso explicando por quê, em vez
 * de um erro de chave estrangeira do banco.
 */
export function BotaoExcluir({
  /** O que a confirmação pergunta. Diga o que some junto. */
  confirmacao,
  acao,
  rotulo = "Excluir",
  /** Para onde ir depois. Ausente, só recarrega a lista. */
  irPara,
}: {
  confirmacao: string;
  acao: () => Promise<{ error: string | null } | void>;
  rotulo?: string;
  irPara?: string;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function aoClicar(evento: React.MouseEvent) {
    /*
     * A linha inteira costuma ser um link. Sem isto, clicar na lixeira abria
     * o item e a confirmação aparecia já na outra tela.
     */
    evento.preventDefault();
    evento.stopPropagation();

    if (!confirm(confirmacao)) return;

    startTransition(async () => {
      const resultado = await acao();
      if (resultado?.error) {
        toast.error(resultado.error);
        return;
      }
      if (irPara) router.push(irPara);
      else router.refresh();
    });
  }

  return (
    <Button
      type="button"
      onClick={aoClicar}
      disabled={pending}
      variant="ghost"
      size="icon-sm"
      aria-label={rotulo}
      title={rotulo}
    >
      <Trash2 className="size-4" />
    </Button>
  );
}
