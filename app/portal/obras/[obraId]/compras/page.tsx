import { notFound } from "next/navigation";
import {
  HardHat,
  Info,
  Lightbulb,
  PackageCheck,
  PieChart,
  Wallet,
  Wrench,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Rosca } from "@/components/charts/rosca";
import { carregarVisaoGeral } from "@/lib/obras/visao-geral";
import { carregarLancamentos } from "@/lib/compras/lancamentos";
import { TabelaLancamentos } from "@/components/compras/tabela-lancamentos";
import { ResumoFormasPagamento } from "@/components/compras/resumo-formas-pagamento";

function moeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/**
 * Lançamentos financeiros da obra, pelos olhos do cliente.
 *
 * A tela responde, nesta ordem: quanto já saiu, o que vence agora, e para onde
 * o dinheiro foi. A lista abre na janela de quinze dias porque é a pergunta de
 * quem precisa se organizar — "todos os pagamentos" fica a uma aba de
 * distância, para quem veio conferir uma parcela específica.
 *
 * O que NÃO está aqui, de propósito:
 *
 * - **Valor e saldo do orçamento.** São o assunto da tela de orçamento; aqui
 *   virariam dois números grandes competindo com a lista, que é o motivo de a
 *   tela existir. O percentual já gasto fica, dentro do único cartão de
 *   resumo — ele diz "onde estou" sem abrir um segundo assunto.
 * - **Qualquer menção a atraso.** Parcela com vencimento passado aparece como
 *   "Pendente", igual às outras, e sem contagem de dias.
 * - **Caixas de seleção nas linhas.** O cliente não aprova, não paga e não
 *   exporta nada por aqui; seleção múltipla sem ação é um controle que não
 *   leva a lugar nenhum.
 */
export default async function PortalLancamentosPage({
  params,
}: {
  params: Promise<{ obraId: string }>;
}) {
  const { obraId } = await params;
  const supabase = await createClient();

  const [{ data: obra }, dados, lancamentos] = await Promise.all([
    supabase.from("obras").select("nome").eq("id", obraId).maybeSingle(),
    // Mesmo carregador da visão geral: o total gasto e a rosca de categorias
    // precisam bater com os da tela inicial. Duas contas para o mesmo número
    // divergem na primeira vez que alguém mexe numa delas.
    carregarVisaoGeral(supabase, obraId),
    carregarLancamentos(supabase, obraId),
  ]);

  if (!obra) notFound();

  const base = `/portal/obras/${obraId}`;
  const temOrcamento = dados.orcado > 0;

  const custos = [
    {
      rotulo: "Materiais",
      valor: dados.materiais,
      cor: "fill-chart-1",
      icone: <PackageCheck className="size-3.5" aria-hidden />,
    },
    {
      rotulo: "Mão de obra",
      valor: dados.custoMaoDeObra,
      cor: "fill-grafico-a-vencer",
      icone: <HardHat className="size-3.5" aria-hidden />,
    },
    {
      rotulo: "Equipamentos",
      valor: dados.custoLocacoes,
      cor: "fill-grafico-pago",
      icone: <Wrench className="size-3.5" aria-hidden />,
    },
  ].filter((c) => c.valor > 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-accent">
          <Wallet className="size-6 text-primary-texto" aria-hidden />
        </span>
        <div>
          <h1 className="font-heading text-2xl leading-tight font-semibold">
            Lançamentos financeiros
          </h1>
          <p className="text-sm text-muted-foreground">
            Acompanhe os pagamentos da sua obra de forma simples e organizada.
          </p>
        </div>
      </div>

      {/*
        A lateral só fica ao LADO em telas muito largas (2xl).
        
        A tabela tem sete colunas e pede ~900px. Numa tela de 1440 sobram 1160
        depois do menu, e dividir isso com uma coluna de 360 deixaria a tabela
        com 700 — rolando na horizontal para ler o status, que é justamente o
        que o cliente veio ver. Abaixo de 2xl os três cartões descem e viram
        uma fileira de três, que é leitura melhor do que uma tabela espremida.
      */}
      <div className="flex flex-col gap-4 2xl:flex-row 2xl:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <Card>
            <CardContent className="flex flex-col gap-2 py-4">
              <div className="flex items-center gap-3">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent">
                  <Wallet className="size-5 text-primary-texto" aria-hidden />
                </span>
                <div>
                  <p className="text-sm text-muted-foreground">Total já gasto</p>
                  <p className="font-heading text-2xl font-semibold">
                    {moeda(dados.custoTotal)}
                  </p>
                </div>
              </div>
              {temOrcamento && (
                <>
                  <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-grafico-trilho">
                    <div
                      className="h-full rounded-full bg-chart-1"
                      style={{ width: `${Math.min(100, dados.percentualFinanceiro)}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {dados.percentualFinanceiro.toFixed(1).replace(".", ",")}% do orçamento total
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="gap-0 overflow-hidden p-0">
            <TabelaLancamentos lancamentos={lancamentos.lancamentos} base={base} />

            <div className="m-4 mt-2 flex items-start gap-3 rounded-xl bg-accent/60 p-3 text-sm">
              <Info className="mt-0.5 size-4 shrink-0 text-primary-texto" aria-hidden />
              <p className="leading-snug">
                Os pagamentos exibidos são referentes apenas às ordens de compra e serviços da
                sua obra. A gestão de cotações e lançamentos é feita pelo engenheiro
                responsável.
              </p>
            </div>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-3 2xl:w-[360px] 2xl:shrink-0 2xl:grid-cols-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <PieChart className="size-4 text-primary-texto" aria-hidden />
                Gastos por categoria
              </CardTitle>
            </CardHeader>
            <CardContent>
              {dados.custoTotal > 0 ? (
                <Rosca
                  valorCentral={moeda(dados.custoTotal)}
                  rotuloCentral="Total gasto"
                  fatias={custos}
                  className="sm:flex-col sm:items-stretch"
                />
              ) : (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Nenhum gasto registrado ainda.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Wallet className="size-4 text-primary-texto" aria-hidden />
                Resumo por tipo de pagamento
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResumoFormasPagamento resumo={lancamentos.resumoPorForma} />
            </CardContent>
          </Card>

          <Card className="border-atencao/30 bg-atencao/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Lightbulb className="size-4 text-atencao" aria-hidden />
                Dica
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Mantenha seus pagamentos em dia para evitar juros e garantir o bom andamento da
                sua obra.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
