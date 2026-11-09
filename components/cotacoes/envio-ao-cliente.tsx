"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { definirEnvioAoCliente } from "@/app/actions/cotacoes";

/**
 * O botão que abre (ou fecha) a cotação para o cliente.
 *
 * Existe como passo explícito porque enquanto a cotação é rascunho o cliente
 * não vê NADA dela — a policy barra `status = 'rascunho'`. Mandar sozinha a
 * cada proposta cadastrada mostraria ao cliente uma comparação pela metade, com
 * duas das três propostas que o engenheiro ainda ia cadastrar.
 *
 * Chamar de volta também é um botão, e não um caminho escondido: enviar antes
 * de terminar é o erro fácil de cometer, e precisa ser fácil de desfazer
 * enquanto ninguém decidiu nada.
 */
export function EnvioAoClienteBotao({
  cotacaoId,
  enviada,
  temProposta,
}: {
  cotacaoId: string;
  enviada: boolean;
  temProposta: boolean;
}) {
  const [pending, iniciar] = useTransition();
  const router = useRouter();

  function alternar() {
    iniciar(async () => {
      try {
        await definirEnvioAoCliente(cotacaoId, !enviada);
        toast.success(
          enviada ? "Cotação recolhida: o cliente não a vê mais." : "Cotação enviada ao cliente."
        );
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Não foi possível mudar a situação.");
      }
    });
  }

  return (
    <Button
      variant={enviada ? "outline" : "default"}
      onClick={alternar}
      disabled={pending || (!enviada && !temProposta)}
      title={
        !enviada && !temProposta ? "Cadastre ao menos uma proposta antes de enviar" : undefined
      }
    >
      {pending
        ? "Salvando..."
        : enviada
          ? "Recolher do cliente"
          : "Enviar ao cliente"}
    </Button>
  );
}
