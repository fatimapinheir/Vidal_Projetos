import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Paginacao } from "@/components/paginacao";
import type { FormaPagamento } from "@/lib/types/database.types";
import { NovoTrabalhadorDialog } from "./novo-trabalhador-dialog";
import { NovaEquipeDialog } from "./nova-equipe-dialog";
import { DesativarEquipeButton } from "./equipes-actions";
import { BotaoExcluir } from "@/components/ui/botao-excluir";
import { removerTrabalhador } from "@/app/actions/trabalhadores";

const EQUIPES_POR_PAGINA = 10;

const formaLabel: Record<FormaPagamento, string> = {
  pix: "Pix",
  transferencia: "Transferência",
  dinheiro: "Dinheiro",
  cheque: "Cheque",
  boleto: "Boleto",
  cartao_credito: "Cartão de crédito",
  cartao_debito: "Cartão de débito",
  outro: "Outro",
};

export default async function ColaboradoresPage({
  searchParams,
}: {
  searchParams: Promise<{ pagina?: string }>;
}) {
  const { pagina: paginaParam } = await searchParams;
  const supabase = await createClient();

  const { data: trabalhadores } = await supabase.from("trabalhadores").select("*").order("nome");

  // Quantas equipes existem, para saber se há mais de uma página antes de
  // decidir qual fatia buscar.
  const { count } = await supabase
    .from("equipes")
    .select("*", { count: "exact", head: true })
    .eq("ativo", true);

  const totalEquipes = count ?? 0;
  const totalPaginas = Math.max(1, Math.ceil(totalEquipes / EQUIPES_POR_PAGINA));
  // Página fora do intervalo (URL editada à mão, ou equipe removida enquanto a
  // aba estava aberta) cai na última válida em vez de mostrar lista vazia.
  const pagina = Math.min(Math.max(Number(paginaParam) || 1, 1), totalPaginas);
  const inicio = (pagina - 1) * EQUIPES_POR_PAGINA;

  const { data: equipes } = await supabase
    .from("equipes")
    .select(
      "id, nome, responsavel:trabalhadores!responsavel_id(nome), equipe_trabalhadores(trabalhadores(nome)), obra_equipes(ativo, tipo_contrato, obras(nome))"
    )
    .eq("ativo", true)
    .order("nome")
    .range(inicio, inicio + EQUIPES_POR_PAGINA - 1);

  const trabalhadoresAtivos = (trabalhadores ?? [])
    .filter((t) => t.ativo)
    .map((t) => ({ id: t.id, nome: t.nome, funcao: t.funcao }));

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-heading text-lg font-semibold">Colaboradores</h1>
            <p className="text-sm text-muted-foreground">
              As pessoas disponíveis para alocar nas obras. A diária de cada uma é definida por
              obra, na visão geral dela.
            </p>
          </div>
          <NovoTrabalhadorDialog />
        </div>

        <div className="overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Função</TableHead>
                <TableHead>Regime</TableHead>
                <TableHead>Diária padrão</TableHead>
                <TableHead>Pagamento</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {trabalhadores?.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.nome}</TableCell>
                  <TableCell>{t.funcao ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {t.regime_pagamento === "diaria" ? "Diária" : "Pacote de serviço"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {t.valor_diaria_padrao
                      ? t.valor_diaria_padrao.toLocaleString("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        })
                      : "—"}
                  </TableCell>
                  <TableCell className="text-xs">
                    {t.forma_pagamento ? (
                      <>
                        {formaLabel[t.forma_pagamento]}
                        {t.dados_pagamento && (
                          <span className="block max-w-48 truncate text-muted-foreground">
                            {t.dados_pagamento}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>{t.telefone ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={t.ativo ? "default" : "secondary"}>
                      {t.ativo ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {/*
                      A lixeira recusa quem tem histórico — presença lançada,
                      fechamento pago — e explica por quê. Ver
                      `removerTrabalhador`: para esses, o caminho é inativar.
                    */}
                    <BotaoExcluir
                      rotulo="Excluir colaborador"
                      confirmacao={`Apagar ${t.nome} do cadastro? Ele sai das equipes e das obras em que estava alocado, e não dá para desfazer.`}
                      acao={removerTrabalhador.bind(null, t.id)}
                    />
                  </TableCell>
                </TableRow>
              ))}
              {!trabalhadores?.length && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    Nenhum colaborador cadastrado ainda.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-heading text-base font-semibold">Equipes</h2>
            <p className="text-sm text-muted-foreground">
              Grupos de colaboradores reaproveitáveis entre obras. O tipo de contrato e o valor
              são definidos em cada obra, porque empreitada se negocia caso a caso.
            </p>
          </div>
          <NovaEquipeDialog trabalhadores={trabalhadoresAtivos} />
        </div>

        <div className="flex flex-col gap-3">
          {equipes?.map((eq) => {
            const responsavel = eq.responsavel as unknown as { nome: string } | null;
            const membros = (eq.equipe_trabalhadores ?? []) as unknown as {
              trabalhadores: { nome: string } | null;
            }[];
            const vinculos = (eq.obra_equipes ?? []) as unknown as {
              ativo: boolean;
              tipo_contrato: string;
              obras: { nome: string } | null;
            }[];
            const emObras = vinculos.filter((v) => v.ativo);

            return (
              <div key={eq.id} className="flex flex-col gap-2 rounded-xl border p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium">{eq.nome}</p>
                    <p className="text-sm text-muted-foreground">
                      Responsável: {responsavel?.nome ?? "—"} · Membros:{" "}
                      {membros.map((m) => m.trabalhadores?.nome).filter(Boolean).join(", ") || "—"}
                    </p>
                  </div>
                  <DesativarEquipeButton equipeId={eq.id} />
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {emObras.length ? (
                    emObras.map((v, i) => (
                      <Badge key={i} variant="outline">
                        {v.obras?.nome} · {v.tipo_contrato === "diaria" ? "Diária" : "Empreitada"}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-muted-foreground">
                      Não está em nenhuma obra — coloque na visão geral da obra.
                    </span>
                  )}
                </div>
              </div>
            );
          })}

          {!equipes?.length && (
            <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              Nenhuma equipe cadastrada ainda.
            </p>
          )}
        </div>

        <Paginacao
          pagina={pagina}
          totalPaginas={totalPaginas}
          total={totalEquipes}
          rotuloItens="equipes"
        />
      </section>
    </div>
  );
}
