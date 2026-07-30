import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { CompraStatusBadge } from "@/components/compras/status-badges";

export default async function PortalComprasPage({
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
      <div>
        <h1 className="font-heading text-lg font-semibold">Ordens de Compra</h1>
        <p className="text-sm text-muted-foreground">
          Todas as ordens de compra registradas nessa obra.
        </p>
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
                  <TableCell className="font-medium">
                    <Link
                      href={`/portal/obras/${obraId}/compras/${c.id}`}
                      className="underline-offset-4 hover:underline"
                    >
                      {c.descricao}
                    </Link>
                  </TableCell>
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
                  <TableCell />
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
