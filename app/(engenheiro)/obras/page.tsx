import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDateBR } from "@/lib/format-date";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";

const statusLabel: Record<string, string> = {
  planejamento: "Planejamento",
  em_andamento: "Em andamento",
  pausada: "Pausada",
  concluida: "Concluída",
};

const statusVariant: Record<string, "default" | "secondary" | "outline"> = {
  planejamento: "outline",
  em_andamento: "default",
  pausada: "secondary",
  concluida: "secondary",
};

export default async function ObrasPage() {
  const supabase = await createClient();
  const { data: obras } = await supabase
    .from("obras")
    .select("*, obra_tipos(nome)")
    .order("created_at", { ascending: false });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-lg font-semibold">Obras</h1>
          <p className="text-sm text-muted-foreground">Todas as obras em gestão.</p>
        </div>
        <Button nativeButton={false} render={<Link href="/obras/novo">Nova obra</Link>} />
      </div>

      <div className="overflow-x-auto rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Início</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {obras?.map((obra) => (
              <TableRow key={obra.id}>
                <TableCell className="font-medium">{obra.nome}</TableCell>
                <TableCell>{(obra.obra_tipos as unknown as { nome: string } | null)?.nome ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={statusVariant[obra.status]}>
                    {statusLabel[obra.status]}
                  </Badge>
                </TableCell>
                <TableCell>
                  {formatDateBR(obra.data_inicio)}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="outline"
                    size="sm"
                    nativeButton={false}
                    render={<Link href={`/obras/${obra.id}`}>Abrir</Link>}
                  />
                </TableCell>
              </TableRow>
            ))}
            {!obras?.length && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  Nenhuma obra cadastrada ainda.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
