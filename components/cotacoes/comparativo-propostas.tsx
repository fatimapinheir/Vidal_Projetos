import type { ReactNode } from "react";
import Link from "next/link";
import { Paperclip, Truck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { formatDateBR } from "@/lib/format-date";
import { rotuloDesconto } from "@/lib/compras/total-item";
import { PropostaStatusBadge } from "@/components/cotacoes/status-badges";
import type { PropostaStatus } from "@/lib/types/database.types";

function moeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const FORMA_PAGAMENTO: Record<string, string> = {
  dinheiro: "Dinheiro",
  pix: "Pix",
  boleto: "Boleto",
  cartao_credito: "Cartão de crédito",
  cartao_debito: "Cartão de débito",
  transferencia: "Transferência",
  cheque: "Cheque",
  outro: "Outro",
};

export type PropostaParaComparar = {
  id: string;
  fornecedor: string;
  valorTotal: number;
  formaPagamento: string;
  entregaPrevista: string | null;
  observacoes: string | null;
  status: PropostaStatus;
  parcelas: { numero: number; valor: number; vencimento: string }[];
  itens: {
    descricao: string;
    unidade: string;
    quantidade: number;
    precoUnitario: number;
    descontoTipo: "valor" | "percentual" | null;
    descontoValor: number | null;
    totalLiquido: number;
  }[];
  anexos: { nome: string; url: string | null }[];
};

/**
 * As propostas lado a lado — a tela que justifica a cotação existir.
 *
 * Cartões empilhados, e não uma grade com fornecedores nas colunas. A grade é o
 * formato clássico do mapa de cotação e é melhor quando todos cotaram os mesmos
 * itens; aqui cada proposta tem a SUA lista (um fornecedor não tem a marca,
 * outro cota o pacote fechado), e a grade teria mais buraco que número. Em
 * cartão, cada proposta se explica inteira, e a comparação acontece no que
 * realmente se compara: valor, prazo e condição.
 *
 * O selo "menor valor" é rótulo, não recomendação. Prazo de entrega e
 * fornecedor pesam tanto quanto preço numa obra, e marcar a mais barata como
 * "melhor" empurraria uma decisão que não é do sistema.
 *
 * A diferença em percentual vem contra a mais barata, não contra a média: é a
 * pergunta que se faz olhando duas propostas ("quanto mais caro é esta?").
 */
export function ComparativoPropostas({
  propostas,
  acoes,
  linkDaOrdem,
}: {
  propostas: PropostaParaComparar[];
  /** Botões da proposta — diferentes para o engenheiro e para o cliente. */
  acoes?: (proposta: PropostaParaComparar) => ReactNode;
  /** Para onde vai o link da ordem gerada, quando a proposta foi escolhida. */
  linkDaOrdem?: (proposta: PropostaParaComparar) => string | null;
}) {
  const menorValor = propostas.length ? Math.min(...propostas.map((p) => p.valorTotal)) : 0;

  return (
    <div className="flex flex-col gap-3">
      {propostas.map((proposta) => {
        const ehMenor = Math.abs(proposta.valorTotal - menorValor) < 0.01;
        const diferenca = menorValor > 0 ? (proposta.valorTotal / menorValor - 1) * 100 : 0;
        const ordem = linkDaOrdem?.(proposta) ?? null;

        return (
          <Card
            key={proposta.id}
            /* A escolhida se destaca pela borda, não pelo fundo: com três
               cartões, fundo colorido disputa com o conteúdo. */
            className={proposta.status === "escolhida" ? "border-primary" : undefined}
          >
            <CardHeader className="gap-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex flex-col gap-1">
                  <CardTitle className="text-base">{proposta.fornecedor}</CardTitle>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <PropostaStatusBadge status={proposta.status} />
                    {ehMenor && propostas.length > 1 && (
                      <Badge variant="secondary">Menor valor</Badge>
                    )}
                  </div>
                </div>

                <div className="text-right">
                  <p className="text-lg font-semibold">{moeda(proposta.valorTotal)}</p>
                  {!ehMenor && propostas.length > 1 && (
                    <p className="text-xs text-muted-foreground">
                      {diferenca.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% acima da
                      menor
                    </p>
                  )}
                </div>
              </div>
            </CardHeader>

            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
                <span className="text-muted-foreground">
                  Pagamento:{" "}
                  <span className="text-foreground">
                    {FORMA_PAGAMENTO[proposta.formaPagamento] ?? proposta.formaPagamento}
                  </span>
                </span>
                {proposta.entregaPrevista && (
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                    <Truck className="size-3.5" aria-hidden />
                    Entrega:{" "}
                    <span className="text-foreground">
                      {formatDateBR(proposta.entregaPrevista)}
                    </span>
                  </span>
                )}
              </div>

              {proposta.observacoes && (
                <p className="rounded-lg bg-muted/40 p-3 text-sm">{proposta.observacoes}</p>
              )}

              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>Un.</TableHead>
                      <TableHead>Qtd.</TableHead>
                      <TableHead>Preço unit.</TableHead>
                      <TableHead>Desconto</TableHead>
                      <TableHead>Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {proposta.itens.map((item, i) => (
                      <TableRow key={i}>
                        <TableCell className="max-w-56 truncate">{item.descricao}</TableCell>
                        <TableCell>{item.unidade}</TableCell>
                        <TableCell>{item.quantidade}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          {moeda(item.precoUnitario)}
                        </TableCell>
                        <TableCell className="text-xs">
                          {rotuloDesconto(item.descontoTipo, item.descontoValor) ?? "—"}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {moeda(item.totalLiquido)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* O parcelamento é parte da proposta: dois fornecedores no mesmo
                  valor, um à vista e outro em três vezes, não são a mesma
                  proposta. */}
              {proposta.parcelas.length > 0 && (
                <div className="flex flex-wrap gap-2 text-sm">
                  {proposta.parcelas.map((p) => (
                    <span key={p.numero} className="rounded-lg border px-2.5 py-1">
                      {proposta.parcelas.length > 1 && (
                        <span className="text-muted-foreground">{p.numero}ª </span>
                      )}
                      {moeda(p.valor)}
                      <span className="text-muted-foreground"> — {formatDateBR(p.vencimento)}</span>
                    </span>
                  ))}
                </div>
              )}

              {proposta.anexos.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {proposta.anexos.map((anexo, i) =>
                    anexo.url ? (
                      <a
                        key={i}
                        href={anexo.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-sm underline-offset-4 hover:underline"
                      >
                        <Paperclip className="size-3.5" aria-hidden />
                        {anexo.nome}
                      </a>
                    ) : (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-dashed px-2.5 py-1 text-sm text-muted-foreground"
                      >
                        <Paperclip className="size-3.5" aria-hidden />
                        {anexo.nome} (não foi possível abrir)
                      </span>
                    )
                  )}
                </div>
              )}

              {ordem && (
                <Link
                  href={ordem}
                  className="text-sm font-medium underline underline-offset-4"
                >
                  Ver a ordem de compra gerada
                </Link>
              )}

              {acoes && <div className="flex flex-wrap gap-2">{acoes(proposta)}</div>}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
