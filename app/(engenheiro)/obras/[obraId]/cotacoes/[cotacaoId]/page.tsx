import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDateBR } from "@/lib/format-date";
import { carregarCotacao } from "@/lib/cotacoes/carregar";
import { CotacaoStatusBadge } from "@/components/cotacoes/status-badges";
import { ComparativoPropostas } from "@/components/cotacoes/comparativo-propostas";
import {
  EscolherPropostaBotao,
  RecusarCotacaoBotao,
  AguardandoCliente,
} from "@/components/cotacoes/decidir-cotacao";
import { EnvioAoClienteBotao } from "@/components/cotacoes/envio-ao-cliente";
import { ExcluirPropostaDialog } from "@/components/cotacoes/excluir-dialogs";

/**
 * A cotação pelos olhos do engenheiro: montar, enviar, e decidir se for o caso.
 *
 * A ordem da tela segue a tarefa. Primeiro o que está sendo cotado e em que
 * situação; depois as propostas, que é onde ele passa o tempo; por último as
 * ações de decisão — que só fazem sentido depois de olhar a comparação.
 */
export default async function CotacaoDetalhePage({
  params,
}: {
  params: Promise<{ obraId: string; cotacaoId: string }>;
}) {
  const { obraId, cotacaoId } = await params;
  const supabase = await createClient();
  const cotacao = await carregarCotacao(supabase, cotacaoId);

  if (!cotacao || cotacao.obraId !== obraId) notFound();

  const aberta = cotacao.status === "rascunho" || cotacao.status === "aguardando_cliente";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 border-b pb-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex flex-col gap-1.5">
            <h1 className="text-xl font-semibold">{cotacao.descricao}</h1>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <CotacaoStatusBadge status={cotacao.status} />
              {cotacao.orcamentoEtapa && <span>Etapa: {cotacao.orcamentoEtapa}</span>}
              {cotacao.prazoDecisao && (
                <span>Decidir até {formatDateBR(cotacao.prazoDecisao)}</span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {aberta && (
              <>
                <Button
                  variant="outline"
                  render={<Link href={`/obras/${obraId}/cotacoes/${cotacaoId}/editar`} />}
                  nativeButton={false}
                >
                  <Pencil className="size-4" />
                  Editar
                </Button>
                <EnvioAoClienteBotao
                  cotacaoId={cotacaoId}
                  enviada={cotacao.status === "aguardando_cliente"}
                  temProposta={cotacao.propostas.length > 0}
                />
              </>
            )}
          </div>
        </div>

        {cotacao.observacoes && (
          <p className="text-sm text-muted-foreground">{cotacao.observacoes}</p>
        )}

        {cotacao.status === "recusada" && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
            <p className="font-medium">Cotação recusada</p>
            <p className="text-muted-foreground">{cotacao.motivoRecusa}</p>
          </div>
        )}
      </div>

      {cotacao.status === "aguardando_cliente" && <AguardandoCliente />}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">
          {cotacao.propostas.length === 0
            ? "Nenhuma proposta ainda"
            : `${cotacao.propostas.length} proposta${cotacao.propostas.length > 1 ? "s" : ""}`}
        </h2>
        {aberta && (
          <Button
            variant="outline"
            render={<Link href={`/obras/${obraId}/cotacoes/${cotacaoId}/propostas/nova`} />}
            nativeButton={false}
          >
            <Plus className="size-4" />
            Adicionar proposta
          </Button>
        )}
      </div>

      {cotacao.propostas.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Cadastre a proposta de cada fornecedor — o que ele cotou, por quanto e em que prazo.
            Com uma já é possível enviar ao cliente.
          </CardContent>
        </Card>
      ) : (
        <ComparativoPropostas
          propostas={cotacao.propostas}
          linkDaOrdem={() => (cotacao.compraId ? `/obras/${obraId}/compras/${cotacao.compraId}` : null)}
          acoes={
            aberta
              ? (proposta) => (
                  <>
                    {/*
                      O engenheiro escolhe a qualquer momento, inclusive em
                      rascunho: há compra que não precisa passar pelo cliente, e
                      obrigar a enviar para depois decidir sozinho seria um
                      passo de teatro.
                    */}
                    <EscolherPropostaBotao
                      propostaId={proposta.id}
                      fornecedor={proposta.fornecedor}
                      valor={proposta.valorTotal}
                    />
                    <Button
                      variant="outline"
                      render={
                        <Link
                          href={`/obras/${obraId}/cotacoes/${cotacaoId}/propostas/${proposta.id}/editar`}
                        />
                      }
                      nativeButton={false}
                    >
                      <Pencil className="size-4" />
                      Editar
                    </Button>
                    <ExcluirPropostaDialog
                      propostaId={proposta.id}
                      fornecedor={proposta.fornecedor}
                    />
                  </>
                )
              : undefined
          }
        />
      )}

      {aberta && cotacao.propostas.length > 0 && (
        <div className="border-t pt-4">
          <RecusarCotacaoBotao cotacaoId={cotacaoId} />
        </div>
      )}
    </div>
  );
}
