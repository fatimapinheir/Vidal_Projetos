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

export default async function ComprasObraPage({
  params,
}: {
  params: Promise<{ obraId: string }>;
}) {
  const { obraId } = await params;
  const supabase = await createClient();

  const { data: compras } = await supabase
    .from("compras")
    .select("*, fornecedores(nome)")
    .eq("obra_id", obraId)
    .order("created_at", { ascending: false });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Ordens de compra de material dessa obra.</p>
        <Button
          nativeButton={false}
          render={<Link href={`/obras/${obraId}/compras/novo`}>Nova ordem de compra</Link>}
        />
      </div>

      <div className="overflow-x-auto rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Descrição</TableHead>
              <TableHead>Fornecedor</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {compras?.map((c) => {
              const fornecedor = c.fornecedores as unknown as { nome: string } | null;
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
                <TableCell colSpan={5} className="text-center text-muted-foreground">
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
