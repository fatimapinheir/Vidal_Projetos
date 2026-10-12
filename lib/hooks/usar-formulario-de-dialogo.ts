"use client";

import { useState, useTransition } from "react";

/** O que as Server Actions de formulário devolvem neste projeto. */
type EstadoDeAcao = { error: string | null; success?: boolean };

/**
 * Um formulário dentro de um diálogo: envia, mostra o erro, fecha quando dá
 * certo.
 *
 * Existe porque a versão anterior estava copiada em dez telas, e com ela o
 * mesmo defeito:
 *
 *     const [state, formAction] = useActionState(acao, inicial);
 *     useEffect(() => { if (state.success) setOpen(false); }, [state.success]);
 *
 * `useActionState` guarda o estado enquanto o componente estiver montado, e o
 * diálogo fica montado o tempo todo — o botão que o abre faz parte dele. No
 * segundo cadastro seguido, `success` já era `true` e continuava `true`: a
 * dependência não mudava, o efeito não rodava, e o diálogo ficava aberto com o
 * dado já salvo. Só um erro no meio desfazia o ciclo.
 *
 * Aqui o fechamento acontece no fluxo do envio, onde a decisão é tomada, e não
 * num efeito que observa o resultado depois. Como consequência, não há estado
 * residual: cada envio é um envio.
 *
 * `aoFechar` é para o que a tela guarda por fora — um select que volta ao
 * padrão, uma seleção de membros que se limpa. Roda ao fechar, inclusive
 * depois de um envio bem-sucedido.
 */
export function useFormularioDeDialogo<E extends EstadoDeAcao>({
  acao,
  estadoInicial,
  aoFechar,
}: {
  /** A Server Action já com `bind`, no formato (estadoAnterior, formData). */
  acao: (estadoAnterior: E, formData: FormData) => Promise<E>;
  estadoInicial: E;
  aoFechar?: () => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();

  function mudarAberto(proximo: boolean) {
    if (!proximo) {
      // O erro não sobrevive ao fechamento: reabrir mostrando a reclamação da
      // tentativa anterior faria o usuário procurar um problema no formulário
      // em branco que está vendo.
      setErro(null);
      aoFechar?.();
    }
    setAberto(proximo);
  }

  function enviar(formData: FormData) {
    setErro(null);
    iniciar(async () => {
      // O estado inicial vai como "anterior" porque a assinatura da ação vem
      // de `useActionState`. Nenhuma delas lê esse argumento — todas o
      // nomeiam `_prevState`.
      const resultado = await acao(estadoInicial, formData);
      if (resultado?.error) {
        setErro(resultado.error);
        return;
      }
      mudarAberto(false);
    });
  }

  return { aberto, mudarAberto, enviar, erro, enviando };
}
