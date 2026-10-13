import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardAction, CardContent } from "@/components/ui/card";
import { Users, Wrench, ListChecks, Truck } from "lucide-react";
import type { ConteudoDia } from "@/lib/diario/montar-dia";
import type { ReactNode } from "react";


/** Texto livre em itens, um por linha não vazia — igual ao RDO. */
function emLinhas(texto: string | null | undefined): string[] {
  return (texto ?? "")
    .split("\n")
    .map((l) => l.replace(/^[-•\s]+/, "").trim())
    .filter(Boolean);
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
  blocoEfetivo,
  campoEquipamentosExtras,
  campoEntregasExtras,
  equipamentosExtras,
  entregasExtras,
}: {
  conteudo: ConteudoDia;
  acaoEntrega?: (entregaParcelaId: string, recebidoEm: string | null) => ReactNode;
  /**
   * O efetivo por função, montado pela página. Chega pronto porque é um
   * componente de cliente com ações próprias, e esta peça é compartilhada.
   */
  blocoEfetivo?: ReactNode;
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

  const extrasEquipamentos = emLinhas(equipamentosExtras);
  const extrasEntregas = emLinhas(entregasExtras);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/*
        O título não carrega mais a contagem.
        
        Ela vinha do servidor, e a tabela passou a se atualizar sozinha no
        navegador — o número do título ficaria para trás a cada lançamento, dois
        totais discordando na mesma tela. O total vive no rodapé da tabela, que
        é onde ele é somado.
      */}
      <Secao
        titulo="Efetivo"
        icone={<Users className="size-4" />}
        vazio="Nenhum efetivo lançado nesse dia."
      >
        {/*
          O efetivo do dia é o responsável da equipe mais a contagem por
          FUNÇÃO — ver `EfetivoPorFuncao`, que a página passa pronto aqui.

          A lista nominal saiu. Ela vinha dos colaboradores alocados um a um na
          obra, e isso não é como a obra funciona: a equipe é contratada com um
          responsável, e quem chega no dia varia. A folha mostrava seis nomes
          fixos enquanto a frente de serviço tinha outra composição, e
          desativar a equipe não mudava nada na folha — prova de que ela nem
          olhava para a equipe.

          O lançamento de presença individual continua existindo na tela de
          Presenças, que é de onde o fechamento de folha tira a diária. Como as
          duas coisas se encontram no fechamento fica para quando mexermos nele.
        */}
        {blocoEfetivo}
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
