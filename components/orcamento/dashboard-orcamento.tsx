import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { BarraEmpilhada } from "@/components/charts/barra-empilhada";
import { BarrasRanking } from "@/components/charts/barras-ranking";
import { Package, Wrench, HardHat, HelpCircle } from "lucide-react";
import type { ItemDaLista } from "./lista-por-etapa";

function moeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function Numero({
  rotulo,
  valor,
  detalhe,
}: {
  rotulo: string;
  valor: string;
  detalhe?: string;
}) {
  return (
    <Card>
      <CardContent className="py-4">
        <p className="text-sm text-muted-foreground">{rotulo}</p>
        <p className="font-heading text-2xl font-semibold tabular-nums">{valor}</p>
        {detalhe && <p className="text-xs text-muted-foreground">{detalhe}</p>}
      </CardContent>
    </Card>
  );
}

const CATEGORIAS = [
  { chave: "material", rotulo: "Material", cor: "bg-grafico-a-vencer", icone: <Package className="size-3.5" aria-hidden /> },
  { chave: "servico", rotulo: "Serviço", cor: "bg-grafico-pago", icone: <Wrench className="size-3.5" aria-hidden /> },
  { chave: "mao_de_obra", rotulo: "Mão de obra", cor: "bg-grafico-enviado", icone: <HardHat className="size-3.5" aria-hidden /> },
  { chave: "sem", rotulo: "Sem categoria", cor: "bg-grafico-trilho", icone: <HelpCircle className="size-3.5" aria-hidden /> },
] as const;

/**
 * Para onde o dinheiro do orçamento está indo.
 *
 * A tela mostrava só o total — um número de seis dígitos que não responde a
 * pergunta que o engenheiro faz ao abrir o orçamento: qual etapa está pesando,
 * e o quanto disso é material contra mão de obra.
 *
 * A concentração (quantas etapas somam 80%) é o atalho para a curva ABC: num
 * orçamento de 23 etapas, costumam ser 5 ou 6 que decidem o custo da obra, e
 * são essas que merecem cotação apertada.
 */
export function DashboardOrcamento({
  itens,
  metragem,
}: {
  itens: ItemDaLista[];
  /** Área construída, para o custo por m². Null quando não cadastrada. */
  metragem: number | null;
}) {
  const total = itens.reduce((soma, item) => soma + item.preco_total, 0);

  if (!itens.length || total <= 0) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-sm text-muted-foreground">
          O orçamento ainda não tem valores para distribuir.
        </CardContent>
      </Card>
    );
  }

  // --- por etapa ---
  const porEtapa = new Map<string, number>();
  for (const item of itens) {
    const chave = item.etapa || "Sem etapa";
    porEtapa.set(chave, (porEtapa.get(chave) ?? 0) + item.preco_total);
  }
  const etapasOrdenadas = [...porEtapa.entries()]
    .map(([rotulo, valor]) => ({ rotulo, valor }))
    .sort((a, b) => b.valor - a.valor);

  // Quantas etapas somam 80% do orçamento — a cabeça da curva ABC.
  let acumulado = 0;
  let etapasAte80 = 0;
  for (const etapa of etapasOrdenadas) {
    if (acumulado >= total * 0.8) break;
    acumulado += etapa.valor;
    etapasAte80++;
  }

  // --- por categoria ---
  const porCategoria = new Map<string, number>();
  for (const item of itens) {
    const chave = item.tipo_item ?? "sem";
    porCategoria.set(chave, (porCategoria.get(chave) ?? 0) + item.preco_total);
  }
  const segmentos = CATEGORIAS.map((c) => ({
    rotulo: c.rotulo,
    valor: porCategoria.get(c.chave) ?? 0,
    cor: c.cor,
    icone: c.icone,
  })).filter((s) => s.valor > 0);

  const semCategoria = porCategoria.get("sem") ?? 0;

  // --- os maiores itens ---
  const maioresItens = [...itens]
    .sort((a, b) => b.preco_total - a.preco_total)
    .slice(0, 5)
    .map((item) => ({ rotulo: item.descricao, valor: item.preco_total }));

  const maiorEtapa = etapasOrdenadas[0];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Numero
          rotulo="Valor orçado total"
          valor={moeda(total)}
          detalhe={`${itens.length} ${itens.length === 1 ? "item" : "itens"} em ${porEtapa.size} ${porEtapa.size === 1 ? "etapa" : "etapas"}`}
        />
        <Numero
          rotulo="Custo por m²"
          valor={metragem && metragem > 0 ? moeda(total / metragem) : "—"}
          detalhe={
            metragem && metragem > 0
              ? `sobre ${metragem.toLocaleString("pt-BR")} m² de área construída`
              : "informe a metragem no cadastro da obra"
          }
        />
        <Numero
          rotulo="Etapa mais pesada"
          valor={`${((maiorEtapa.valor / total) * 100).toFixed(0)}%`}
          detalhe={`${maiorEtapa.rotulo} · ${moeda(maiorEtapa.valor)}`}
        />
        <Numero
          rotulo="Concentração"
          valor={`${etapasAte80} ${etapasAte80 === 1 ? "etapa" : "etapas"}`}
          detalhe={`somam 80% do orçamento — são elas que decidem o custo`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Distribuição por etapa</CardTitle>
          </CardHeader>
          <CardContent>
            <BarrasRanking linhas={etapasOrdenadas} limite={10} />
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Material, serviço e mão de obra</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <BarraEmpilhada segmentos={segmentos} />
              {semCategoria > 0 && (
                <p className="text-xs text-muted-foreground">
                  {moeda(semCategoria)} sem categoria — a classificação se escolhe no campo
                  &ldquo;Categoria&rdquo; de cada item.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Os 5 maiores itens</CardTitle>
            </CardHeader>
            <CardContent>
              <BarrasRanking linhas={maioresItens} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
