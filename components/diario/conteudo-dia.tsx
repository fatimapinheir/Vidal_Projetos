import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Users, Wrench, ListChecks, Truck } from "lucide-react";
import type { ConteudoDia } from "@/lib/diario/montar-dia";
import type { PresencaStatus } from "@/lib/types/database.types";
import type { ReactNode } from "react";

const statusLabel: Record<PresencaStatus, string> = {
  presente: "Presente",
  falta: "Falta",
  meia_diaria: "Meia diária",
};

function Secao({
  titulo,
  icone,
  vazio,
  children,
}: {
  titulo: string;
  icone: ReactNode;
  vazio: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          {icone}
          {titulo}
        </CardTitle>
      </CardHeader>
      <CardContent className="text-sm">
        {children ?? <p className="text-muted-foreground">{vazio}</p>}
      </CardContent>
    </Card>
  );
}

/**
 * As quatro seções que o sistema preenche sozinho. Recebe o conteúdo já
 * resolvido (ao vivo ou congelado) — não decide de onde ele veio.
 *
 * `acaoEntrega` é o que permite confirmar recebimento direto na folha; some
 * quando o dia está fechado ou quando a tela é a do cliente.
 */
export function ConteudoDiaSecoes({
  conteudo,
  acaoEntrega,
}: {
  conteudo: ConteudoDia;
  acaoEntrega?: (entregaParcelaId: string, recebidoEm: string | null) => ReactNode;
}) {
  const { efetivo, equipamentos, tarefas, entregas } = conteudo;

  const presentes = efetivo.filter((e) => e.status !== "falta").length;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Secao
        titulo={`Efetivo${efetivo.length ? ` — ${presentes} em obra` : ""}`}
        icone={<Users className="size-4" />}
        vazio="Nenhuma presença lançada nesse dia."
      >
        {efetivo.length ? (
          <ul className="flex flex-col gap-1">
            {efetivo.map((pessoa, i) => (
              <li key={`${pessoa.nome}-${i}`} className="flex items-center justify-between gap-2">
                <span className={pessoa.status === "falta" ? "text-muted-foreground" : ""}>
                  {pessoa.nome}
                </span>
                <Badge variant={pessoa.status === "falta" ? "outline" : "secondary"}>
                  {statusLabel[pessoa.status]}
                </Badge>
              </li>
            ))}
          </ul>
        ) : null}
      </Secao>

      <Secao
        titulo="Equipamentos em obra"
        icone={<Wrench className="size-4" />}
        vazio="Nenhum equipamento locado nesse dia."
      >
        {equipamentos.length ? (
          <ul className="flex flex-col gap-1">
            {equipamentos.map((item, i) => (
              <li key={`${item.equipamento}-${i}`} className="flex justify-between gap-2">
                <span>
                  {item.quantidade > 1 && <span className="text-muted-foreground">{item.quantidade}× </span>}
                  {item.equipamento}
                </span>
                <span className="text-muted-foreground">{item.locador}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </Secao>

      <Secao
        titulo="Previsto no cronograma"
        icone={<ListChecks className="size-4" />}
        vazio="Nenhuma tarefa prevista para esse dia."
      >
        {tarefas.length ? (
          <ul className="flex flex-col gap-1">
            {tarefas.map((tarefa, i) => (
              <li key={`${tarefa.nome}-${i}`} className="flex items-center justify-between gap-2">
                <span>
                  <span className="text-muted-foreground">{tarefa.etapa} · </span>
                  {tarefa.nome}
                </span>
                {tarefa.critica && <Badge variant="destructive">Crítica</Badge>}
              </li>
            ))}
          </ul>
        ) : null}
      </Secao>

      <Secao
        titulo="Entregas previstas"
        icone={<Truck className="size-4" />}
        vazio="Nenhuma entrega prevista para esse dia."
      >
        {entregas.length ? (
          <ul className="flex flex-col gap-2">
            {entregas.map((entrega, i) => (
              <li key={`${entrega.descricao}-${i}`} className="flex items-center justify-between gap-2">
                <span>
                  {entrega.descricao}
                  <span className="block text-xs text-muted-foreground">
                    {entrega.fornecedor} · {entrega.parcela}
                  </span>
                </span>
                {acaoEntrega && entrega.parcelaId ? (
                  acaoEntrega(entrega.parcelaId, entrega.recebidoEm)
                ) : entrega.recebidoEm ? (
                  <Badge variant="secondary">Recebido</Badge>
                ) : (
                  <Badge variant="outline">Não recebido</Badge>
                )}
              </li>
            ))}
          </ul>
        ) : null}
      </Secao>
    </div>
  );
}
