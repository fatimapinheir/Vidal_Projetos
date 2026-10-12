import { Fragment, type ReactNode } from "react";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";

export type ItemDaLista = {
  id: string;
  codigo_sinapi: string | null;
  descricao: string;
  unidade: string;
  quantidade: number;
  preco_unitario: number;
  preco_total: number;
  etapa: string | null;
  tipo_item: string | null;
};

function moeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/**
 * Agrupa por etapa, trazendo as etapas declaradas que ainda não têm item.
 *
 * As declaradas vêm primeiro, na ordem em que foram declaradas; etapa que só
 * existe em item (de importação, por exemplo) entra no fim.
 */
export function agruparPorEtapa(itens: ItemDaLista[], etapasDeclaradas: string[] = []) {
  const grupos = new Map<string, ItemDaLista[]>();
  for (const etapa of etapasDeclaradas) grupos.set(etapa, []);

  for (const item of itens) {
    const chave = item.etapa || "Sem etapa";
    if (!grupos.has(chave)) grupos.set(chave, []);
    grupos.get(chave)!.push(item);
  }
  return grupos;
}

/**
 * O orçamento em uma tabela só, com as etapas como linhas de grupo.
 *
 * Era uma tabela por etapa no rascunho e uma tabela corrida no ativo. As duas
 * tinham problema: várias tabelas significam várias larguras de coluna, então
 * nenhum cabeçalho serve para todas; e a tabela corrida perdia o agrupamento,
 * com a etapa repetida como selo em cada linha.
 *
 * Uma tabela com `table-fixed` resolve os dois: cabeçalho único no topo, todas
 * as linhas alinhadas sob ele, e a etapa como faixa de grupo. Sem isso, item
 * de uma unidade só (quantidade 1) ficava ambíguo — não dava para saber se o
 * número da direita era preço unitário ou total.
 */
export function ListaPorEtapa({
  itens,
  etapasDeclaradas,
  acoesItem,
  acoesEtapa,
  rodapeEtapa,
  rotuloTotal = "Total",
  destacarTotal = false,
}: {
  itens: ItemDaLista[];
  etapasDeclaradas: string[];
  /** Botões por item (editar, remover). Ausente, a lista é só leitura. */
  acoesItem?: (item: ItemDaLista) => ReactNode;
  /** Botões no cabeçalho da etapa (remover etapa). */
  acoesEtapa?: (etapa: string, itens: ItemDaLista[]) => ReactNode;
  /** Linha ao fim de cada etapa (adicionar item). */
  rodapeEtapa?: (etapa: string, itens: ItemDaLista[]) => ReactNode;
  rotuloTotal?: string;
  destacarTotal?: boolean;
}) {
  const grupos = agruparPorEtapa(itens, etapasDeclaradas);
  const total = itens.reduce((soma, item) => soma + item.preco_total, 0);
  const editavel = !!acoesItem || !!acoesEtapa || !!rodapeEtapa;
  const colunas = editavel ? 7 : 6;

  if (!grupos.size) {
    return (
      <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
        Nenhum item no orçamento.
      </p>
    );
  }

  return (
    /*
      `bg-card` explícito: a mesma lista aparece dentro de um Card (no rascunho)
      e solta sobre o degradê da página (no ativo). Sem uma superfície própria,
      o `bg-muted/40` da faixa de etapa rendia tons diferentes nos dois lugares
      e a etapa deixava de se separar dos itens no orçamento ativo.
    */
    <div className="overflow-x-auto rounded-xl border bg-card shadow-xs">
      <Table className="min-w-[52rem] table-fixed">
        <colgroup>
          <col className="w-24" />
          <col />
          <col className="w-16" />
          <col className="w-24" />
          <col className="w-32" />
          <col className="w-32" />
          {editavel && <col className="w-20" />}
        </colgroup>
        <TableHeader>
          <TableRow>
            <TableHead>Código</TableHead>
            <TableHead>Descrição</TableHead>
            <TableHead>Un.</TableHead>
            <TableHead className="text-right">Qtd.</TableHead>
            <TableHead className="text-right">Preço unit.</TableHead>
            <TableHead className="text-right">Total</TableHead>
            {editavel && <TableHead />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {[...grupos].map(([etapa, itensDaEtapa]) => {
            const subtotal = itensDaEtapa.reduce((soma, item) => soma + item.preco_total, 0);
            return (
              <Fragment key={etapa}>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableCell colSpan={colunas - 1} className="font-medium">
                    <span className="flex flex-wrap items-center gap-2">
                      {etapa}
                      <span className="text-xs font-normal text-muted-foreground">
                        {itensDaEtapa.length} {itensDaEtapa.length === 1 ? "item" : "itens"}
                      </span>
                      {acoesEtapa?.(etapa, itensDaEtapa)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {moeda(subtotal)}
                  </TableCell>
                </TableRow>

                {itensDaEtapa.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="truncate text-xs text-muted-foreground">
                      {item.codigo_sinapi ?? "—"}
                    </TableCell>
                    <TableCell className="truncate" title={item.descricao}>
                      {item.descricao}
                    </TableCell>
                    <TableCell className="text-xs">{item.unidade}</TableCell>
                    <TableCell className="text-right tabular-nums">{item.quantidade}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {moeda(item.preco_unitario)}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {moeda(item.preco_total)}
                    </TableCell>
                    {editavel && (
                      <TableCell className="text-right">
                        <span className="flex items-center justify-end gap-1">
                          {acoesItem?.(item)}
                        </span>
                      </TableCell>
                    )}
                  </TableRow>
                ))}

                {rodapeEtapa && (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={colunas} className="py-1.5">
                      <span className="flex flex-wrap items-center gap-2">
                        {!itensDaEtapa.length && (
                          <span className="text-xs text-muted-foreground">
                            Nenhum item nesta etapa ainda.
                          </span>
                        )}
                        {rodapeEtapa(etapa, itensDaEtapa)}
                      </span>
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            );
          })}

          <TableRow
            className={
              destacarTotal
                ? "border-t-2 border-primary/40 bg-primary/5 hover:bg-primary/5"
                : "bg-muted/40 hover:bg-muted/40"
            }
          >
            <TableCell colSpan={colunas - 1} className="font-semibold">
              {rotuloTotal}
            </TableCell>
            <TableCell
              className={
                destacarTotal
                  ? "text-right font-heading text-base font-semibold tabular-nums"
                  : "text-right font-semibold tabular-nums"
              }
            >
              {moeda(total)}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}
