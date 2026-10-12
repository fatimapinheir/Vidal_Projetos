import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardAction, CardContent } from "@/components/ui/card";
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
  acao,
  children,
}: {
  titulo: string;
  icone: ReactNode;
  vazio: string;
  acao?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          {icone}
          {titulo}
        </CardTitle>
        {acao && <CardAction>{acao}</CardAction>}
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
 * `acaoEntrega` e `acaoEfetivo` são o que permite confirmar recebimento e
 * presença direto na folha; somem quando o dia está fechado ou quando a tela é
 * a do cliente.
 */
export function ConteudoDiaSecoes({
  conteudo,
  acaoEntrega,
  acaoEfetivo,
  atalhoEfetivo,
}: {
  conteudo: ConteudoDia;
  acaoEntrega?: (entregaParcelaId: string, recebidoEm: string | null) => ReactNode;
  acaoEfetivo?: (trabalhadorId: string, status: PresencaStatus | null) => ReactNode;
  atalhoEfetivo?: ReactNode;
}) {
  const { equipamentos, tarefas, entregas } = conteudo;

  // Sem ação de presença (folha fechada, ou tela do cliente) a linha sem
  // lançamento não existe: ela só serve para dar onde clicar. Mostrá-la ali
  // viraria "pessoa sem presença" num documento, que não é o que a folha diz.
  const efetivo = acaoEfetivo
    ? conteudo.efetivo
    : conteudo.efetivo.filter((pessoa) => !!pessoa.status);

  const presentes = efetivo.filter((e) => !!e.status && e.status !== "falta").length;
  const semConfirmar = efetivo.filter((e) => !e.status).length;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Secao
        titulo={`Efetivo${efetivo.length ? ` — ${presentes} em obra` : ""}`}
        icone={<Users className="size-4" />}
        vazio={
          acaoEfetivo
            ? "Nenhum trabalhador alocado nessa obra ainda."
            : "Nenhuma presença lançada nesse dia."
        }
        acao={semConfirmar ? atalhoEfetivo : null}
      >
        {efetivo.length ? (
          <ul className="flex flex-col gap-1">
            {efetivo.map((pessoa, i) => (
              <li
                key={pessoa.trabalhadorId ?? `${pessoa.nome}-${i}`}
                className="flex min-h-8 items-center justify-between gap-2"
              >
                <span className={pessoa.status === "falta" ? "text-muted-foreground" : ""}>
                  {pessoa.nome}
                  {pessoa.funcao && (
                    <span className="block text-xs text-muted-foreground">{pessoa.funcao}</span>
                  )}
                </span>
                {acaoEfetivo && pessoa.trabalhadorId ? (
                  acaoEfetivo(pessoa.trabalhadorId, pessoa.status)
                ) : pessoa.status ? (
                  <Badge variant={pessoa.status === "falta" ? "outline" : "secondary"}>
                    {statusLabel[pessoa.status]}
                  </Badge>
                ) : null}
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
