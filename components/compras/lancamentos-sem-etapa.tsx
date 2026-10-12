import { TriangleAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { EtapaOrcamentoSelect } from "./etapa-orcamento-select";

export type LancamentoSemEtapa = {
  id: string;
  descricao: string;
  valor: number;
  fornecedor: string | null;
  registradoPor: string;
};

const moeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/**
 * Lançamentos que o cliente registrou e que ninguém classificou ainda.
 *
 * O cliente não escolhe etapa — ele não conhece a divisão do orçamento, e
 * pedir que escolha produziria classificação errada, que é pior que nenhuma.
 * O custo disso é que o gasto entra no total da obra mas fica de fora do
 * comparativo orçado × gasto por etapa, e essa ausência é silenciosa: a etapa
 * simplesmente parece ter gasto menos do que gastou.
 *
 * Por isso o aviso traz o select junto, e não um link para abrir cada um:
 * classificar três lançamentos viraria três telas abertas e fechadas, e o que
 * dá trabalho fica para depois.
 *
 * Lançamento do PRÓPRIO engenheiro sem etapa não entra aqui — lá o campo
 * estava na tela e "não vincular" foi escolha dele.
 */
export function LancamentosSemEtapa({
  lancamentos,
  etapas,
}: {
  lancamentos: LancamentoSemEtapa[];
  etapas: string[];
}) {
  if (!lancamentos.length || !etapas.length) return null;

  const plural = lancamentos.length > 1;

  return (
    <Alert className="border-atencao/40 bg-atencao/10">
      <TriangleAlert className="size-4 text-atencao" />
      {/* min-w-0 nos dois filhos do grid do Alert: a coluna é `1fr`, que por
          padrão não encolhe abaixo do conteúdo — uma descrição longa empurrava
          o alerta inteiro para fora da tela no celular, e o `truncate` lá
          dentro não tinha como agir. */}
      <AlertTitle className="min-w-0">
        {lancamentos.length} lançamento{plural ? "s" : ""} do cliente sem etapa do orçamento
      </AlertTitle>
      <AlertDescription className="flex min-w-0 flex-col gap-3">
        <span>
          {plural ? "Eles entram" : "Ele entra"} no total gasto da obra, mas {plural ? "ficam" : "fica"}{" "}
          de fora do comparativo orçado × gasto até você escolher a etapa.
        </span>

        <ul className="flex min-w-0 flex-col gap-2">
          {lancamentos.map((l) => (
            <li
              key={l.id}
              className="flex min-w-0 flex-col gap-2 rounded-lg border bg-card p-2.5 sm:flex-row sm:items-center sm:gap-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-foreground">{l.descricao}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {moeda(l.valor)}
                  {l.fornecedor ? ` · ${l.fornecedor}` : ""} · registrado por {l.registradoPor}
                </p>
              </div>
              <div className="sm:w-72">
                <EtapaOrcamentoSelect compraId={l.id} etapaAtual={null} etapas={etapas} />
              </div>
            </li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
}
