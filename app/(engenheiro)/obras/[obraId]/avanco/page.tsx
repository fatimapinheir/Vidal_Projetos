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
import { formatDateBR } from "@/lib/format-date";
import { RegistrarAvancoDialog } from "./registrar-avanco-dialog";

export default async function AvancoObraPage({
  params,
}: {
  params: Promise<{ obraId: string }>;
}) {
  const { obraId } = await params;
  const supabase = await createClient();

  const { data: versaoAtiva } = await supabase
    .from("orcamento_versoes")
    .select("id")
    .eq("obra_id", obraId)
    .eq("status", "ativa")
    .maybeSingle();

  if (!versaoAtiva) {
    return (
      <div className="flex flex-col items-start gap-4">
        <p className="text-sm text-muted-foreground">
          Cadastre um orçamento antes de registrar avanço físico.
        </p>
        <Button
          nativeButton={false}
          render={<Link href={`/obras/${obraId}/orcamento/upload`}>Enviar orçamento</Link>}
        />
      </div>
    );
  }

  const [{ data: itens }, { data: avancos }] = await Promise.all([
    supabase
      .from("orcamento_itens")
      .select("id, descricao, unidade, quantidade")
      .eq("orcamento_versao_id", versaoAtiva.id)
      .order("ordem"),
    supabase.from("vw_avanco_atual").select("*").eq("obra_id", obraId),
  ]);

  const avancoPorItem = new Map(avancos?.map((a) => [a.orcamento_item_id, a]) ?? []);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Registre a quantidade acumulada já executada de cada item do orçamento.
        </p>
        <RegistrarAvancoDialog obraId={obraId} itens={itens ?? []} />
      </div>

      <div className="overflow-x-auto rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead>Un.</TableHead>
              <TableHead>Orçado</TableHead>
              <TableHead>Executado</TableHead>
              <TableHead>%</TableHead>
              <TableHead>Última medição</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {itens?.map((item) => {
              const avanco = avancoPorItem.get(item.id);
              const executado = avanco?.quantidade_executada_acumulada ?? 0;
              const percentual = item.quantidade > 0 ? Math.min((executado / item.quantidade) * 100, 100) : 0;
              return (
                <TableRow key={item.id}>
                  <TableCell className="max-w-64 truncate">{item.descricao}</TableCell>
                  <TableCell>{item.unidade}</TableCell>
                  <TableCell>{item.quantidade}</TableCell>
                  <TableCell>{executado}</TableCell>
                  <TableCell>{percentual.toFixed(0)}%</TableCell>
                  <TableCell>{avanco ? formatDateBR(avanco.data_medicao) : "—"}</TableCell>
                </TableRow>
              );
            })}
            {!itens?.length && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  Nenhum item no orçamento.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
