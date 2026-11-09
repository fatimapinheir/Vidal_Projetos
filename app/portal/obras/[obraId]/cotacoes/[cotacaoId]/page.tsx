import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatDateBR } from "@/lib/format-date";
import { diaDoInstante } from "@/lib/fuso";
import { carregarCotacao } from "@/lib/cotacoes/carregar";
import { CotacaoStatusBadge } from "@/components/cotacoes/status-badges";
import { ComparativoPropostas } from "@/components/cotacoes/comparativo-propostas";
import {
  EscolherPropostaBotao,
  RecusarCotacaoBotao,
} from "@/components/cotacoes/decidir-cotacao";

/**
 * A tela onde o cliente decide.
 *
 * Tudo o que está aqui serve a uma pergunta: qual destas. Por isso não há
 * número de orçamento, não há saldo e não há percentual gasto — são o assunto
 * de outras telas, e aqui disputariam com a comparação.
 *
 * O botão de escolher aparece em TODAS as propostas, com o mesmo peso visual. O
 * selo "menor valor" marca a mais barata, e para aí: prazo e fornecedor pesam
 * tanto quanto preço numa obra, e destacar uma como recomendada seria o sistema
 * decidindo no lugar de quem paga.
 */
export default async function PortalCotacaoPage({
  params,
}: {
  params: Promise<{ obraId: string; cotacaoId: string }>;
}) {
  const { obraId, cotacaoId } = await params;
  const supabase = await createClient();
  const cotacao = await carregarCotacao(supabase, cotacaoId);

  // Inclui o caso de a cotação existir e ser rascunho: a policy devolve nada, e
  // para o cliente ela simplesmente não existe.
  if (!cotacao || cotacao.obraId !== obraId) notFound();

  const podeDecidir = cotacao.status === "aguardando_cliente";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 border-b pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold">{cotacao.descricao}</h1>
          <CotacaoStatusBadge status={cotacao.status} />
        </div>

        {cotacao.prazoDecisao && podeDecidir && (
          <p className="text-sm text-muted-foreground">
            Prazo para decidir: {formatDateBR(cotacao.prazoDecisao)}
          </p>
        )}

        {cotacao.observacoes && (
          <p className="rounded-lg bg-muted/40 p-3 text-sm">{cotacao.observacoes}</p>
        )}

        {cotacao.status === "decidida" && (
          <div className="rounded-lg border border-primary/40 bg-primary/5 p-3 text-sm">
            <p className="font-medium">Proposta escolhida</p>
            <p className="text-muted-foreground">
              Esta cotação virou uma ordem de compra
              {cotacao.decididaEm ? ` em ${formatDateBR(diaDoInstante(cotacao.decididaEm))}` : ""}.{" "}
              {cotacao.compraId && (
                <Link
                  href={`/portal/obras/${obraId}/compras/${cotacao.compraId}`}
                  className="font-medium underline underline-offset-4"
                >
                  Ver a ordem de compra
                </Link>
              )}
            </p>
          </div>
        )}

        {cotacao.status === "recusada" && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
            <p className="font-medium">Nenhuma proposta foi aceita</p>
            <p className="text-muted-foreground">{cotacao.motivoRecusa}</p>
          </div>
        )}
      </div>

      {podeDecidir && (
        <p className="text-sm text-muted-foreground">
          {cotacao.propostas.length === 1
            ? "Uma proposta para a sua decisão. Só ela vira compra se você aceitar."
            : `${cotacao.propostas.length} propostas para a mesma compra. Escolha uma — é a única que vira ordem de compra.`}
        </p>
      )}

      <ComparativoPropostas
        propostas={cotacao.propostas}
        linkDaOrdem={() =>
          cotacao.compraId ? `/portal/obras/${obraId}/compras/${cotacao.compraId}` : null
        }
        acoes={
          podeDecidir
            ? (proposta) => (
                <EscolherPropostaBotao
                  propostaId={proposta.id}
                  fornecedor={proposta.fornecedor}
                  valor={proposta.valorTotal}
                />
              )
            : undefined
        }
      />

      {podeDecidir && (
        <div className="border-t pt-4">
          <RecusarCotacaoBotao cotacaoId={cotacaoId} />
        </div>
      )}
    </div>
  );
}
