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
import { desvincularCliente } from "@/app/actions/obra-clientes";
import { VincularClienteDialog } from "./vincular-cliente-dialog";

export default async function ClientesObraPage({
  params,
}: {
  params: Promise<{ obraId: string }>;
}) {
  const { obraId } = await params;
  const supabase = await createClient();

  const { data: vinculos } = await supabase
    .from("obra_clientes")
    .select("cliente_id, profiles(nome, email, telefone)")
    .eq("obra_id", obraId);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Clientes com acesso ao dashboard dessa obra.
        </p>
        <VincularClienteDialog obraId={obraId} />
      </div>

      <div className="overflow-x-auto rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {vinculos?.map((v) => {
              const cliente = v.profiles as unknown as {
                nome: string;
                email: string | null;
                telefone: string | null;
              } | null;
              const desvincular = desvincularCliente.bind(null, obraId, v.cliente_id);
              return (
                <TableRow key={v.cliente_id}>
                  <TableCell className="font-medium">{cliente?.nome ?? "—"}</TableCell>
                  <TableCell>{cliente?.email ?? "—"}</TableCell>
                  <TableCell>{cliente?.telefone ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    <form action={desvincular}>
                      <Button type="submit" variant="ghost" size="sm">
                        Desvincular
                      </Button>
                    </form>
                  </TableCell>
                </TableRow>
              );
            })}
            {!vinculos?.length && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  Nenhum cliente vinculado ainda.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
