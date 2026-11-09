"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { escolherPropostaAction, recusarCotacaoAction } from "@/app/actions/cotacoes";

function moeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/**
 * "Escolher esta proposta" — e a confirmação não é cerimônia.
 *
 * O clique cria uma ordem de compra APROVADA: o valor entra no comprometido da
 * obra e as outras propostas são encerradas, tudo de uma vez e sem desfazer. A
 * caixa repete fornecedor e valor em texto porque é o que distingue um clique
 * decidido de um toque errado numa lista de três cartões parecidos.
 */
export function EscolherPropostaBotao({
  propostaId,
  fornecedor,
  valor,
  variante = "default",
}: {
  propostaId: string;
  fornecedor: string;
  valor: number;
  variante?: "default" | "outline";
}) {
  const [open, setOpen] = useState(false);
  const [pending, iniciar] = useTransition();

  function handleEscolher() {
    iniciar(async () => {
      try {
        await escolherPropostaAction(propostaId);
        // Sem toast de sucesso: a ação redireciona para a ordem de compra
        // criada, e a tela nova já é a confirmação.
      } catch (err) {
        /*
         * `redirect()` do Next funciona lançando — e o catch que pega o erro
         * do servidor pegaria também o desvio bem-sucedido, virando um toast
         * de erro em cima de uma operação que deu certo.
         */
        if (err instanceof Error && err.message === "NEXT_REDIRECT") throw err;
        if (
          typeof err === "object" &&
          err !== null &&
          "digest" in err &&
          String((err as { digest?: unknown }).digest).startsWith("NEXT_REDIRECT")
        ) {
          throw err;
        }
        toast.error(err instanceof Error ? err.message : "Não foi possível escolher a proposta.");
        setOpen(false);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button variant={variante}>Escolher esta proposta</Button>}
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Escolher a proposta de {fornecedor}?</DialogTitle>
          <DialogDescription>
            Vira uma ordem de compra aprovada de {moeda(valor)}, com os itens e as parcelas desta
            proposta. As outras propostas desta cotação são encerradas. Não há como desfazer.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button onClick={handleEscolher} disabled={pending}>
            {pending ? "Gerando ordem..." : `Confirmar ${moeda(valor)}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * "Nenhuma proposta serve" — com motivo obrigatório.
 *
 * O motivo não é burocracia: é o que o engenheiro lê para saber se precisa
 * cotar de novo, e com o quê. Recusa sem motivo deixaria a cotação encerrada e
 * ninguém sabendo o que fazer em seguida.
 */
export function RecusarCotacaoBotao({ cotacaoId }: { cotacaoId: string }) {
  const [open, setOpen] = useState(false);
  const [pending, iniciar] = useTransition();
  const router = useRouter();

  function handleRecusar(formData: FormData) {
    iniciar(async () => {
      try {
        await recusarCotacaoAction(cotacaoId, formData);
        toast.success("Cotação recusada.");
        setOpen(false);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Não foi possível recusar.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline">Nenhuma proposta serve</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Recusar todas as propostas</DialogTitle>
          <DialogDescription>
            A cotação fica registrada como recusada, com o motivo. Nada é apagado.
          </DialogDescription>
        </DialogHeader>
        <form action={handleRecusar} className="flex flex-col gap-3">
          <Textarea
            name="motivo"
            rows={3}
            required
            placeholder="Preço acima do orçado, prazo longo demais, faltou item…"
          />
          <DialogFooter>
            <Button type="submit" variant="destructive" disabled={pending}>
              {pending ? "Recusando..." : "Confirmar recusa"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** O aviso de que a decisão é do cliente e já está com ele. */
export function AguardandoCliente() {
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-dashed bg-muted/30 p-4 text-sm">
      <TriangleAlert className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
      <div className="flex flex-col gap-1">
        <p className="font-medium">Esperando o cliente escolher</p>
        <p className="text-muted-foreground">
          Ele vê esta cotação no portal e pode escolher uma proposta ou recusar todas. Você também
          pode decidir por ele aqui, quando for o caso.
        </p>
      </div>
    </div>
  );
}
