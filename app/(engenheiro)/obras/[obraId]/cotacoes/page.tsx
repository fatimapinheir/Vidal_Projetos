import Link from "next/link";
import { Plus, Scale } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { AjudaDaPagina } from "@/components/ui/ajuda-da-pagina";
import { Paginacao } from "@/components/ui/paginacao";
import { faixaDaPagina, lerPagina } from "@/lib/paginacao";
import { formatDateBR } from "@/lib/format-date";
import { CotacaoStatusBadge } from "@/components/cotacoes/status-badges";
import { ExcluirCotacaoDialog } from "@/components/cotacoes/excluir-dialogs";

function moeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** "R$ 1.200 a R$ 1.480" quando as propostas divergem; o valor único quando não. */
function faixa(menor: number | null, maior: number | null) {
  if (menor === null || maior === null) return "—";
  if (Math.abs(maior - menor) < 0.01) return moeda(menor);
  return `${moeda(menor)} a ${moeda(maior)}`;
}

/**
 * A fila de cotações da obra.
 *
 * A coluna que justifica a tela é a FAIXA de valores: é ela que diz, de
 * relance, onde a comparação valeu a pena. Uma cotação em que as três propostas
 * vieram iguais não precisava de três fornecedores; uma com 30% de diferença
 * entre a maior e a menor é a que paga o trabalho de ter cotado.
 */
export default async function CotacoesPage({
  params,
  searchParams,
}: {
  params: Promise<{ obraId: string }>;
  searchParams: Promise<{ pagina?: string }>;
}) {
  const { obraId } = await params;
  const { pagina: paginaParam } = await searchParams;
  const supabase = await createClient();

  const { count } = await supabase
    .from("cotacoes")
    .select("id", { count: "exact", head: true })
    .eq("obra_id", obraId);

  const total = count ?? 0;
  const { pagina, de, ate } = faixaDaPagina(lerPagina(paginaParam), total);

  const { data: cotacoes } = await supabase
    .from("vw_cotacoes_lista")
    .select("*")
    .eq("obra_id", obraId)
    /*
     * Pendentes primeiro, e não a mais recente no topo.
     *
     * A ordenação por data deixaria a cotação que espera decisão há duas
     * semanas abaixo das já resolvidas. Ordenar por `status` também não serve:
     * enum no Postgres ordena pela ordem de DEFINIÇÃO do tipo, que começa em
     * `rascunho` — daí a coluna de posto na view (0078).
     */
    .order("ordem_situacao", { ascending: true })
    .order("created_at", { ascending: false })
    .range(de, ate);

  const linhas = cotacoes ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <h1 className="text-xl font-semibold">Cotações</h1>
          <AjudaDaPagina titulo="Cotações">
            <p>
              Uma cotação é uma necessidade de compra com várias propostas de preço penduradas —
              três fornecedores para o mesmo material, por exemplo.
            </p>
            <p>
              Enquanto ela está <strong>Não enviada</strong>, o cliente não vê nada. Ao enviar, ele
              escolhe uma proposta ou recusa todas. Você também pode decidir por ele.
            </p>
            <p>
              Só a proposta <strong>escolhida</strong> vira ordem de compra, e é só nesse momento que
              o valor entra no custo da obra. Nenhum valor cotado aparece em painel nem em
              orçamento.
            </p>
          </AjudaDaPagina>
        </div>

        <Button render={<Link href={`/obras/${obraId}/cotacoes/nova`} />} nativeButton={false}>
          <Plus className="size-4" />
          Nova cotação
        </Button>
      </div>

      {!linhas.length ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Scale className="size-8 text-muted-foreground" aria-hidden />
            <div className="flex flex-col gap-1">
              <p className="font-medium">Nenhuma cotação nesta obra</p>
              <p className="max-w-md text-sm text-muted-foreground">
                Crie uma quando quiser comparar preços antes de comprar. Se já sabe de quem vai
                comprar, a ordem de compra direta continua sendo o caminho curto.
              </p>
            </div>
            <Button
              variant="outline"
              render={<Link href={`/obras/${obraId}/cotacoes/nova`} />}
              nativeButton={false}
            >
              Criar a primeira cotação
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>O que está sendo cotado</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead>Propostas</TableHead>
                <TableHead>Faixa de valores</TableHead>
                <TableHead>Prazo</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {linhas.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="max-w-64">
                    <Link
                      href={`/obras/${obraId}/cotacoes/${c.id}`}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {c.descricao}
                    </Link>
                    {c.status === "decidida" && c.fornecedor_escolhido && (
                      <p className="text-xs text-muted-foreground">
                        {c.fornecedor_escolhido} — {moeda(Number(c.valor_escolhido ?? 0))}
                      </p>
                    )}
                    {c.status === "recusada" && c.motivo_recusa && (
                      <p className="text-xs text-muted-foreground">{c.motivo_recusa}</p>
                    )}
                  </TableCell>
                  <TableCell>
                    <CotacaoStatusBadge status={c.status} />
                  </TableCell>
                  <TableCell>{c.propostas}</TableCell>
                  <TableCell className="whitespace-nowrap text-sm">
                    {c.status === "decidida"
                      ? moeda(Number(c.valor_escolhido ?? 0))
                      : faixa(
                          c.menor_valor === null ? null : Number(c.menor_valor),
                          c.maior_valor === null ? null : Number(c.maior_valor)
                        )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    {c.prazo_decisao ? formatDateBR(c.prazo_decisao) : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <ExcluirCotacaoDialog
                      cotacaoId={c.id}
                      descricao={c.descricao}
                      decidida={c.status === "decidida"}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Paginacao pagina={pagina} total={total} caminho={`/obras/${obraId}/cotacoes`} />
    </div>
  );
}
