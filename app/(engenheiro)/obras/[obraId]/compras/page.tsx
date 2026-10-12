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
import { ExcluirCompraDialog } from "@/components/compras/excluir-compra-dialog";
import {
  LancamentosSemEtapa,
  type LancamentoSemEtapa,
} from "@/components/compras/lancamentos-sem-etapa";
import { etapasDoOrcamentoAtivo } from "@/lib/compras/etapa-orcamento";
import { Paginacao } from "@/components/ui/paginacao";
import { faixaDaPagina, lerPagina, POR_PAGINA_PADRAO } from "@/lib/paginacao";
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
  searchParams,
}: {
  params: Promise<{ obraId: string }>;
  searchParams: Promise<{ pagina?: string }>;
}) {
  const { obraId } = await params;
  const { pagina: paginaParam } = await searchParams;
  const supabase = await createClient();

  /*
   * A contagem vem antes das linhas porque é ela que define a fatia.
   *
   * `head: true` não traz dado nenhum — só o total no cabeçalho —, então é uma
   * consulta barata mesmo com a obra cheia.
   */
  const { count } = await supabase
    .from("compras")
    .select("id", { count: "exact", head: true })
    .eq("obra_id", obraId);

  const total = count ?? 0;
  const { pagina, de, ate } = faixaDaPagina(lerPagina(paginaParam), total);

  const { data: compras } = await supabase
    .from("compras")
    .select("*, fornecedores(nome)")
    .eq("obra_id", obraId)
    .order("created_at", { ascending: false })
    .range(de, ate);

  const idsNaPagina = (compras ?? []).map((c) => c.id);

  const [{ data: parcelas }, etapasOrcamento] = await Promise.all([
    /*
     * Só as parcelas das ordens DESTA página.
     *
     * Antes vinham as da obra inteira, numa consulta sem limite: numa obra com
     * algumas centenas de ordens isso passaria das 1000 linhas que o PostgREST
     * devolve, e os selos de situação começariam a sair errados — sem erro
     * nenhum, só parcela faltando.
     */
    idsNaPagina.length
      ? supabase.from("vw_compra_parcelas").select("*").in("compra_id", idsNaPagina)
      : Promise.resolve({ data: [] as never[] }),
    etapasDoOrcamentoAtivo(supabase, obraId),
  ]);

  /*
   * Lançamentos sem etapa que vieram do cliente.
   *
   * O corte é "quem registrou é cliente", não "está sem etapa": o lançamento
   * do próprio engenheiro sem etapa foi escolha dele — o campo estava na tela
   * e ele marcou "não vincular". Cobrar isso de volta seria o sistema
   * discordando de uma decisão que ele tomou.
   *
   * Uma consulta só para os papéis, e só dos candidatos: a lista já é por
   * obra, e perguntar o papel de cada criador linha a linha seria uma dúzia de
   * idas ao banco para desenhar um aviso.
   */
  const candidatos = (compras ?? []).filter(
    (c) => c.eh_lancamento && !c.orcamento_etapa && c.criado_por
  );

  const { data: criadores } = candidatos.length
    ? await supabase
        .from("profiles")
        .select("id, nome, role")
        .in("id", [...new Set(candidatos.map((c) => c.criado_por!))])
    : { data: null };

  const clientePorId = new Map(
    (criadores ?? []).filter((p) => p.role === "cliente").map((p) => [p.id, p.nome])
  );

  const lancamentosSemEtapa: LancamentoSemEtapa[] = candidatos
    .filter((c) => clientePorId.has(c.criado_por!))
    .map((c) => ({
      id: c.id,
      descricao: c.descricao,
      valor: c.valor_total,
      fornecedor: (c.fornecedores as unknown as { nome: string } | null)?.nome ?? null,
      registradoPor: clientePorId.get(c.criado_por!) ?? "cliente",
    }));

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

      <LancamentosSemEtapa lancamentos={lancamentosSemEtapa} etapas={etapasOrcamento} />

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
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        nativeButton={false}
                        render={<Link href={`/obras/${obraId}/compras/${c.id}`}>Abrir</Link>}
                      />
                      <ExcluirCompraDialog
                        compraId={c.id}
                        descricao={c.descricao}
                        ehLancamento={c.eh_lancamento}
                      />
                    </div>
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

      <Paginacao
        pagina={pagina}
        total={total}
        porPagina={POR_PAGINA_PADRAO}
        caminho={`/obras/${obraId}/compras`}
        rotulo="registros"
      />
    </div>
  );
}
