import Link from "next/link";
import { Scale } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { AjudaDaPagina } from "@/components/ui/ajuda-da-pagina";
import { Button } from "@/components/ui/button";
import { formatDateBR } from "@/lib/format-date";
import { CotacaoStatusBadge } from "@/components/cotacoes/status-badges";

function moeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/**
 * As cotações pelos olhos do cliente.
 *
 * O que ele vê aqui é decisão, não histórico de preço — por isso a lista abre
 * pelas que esperam por ele, e as já decididas ficam abaixo. Rascunho não
 * aparece: a policy da 0077 barra, e nem deveria aparecer — comparação pela
 * metade é pior que nenhuma.
 *
 * Cartões e não tabela: são poucos registros, cada um pede uma ação, e no
 * celular uma tabela de seis colunas vira rolagem horizontal em cima de uma
 * decisão.
 */
export default async function PortalCotacoesPage({
  params,
}: {
  params: Promise<{ obraId: string }>;
}) {
  const { obraId } = await params;
  const supabase = await createClient();

  const [{ data: obra }, { data: cotacoes }] = await Promise.all([
    supabase.from("obras").select("nome").eq("id", obraId).maybeSingle(),
    supabase
      .from("vw_cotacoes_lista")
      .select("*")
      .eq("obra_id", obraId)
      .order("created_at", { ascending: false }),
  ]);

  const linhas = cotacoes ?? [];
  const pendentes = linhas.filter((c) => c.status === "aguardando_cliente");
  const decididas = linhas.filter((c) => c.status !== "aguardando_cliente");

  function Linha({ c }: { c: (typeof linhas)[number] }) {
    const menor = c.menor_valor === null ? null : Number(c.menor_valor);
    const maior = c.maior_valor === null ? null : Number(c.maior_valor);

    return (
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium">{c.descricao}</p>
              <CotacaoStatusBadge status={c.status} />
            </div>
            <p className="text-sm text-muted-foreground">
              {c.status === "decidida" && c.fornecedor_escolhido
                ? `${c.fornecedor_escolhido} — ${moeda(Number(c.valor_escolhido ?? 0))}`
                : c.status === "recusada"
                  ? (c.motivo_recusa ?? "Recusada")
                  : `${c.propostas} proposta${c.propostas > 1 ? "s" : ""}${
                      menor !== null && maior !== null
                        ? Math.abs(maior - menor) < 0.01
                          ? ` — ${moeda(menor)}`
                          : ` — de ${moeda(menor)} a ${moeda(maior)}`
                        : ""
                    }`}
            </p>
            {c.status === "aguardando_cliente" && c.prazo_decisao && (
              <p className="text-xs text-muted-foreground">
                Decidir até {formatDateBR(c.prazo_decisao)}
              </p>
            )}
          </div>

          <Button
            variant={c.status === "aguardando_cliente" ? "default" : "outline"}
            render={<Link href={`/portal/obras/${obraId}/cotacoes/${c.id}`} />}
            nativeButton={false}
          >
            {c.status === "aguardando_cliente" ? "Ver e escolher" : "Ver"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-1">
        <h1 className="text-xl font-semibold">Cotações{obra ? ` — ${obra.nome}` : ""}</h1>
        <AjudaDaPagina titulo="Cotações">
          <p>
            Antes de comprar, o engenheiro pede preço a vários fornecedores para a mesma coisa. Cada
            preço é uma proposta.
          </p>
          <p>
            Aqui você compara as propostas e escolhe uma. A escolhida é a única que vira compra — e
            é só nesse momento que o valor entra nas contas da obra.
          </p>
          <p>Se nenhuma servir, você pode recusar todas dizendo o motivo.</p>
        </AjudaDaPagina>
      </div>

      {!linhas.length ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Scale className="size-8 text-muted-foreground" aria-hidden />
            <div className="flex flex-col gap-1">
              <p className="font-medium">Nenhuma cotação para você agora</p>
              <p className="max-w-md text-sm text-muted-foreground">
                Quando o engenheiro reunir propostas de preço para a sua decisão, elas aparecem aqui.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {pendentes.length > 0 && (
            <div className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                Esperando sua decisão
              </h2>
              {pendentes.map((c) => (
                <Linha key={c.id} c={c} />
              ))}
            </div>
          )}

          {decididas.length > 0 && (
            <div className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                Já decididas
              </h2>
              {decididas.map((c) => (
                <Linha key={c.id} c={c} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
