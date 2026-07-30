import { createClient } from "@/lib/supabase/server";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { NovoFornecedorDialog } from "./novo-fornecedor-dialog";

export default async function FornecedoresPage() {
  const supabase = await createClient();
  const { data: fornecedores } = await supabase
    .from("fornecedores")
    .select("*")
    .order("nome");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-lg font-semibold">Fornecedores</h1>
          <p className="text-sm text-muted-foreground">
            Cadastro de fornecedores usados nas compras das obras.
          </p>
        </div>
        <NovoFornecedorDialog />
      </div>

      <div className="overflow-x-auto rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>CNPJ/CPF</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Email</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {fornecedores?.map((f) => (
              <TableRow key={f.id}>
                <TableCell className="font-medium">{f.nome}</TableCell>
                <TableCell>{f.cnpj_cpf ?? "—"}</TableCell>
                <TableCell>{f.telefone ?? "—"}</TableCell>
                <TableCell>{f.email ?? "—"}</TableCell>
              </TableRow>
            ))}
            {!fornecedores?.length && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  Nenhum fornecedor cadastrado ainda.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
