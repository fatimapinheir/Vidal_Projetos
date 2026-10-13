import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardAction, CardContent } from "@/components/ui/card";
import { Users, Wrench, ListChecks, Truck, HardHat } from "lucide-react";
import type { ConteudoDia, EfetivoItem } from "@/lib/diario/montar-dia";
import type { PresencaStatus } from "@/lib/types/database.types";
import type { ReactNode } from "react";

const statusLabel: Record<PresencaStatus, string> = {
  presente: "Presente",
  falta: "Falta",
  meia_diaria: "Meia diária",
};

const SEM_FUNCAO = "Sem função informada";

/**
 * O efetivo agrupado por função.
 *
 * É a forma como a folha passou a ser lida. A lista por nome respondia "quem
 * esteve em obra", e numa obra com dez serventes alocados de duas equipes essa
 * resposta não serve a ninguém: o engenheiro não reconhece os nomes e quem lê
 * o documento quer saber o tamanho da frente de serviço. Agrupar por função
 * dá a contagem que o RDO sempre imprimiu — e os nomes continuam ali dentro,
 * porque é neles que se clica para confirmar presença.
 *
 * A contagem é de quem está EM OBRA: falta não conta, e meia diária conta
 * meio — a mesma régua do fechamento de folha e do RDO. Quem ainda não foi
 * confirmado fica fora da conta e aparece como pendência no grupo.
 */
function agruparPorFuncao(efetivo: EfetivoItem[]) {
  const grupos = new Map<string, { funcao: string; pessoas: EfetivoItem[] }>();
  for (const pessoa of efetivo) {
    const chave = pessoa.funcao?.trim() || SEM_FUNCAO;
    const grupo = grupos.get(chave) ?? { funcao: chave, pessoas: [] };
    grupo.pessoas.push(pessoa);
    grupos.set(chave, grupo);
  }
  return [...grupos.values()]
    .map((g) => ({
      ...g,
      emObra: g.pessoas.reduce(
        (soma, p) =>
          soma + (p.status === "presente" ? 1 : p.status === "meia_diaria" ? 0.5 : 0),
        0
      ),
      semConfirmar: g.pessoas.filter((p) => !p.status).length,
    }))
    .sort((a, b) => {
      // Quem já tem gente em obra sobe: a folha abre no que está acontecendo.
      if (!!a.emObra !== !!b.emObra) return a.emObra ? -1 : 1;
      // "Sem função informada" vai sempre para o fim — é lacuna de cadastro,
      // não uma função de obra.
      if ((a.funcao === SEM_FUNCAO) !== (b.funcao === SEM_FUNCAO)) {
        return a.funcao === SEM_FUNCAO ? 1 : -1;
      }
      return a.funcao.localeCompare(b.funcao, "pt-BR");
    });
}

/** Texto livre em itens, um por linha não vazia — igual ao RDO. */
function emLinhas(texto: string | null | undefined): string[] {
  return (texto ?? "")
    .split("\n")
    .map((l) => l.replace(/^[-•\s]+/, "").trim())
    .filter(Boolean);
}

/** "4" e "3,5" — meia diária existe e `toFixed(1)` em inteiro mostraria "4,0". */
function contagem(valor: number) {
  return valor.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
}

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
  campoEquipamentosExtras,
  campoEntregasExtras,
  equipamentosExtras,
  entregasExtras,
}: {
  conteudo: ConteudoDia;
  acaoEntrega?: (entregaParcelaId: string, recebidoEm: string | null) => ReactNode;
  acaoEfetivo?: (trabalhadorId: string, status: PresencaStatus | null) => ReactNode;
  atalhoEfetivo?: ReactNode;
  /**
   * Campos de texto para o que não veio de outra tela, quando o dia está
   * aberto para o engenheiro. Fechado ou na tela do cliente, o texto entra em
   * `equipamentosExtras` / `entregasExtras` e é só leitura.
   */
  campoEquipamentosExtras?: ReactNode;
  campoEntregasExtras?: ReactNode;
  equipamentosExtras?: string | null;
  entregasExtras?: string | null;
}) {
  const { equipamentos, tarefas, entregas } = conteudo;

  // Sem ação de presença (folha fechada, ou tela do cliente) a linha sem
  // lançamento não existe: ela só serve para dar onde clicar. Mostrá-la ali
  // viraria "pessoa sem presença" num documento, que não é o que a folha diz.
  const efetivo = acaoEfetivo
    ? conteudo.efetivo
    : conteudo.efetivo.filter((pessoa) => !!pessoa.status);

  const grupos = agruparPorFuncao(efetivo);
  const totalEmObra = grupos.reduce((soma, g) => soma + g.emObra, 0);
  const semConfirmar = efetivo.filter((e) => !e.status).length;

  const extrasEquipamentos = emLinhas(equipamentosExtras);
  const extrasEntregas = emLinhas(entregasExtras);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Secao
        titulo={`Efetivo${efetivo.length ? ` — ${contagem(totalEmObra)} em obra` : ""}`}
        icone={<Users className="size-4" />}
        vazio={
          acaoEfetivo
            ? "Nenhum trabalhador alocado nessa obra ainda."
            : "Nenhuma presença lançada nesse dia."
        }
        acao={semConfirmar ? atalhoEfetivo : null}
      >
        {efetivo.length || conteudo.responsaveis.length ? (
          <div className="flex flex-col gap-3">
            {/*
              O responsável antes da contagem.
              
              É o nome que se procura na folha — quem estava no comando da
              frente de serviço. Vem do cadastro de equipe, não da lista de
              presença, e por isso aparece mesmo num dia sem ninguém
              confirmado ainda.
            */}
            {!!conteudo.responsaveis.length && (
              <p className="flex items-start gap-2 rounded-lg bg-muted/50 px-2.5 py-2">
                <HardHat className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span>
                  <span className="block text-xs text-muted-foreground">
                    {conteudo.responsaveis.length === 1
                      ? "Responsável pela obra"
                      : "Responsáveis pela obra"}
                  </span>
                  <span className="font-medium">{conteudo.responsaveis.join(", ")}</span>
                </span>
              </p>
            )}

            {grupos.map((grupo) => (
              <div key={grupo.funcao} className="flex flex-col gap-1">
                <p className="flex items-baseline justify-between gap-2 border-b pb-1">
                  <span className="font-medium">{grupo.funcao}</span>
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {grupo.emObra > 0
                      ? `${contagem(grupo.emObra)} de ${grupo.pessoas.length} em obra`
                      : grupo.semConfirmar
                        ? `${grupo.semConfirmar} a confirmar`
                        : "ninguém em obra"}
                  </span>
                </p>
                <ul className="flex flex-col gap-1 pl-1">
                  {grupo.pessoas.map((pessoa, i) => (
                    <li
                      key={pessoa.trabalhadorId ?? `${pessoa.nome}-${i}`}
                      className="flex min-h-8 items-center justify-between gap-2"
                    >
                      <span
                        className={
                          pessoa.status === "falta"
                            ? "text-sm text-muted-foreground line-through"
                            : "text-sm"
                        }
                      >
                        {pessoa.nome}
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
              </div>
            ))}
          </div>
        ) : null}
      </Secao>

      <Secao
        titulo="Equipamentos em obra"
        icone={<Wrench className="size-4" />}
        vazio="Nenhum equipamento locado nesse dia."
      >
        {equipamentos.length || extrasEquipamentos.length || campoEquipamentosExtras ? (
          <div className="flex flex-col gap-3">
            {equipamentos.length ? (
              <ul className="flex flex-col gap-1">
                {equipamentos.map((item, i) => (
                  <li key={`${item.equipamento}-${i}`} className="flex justify-between gap-2">
                    <span>
                      {item.quantidade > 1 && (
                        <span className="text-muted-foreground">{item.quantidade}× </span>
                      )}
                      {item.equipamento}
                    </span>
                    <span className="text-muted-foreground">{item.locador}</span>
                  </li>
                ))}
              </ul>
            ) : (
              !campoEquipamentosExtras && (
                <p className="text-muted-foreground">Nenhum equipamento locado nesse dia.</p>
              )
            )}

            {/*
              O que a locação não conhece.
              
              Esta lista vem de `locacoes_equipamento`, então equipamento
              emprestado, do próprio pessoal ou com o financeiro ainda por
              lançar simplesmente não aparecia — e a folha afirmava "nenhum
              equipamento" numa obra com betoneira rodando.
            */}
            {campoEquipamentosExtras ??
              (!!extrasEquipamentos.length && (
                <ul className="flex flex-col gap-1 border-t pt-2">
                  {extrasEquipamentos.map((linha, i) => (
                    <li key={i}>{linha}</li>
                  ))}
                </ul>
              ))}
          </div>
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
        titulo="Entregas do dia"
        icone={<Truck className="size-4" />}
        vazio="Nenhuma entrega prevista nem recebida nesse dia."
      >
        {entregas.length || extrasEntregas.length || campoEntregasExtras ? (
          <div className="flex flex-col gap-3">
            {entregas.length ? (
              <ul className="flex flex-col gap-2">
                {entregas.map((entrega, i) => (
                  <li
                    key={`${entrega.descricao}-${i}`}
                    className="flex items-center justify-between gap-2"
                  >
                    <span>
                      {entrega.descricao}
                      <span className="block text-xs text-muted-foreground">
                        {entrega.fornecedor}
                      </span>
                    </span>
                    {acaoEntrega && entrega.compraId ? (
                      acaoEntrega(entrega.compraId, entrega.recebidoEm)
                    ) : entrega.recebidoEm ? (
                      <Badge variant="secondary">Recebido</Badge>
                    ) : (
                      <Badge variant="outline">Não recebido</Badge>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              !campoEntregasExtras && (
                <p className="text-muted-foreground">
                  Nenhuma entrega prevista nem recebida nesse dia.
                </p>
              )
            )}

            {/*
              O que não tem ordem de compra.
              
              Mesma lacuna dos equipamentos: material que chegou sem ordem
              cadastrada, ou com o financeiro ainda por lançar, não existia na
              folha do dia em que de fato entrou na obra.
            */}
            {campoEntregasExtras ??
              (!!extrasEntregas.length && (
                <ul className="flex flex-col gap-1 border-t pt-2">
                  {extrasEntregas.map((linha, i) => (
                    <li key={i}>{linha}</li>
                  ))}
                </ul>
              ))}
          </div>
        ) : null}
      </Secao>
    </div>
  );
}
