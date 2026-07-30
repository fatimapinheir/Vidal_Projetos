import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { NovoTrabalhadorDialog } from "./novo-trabalhador-dialog";

export default async function TrabalhadoresPage() {
  const supabase = await createClient();
  const { data: trabalhadores } = await supabase
    .from("trabalhadores")
    .select("*")
    .order("nome");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-lg font-semibold">Equipe</h1>
          <p className="text-sm text-muted-foreground">
            Trabalhadores disponíveis para alocar nas obras.
          </p>
        </div>
        <NovoTrabalhadorDialog />
      </div>

      <div className="overflow-x-auto rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Função</TableHead>
              <TableHead>Diária padrão</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {trabalhadores?.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-medium">{t.nome}</TableCell>
                <TableCell>{t.funcao ?? "—"}</TableCell>
                <TableCell>
                  {t.valor_diaria_padrao
                    ? t.valor_diaria_padrao.toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })
                    : "—"}
                </TableCell>
                <TableCell>{t.telefone ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={t.ativo ? "default" : "secondary"}>
                    {t.ativo ? "Ativo" : "Inativo"}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
            {!trabalhadores?.length && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  Nenhum trabalhador cadastrado ainda.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
