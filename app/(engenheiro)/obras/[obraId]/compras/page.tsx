import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { CompraStatusBadge } from "@/components/compras/status-badges";
import {
  SituacaoFinanceiraBadge,
  SituacaoEntregaBadge,
} from "@/components/compras/situacao-badges";
import {
  situacaoFinanceiraCompra,
  situacaoEntregaCompra,
  contagemPagas,
  type ParcelaSituacao,
} from "@/lib/compras/situacao";

export default async function ComprasObraPage({
  params,
}: {
  params: Promise<{ obraId: string }>;
}) {
  const { obraId } = await params;
  const supabase = await createClient();

  const [{ data: compras }, { data: parcelas }] = await Promise.all([
    supabase
      .from("compras")
      .select("*, fornecedores(nome)")
      .eq("obra_id", obraId)
      .order("created_at", { ascending: false }),
    // As parcelas de todas as ordens da obra numa consulta, agrupadas abaixo.
    // Uma consulta por linha da tabela seria uma dúzia de idas ao banco só para
    // desenhar dois selos.
    supabase
      .from("vw_compra_parcelas")
      .select("*, compras!inner(obra_id)")
      .eq("compras.obra_id", obraId),
  ]);

  const parcelasPorCompra = new Map<string, ParcelaSituacao[]>();
  for (const parcela of parcelas ?? []) {
    const daCompra = parcelasPorCompra.get(parcela.compra_id) ?? [];
    daCompra.push(parcela);
    parcelasPorCompra.set(parcela.compra_id, daCompra);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Ordens de compra de material dessa obra.</p>
        <div className="flex flex-wrap items-center gap-2">
          {/* Lançamento antes da ordem na ordem de leitura? Não: a ordem de
              compra é o fluxo principal e fica com o botão cheio. O
              lançamento é o atalho para o que já foi pago, e botão de
              contorno é o peso certo para ele. */}
          <Button
            nativeButton={false}
            variant="outline"
            render={
              <Link href={`/obras/${obraId}/compras/lancamento`}>Novo lançamento</Link>
            }
          />
          <Button
            nativeButton={false}
            render={<Link href={`/obras/${obraId}/compras/novo`}>Nova ordem de compra</Link>}
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Descrição</TableHead>
              <TableHead>Fornecedor</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Aprovação</TableHead>
              <TableHead>Financeiro</TableHead>
              <TableHead>Entrega</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {compras?.map((c) => {
              const fornecedor = c.fornecedores as unknown as { nome: string } | null;
              const suasParcelas = parcelasPorCompra.get(c.id) ?? [];
              const { total, pagas } = contagemPagas(suasParcelas);
              return (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.descricao}</TableCell>
                  <TableCell>{fornecedor?.nome}</TableCell>
                  <TableCell>
                    {c.valor_total.toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    })}
                  </TableCell>
                  <TableCell>
                    <CompraStatusBadge status={c.status} />
                  </TableCell>
                  <TableCell>
                    <SituacaoFinanceiraBadge
                      situacao={situacaoFinanceiraCompra(suasParcelas)}
                      complemento={
                        total > 1 && pagas > 0 && pagas < total
                          ? `${pagas} de ${total} pagas`
                          : undefined
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <SituacaoEntregaBadge situacao={situacaoEntregaCompra(suasParcelas)} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      nativeButton={false}
                      render={<Link href={`/obras/${obraId}/compras/${c.id}`}>Abrir</Link>}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
            {!compras?.length && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  Nenhuma ordem de compra registrada ainda.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
