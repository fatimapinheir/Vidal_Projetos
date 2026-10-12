import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { BarrasRanking } from "@/components/charts/barras-ranking";
import { ListaPorEtapa, type ItemDaLista } from "@/components/orcamento/lista-por-etapa";

function moeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/**
 * O orçamento como o cliente precisa ver: no que o dinheiro dele vai.
 *
 * Mostra a versão ATIVA — é a única que a regra de acesso libera, e é o que
 * está valendo. Rascunho em edição não aparece aqui de propósito: preço em
 * revisão não é compromisso, e ver o número mudando sozinho entre uma visita e
 * outra corrói a confiança mais do que não ver.
 *
 * O comparativo com o comprado conta só ordem aprovada ou paga. Cotada ainda é
 * proposta e pode ser recusada — somá-la mostraria ao cliente um gasto que
 * talvez nunca aconteça.
 */
export default async function PortalOrcamentoPage({
  params,
}: {
  params: Promise<{ obraId: string }>;
}) {
  const { obraId } = await params;
  const supabase = await createClient();

  const [{ data: obra }, { data: versao }] = await Promise.all([
    supabase.from("obras").select("nome, metragem_quadrada").eq("id", obraId).maybeSingle(),
    supabase
      .from("orcamento_versoes")
      .select("id, titulo, etapas")
      .eq("obra_id", obraId)
      .eq("status", "ativa")
      .maybeSingle(),
  ]);

  // A regra de acesso devolve vazio para obra que não é do cliente.
  if (!obra) notFound();

  if (!versao) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="font-heading text-lg font-semibold">Orçamento</h1>
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          O orçamento desta obra ainda está sendo montado.
        </p>
      </div>
    );
  }

  const [{ data: itens }, { data: compras }] = await Promise.all([
    supabase
      .from("orcamento_itens")
      .select("*")
      .eq("orcamento_versao_id", versao.id)
      .order("ordem"),
    supabase
      .from("compras")
      .select("valor_total, status, orcamento_etapa")
      .eq("obra_id", obraId)
      .not("orcamento_etapa", "is", null),
  ]);

  const lista = (itens ?? []) as ItemDaLista[];
  const total = lista.reduce((soma, item) => soma + item.preco_total, 0);

  const COMPROMETIDAS = ["aprovada", "paga"];
  const compradoPorEtapa = new Map<string, number>();
  for (const compra of compras ?? []) {
    if (!compra.orcamento_etapa || !COMPROMETIDAS.includes(compra.status)) continue;
    compradoPorEtapa.set(
      compra.orcamento_etapa,
      (compradoPorEtapa.get(compra.orcamento_etapa) ?? 0) + compra.valor_total
    );
  }

  const orcadoPorEtapa = new Map<string, number>();
  for (const etapa of versao.etapas) orcadoPorEtapa.set(etapa, 0);
  for (const item of lista) {
    const chave = item.etapa || "Sem etapa";
    orcadoPorEtapa.set(chave, (orcadoPorEtapa.get(chave) ?? 0) + item.preco_total);
  }
  for (const etapa of compradoPorEtapa.keys()) {
    if (!orcadoPorEtapa.has(etapa)) orcadoPorEtapa.set(etapa, 0);
  }

  const comparativo = [...orcadoPorEtapa.entries()].map(([etapa, orcado]) => ({
    etapa,
    orcado,
    comprado: compradoPorEtapa.get(etapa) ?? 0,
  }));
  const totalComprado = comparativo.reduce((s, l) => s + l.comprado, 0);

  const distribuicao = comparativo
    .filter((l) => l.orcado > 0)
    .map((l) => ({ rotulo: l.etapa, valor: l.orcado }));

  const metragem = obra.metragem_quadrada;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-heading text-lg font-semibold">Orçamento</h1>
        <p className="text-sm text-muted-foreground">
          O orçamento aprovado da sua obra, etapa por etapa
          {versao.titulo ? ` — ${versao.titulo}` : ""}.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="py-4">
            <p className="text-sm text-muted-foreground">Valor orçado</p>
            {/* As três cores dizem papéis diferentes, e são as mesmas do painel
                Orçamento x Gasto da tela inicial: verde o que a obra tem,
                âmbar o que já saiu, azul o indicador de referência. Repetir a
                convenção é o que a torna legível sem legenda. */}
            <p className="font-heading text-2xl font-semibold tabular-nums text-sucesso">
              {moeda(total)}
            </p>
            <p className="text-xs text-muted-foreground">
              {lista.length} {lista.length === 1 ? "item" : "itens"} em {orcadoPorEtapa.size}{" "}
              {orcadoPorEtapa.size === 1 ? "etapa" : "etapas"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-sm text-muted-foreground">Já comprado</p>
            <p className="font-heading text-2xl font-semibold tabular-nums text-atencao">
              {moeda(totalComprado)}
            </p>
            <p className="text-xs text-muted-foreground">
              {total > 0 ? `${((totalComprado / total) * 100).toFixed(1)}% do orçado` : "—"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-sm text-muted-foreground">Custo por m²</p>
            <p className="font-heading text-2xl font-semibold tabular-nums text-primary-texto">
              {metragem && metragem > 0 ? moeda(total / metragem) : "—"}
            </p>
            {!!metragem && metragem > 0 && (
              <p className="text-xs text-muted-foreground">
                sobre {metragem.toLocaleString("pt-BR")} m² de área construída
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/*
        Os itens vêm ANTES dos gráficos.
        
        Estavam no fim, depois de duas análises, e a ordem contava a história
        ao contrário: o cliente abre esta tela para ver o que foi orçado, item
        por item — essa é a resposta. Distribuição por etapa e comparativo são
        leitura sobre a resposta, e leitura sobre vem depois do que se lê.
      */}
      <div>
        <h2 className="mb-2 font-heading text-base font-semibold">Itens do orçamento</h2>
        <ListaPorEtapa
          itens={lista}
          etapasDeclaradas={versao.etapas}
          rotuloTotal="Total do orçamento"
          destacarTotal
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Onde está o orçamento</CardTitle>
        </CardHeader>
        <CardContent>
          <BarrasRanking linhas={distribuicao} limite={10} />
        </CardContent>
      </Card>

      {!!totalComprado && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Orçado × comprado por etapa</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Etapa</TableHead>
                    <TableHead className="text-right">Orçado</TableHead>
                    <TableHead className="text-right">Comprado</TableHead>
                    <TableHead>%</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {comparativo.map((linha) => {
                    const pct = linha.orcado > 0 ? (linha.comprado / linha.orcado) * 100 : 0;
                    return (
                      <TableRow key={linha.etapa}>
                        <TableCell className="max-w-64 truncate font-medium">
                          {linha.etapa}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {moeda(linha.orcado)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {linha.comprado > 0 ? moeda(linha.comprado) : "—"}
                        </TableCell>
                        <TableCell>
                          {linha.orcado > 0 && <Badge variant="outline">{pct.toFixed(0)}%</Badge>}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

    </div>
  );
}
