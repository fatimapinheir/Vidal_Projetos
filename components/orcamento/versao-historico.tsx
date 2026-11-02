"use client";

import { useState, useTransition } from "react";
import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { formatDateBR } from "@/lib/format-date";
import { buscarItensDaVersao } from "@/app/actions/orcamento";

type ItemDaVersao = {
  id: string;
  codigo_sinapi: string | null;
  descricao: string;
  unidade: string;
  quantidade: number;
  preco_unitario: number;
  preco_total: number;
  etapa: string | null;
};

const moeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/**
 * Uma versão substituída do orçamento, com os itens buscados ao abrir.
 *
 * Era um `<details>` que já vinha com os itens dentro — e para montar o
 * cabeçalho ("227 itens · R$ 486.000") a tela carregava as 227 linhas de cada
 * versão, a cada abertura do orçamento, para um bloco que nasce fechado.
 *
 * Contagem e total agora vêm prontos de `vw_orcamento_versao_resumo`. As linhas
 * só são buscadas no primeiro clique, e ficam em memória depois dele — reabrir
 * não vai ao servidor de novo.
 */
export function VersaoHistorico({
  obraId,
  versao,
}: {
  obraId: string;
  versao: {
    id: string;
    titulo: string | null;
    mes_referencia: string | null;
    created_at: string;
    itens: number;
    total: number;
  };
}) {
  const [aberto, setAberto] = useState(false);
  const [itens, setItens] = useState<ItemDaVersao[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, iniciar] = useTransition();

  function alternar() {
    const proximo = !aberto;
    setAberto(proximo);

    // Busca uma vez só: `itens` já preenchido significa que a versão foi aberta
    // antes nesta mesma visita.
    if (!proximo || itens !== null || carregando) return;

    iniciar(async () => {
      const r = await buscarItensDaVersao(obraId, versao.id);
      if (r.error) {
        setErro(r.error);
        return;
      }
      setItens(r.itens);
    });
  }

  const titulo =
    versao.titulo ||
    (versao.mes_referencia ? `Referência ${formatDateBR(versao.mes_referencia)}` : "Sem título");

  return (
    <div className="rounded-xl border">
      <button
        type="button"
        onClick={alternar}
        aria-expanded={aberto}
        className="flex w-full flex-wrap items-center justify-between gap-2 px-3 py-2 text-left text-sm font-medium transition-colors hover:bg-muted/50"
      >
        <span className="flex min-w-0 items-center gap-1.5">
          <ChevronRight
            className={`size-4 shrink-0 text-muted-foreground transition-transform ${aberto ? "rotate-90" : ""}`}
            aria-hidden
          />
          <span className="min-w-0">
            {titulo}
            <span className="ml-2 font-normal text-muted-foreground">
              substituída em {formatDateBR(versao.created_at)}
            </span>
          </span>
        </span>
        <span className="text-muted-foreground">
          {versao.itens} {versao.itens === 1 ? "item" : "itens"} · {moeda(versao.total)}
        </span>
      </button>

      {aberto && (
        <div className="border-t">
          {carregando && (
            <p className="px-3 py-3 text-sm text-muted-foreground">Carregando os itens...</p>
          )}
          {erro && <p className="px-3 py-3 text-sm text-destructive">{erro}</p>}
          {itens && !itens.length && (
            <p className="px-3 py-3 text-center text-sm text-muted-foreground">
              Nenhum item registrado nessa versão.
            </p>
          )}
          {!!itens?.length && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Etapa</TableHead>
                    <TableHead>Un.</TableHead>
                    <TableHead>Qtd.</TableHead>
                    <TableHead>Preço unit.</TableHead>
                    <TableHead>Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itens.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="text-xs">{item.codigo_sinapi ?? "—"}</TableCell>
                      <TableCell className="max-w-64 truncate">{item.descricao}</TableCell>
                      <TableCell>
                        {item.etapa ? <Badge variant="outline">{item.etapa}</Badge> : "—"}
                      </TableCell>
                      <TableCell>{item.unidade}</TableCell>
                      <TableCell>{item.quantidade}</TableCell>
                      <TableCell>{moeda(item.preco_unitario)}</TableCell>
                      <TableCell>{moeda(item.preco_total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
