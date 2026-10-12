"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  CalendarClock,
  HardHat,
  ListFilter,
  Package,
  Search,
  Wrench,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { formatDateBR } from "@/lib/format-date";
import { ExcluirCompraDialog } from "./excluir-compra-dialog";
import { cn } from "@/lib/utils";
import type { LancamentoCliente } from "@/lib/compras/lancamentos";
import type { TipoItemOrcamento } from "@/lib/types/database.types";

const DIAS_JANELA = 15;

function moeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const TIPO: Record<TipoItemOrcamento, { rotulo: string; Icone: typeof Package; cor: string }> = {
  material: { rotulo: "Material", Icone: Package, cor: "text-grafico-pago" },
  servico: { rotulo: "Serviço", Icone: Wrench, cor: "text-primary-texto" },
  mao_de_obra: { rotulo: "Mão de obra", Icone: HardHat, cor: "text-atencao" },
};

/**
 * Como cada situação se mostra.
 *
 * Nenhuma delas é vermelha, e isso é regra, não escolha de paleta: parcela com
 * vencimento passado chega aqui como "Pendente" igual às outras. Cobrar
 * fornecedor é trabalho do engenheiro — pintar de vermelho a tela do cliente
 * só transfere a aflição para quem não pode resolver.
 */
const SITUACAO: Record<
  LancamentoCliente["situacao"],
  { rotulo: string; classe: string }
> = {
  pendente: { rotulo: "Pendente", classe: "bg-atencao/12 text-atencao" },
  agendado: { rotulo: "Agendado", classe: "bg-accent text-accent-foreground" },
  apos_entrega: { rotulo: "Após a entrega", classe: "bg-muted text-muted-foreground" },
  pago: { rotulo: "Pago", classe: "bg-sucesso/12 text-sucesso" },
};

/**
 * Quando a parcela vence, em linguagem de gente.
 *
 * Só olha para a frente. Data que já passou devolve `null` e a célula mostra
 * apenas o dia — "há 23 dias" seria a informação de atraso saindo pela porta
 * dos fundos.
 */
function quandoVence(dias: number): string | null {
  if (dias < 0) return null;
  if (dias === 0) return "hoje";
  if (dias === 1) return "amanhã";
  return `em ${dias} dias`;
}

type Filtro = "todos" | TipoItemOrcamento;

export function TabelaLancamentos({
  lancamentos,
  base,
  perfilId,
}: {
  lancamentos: LancamentoCliente[];
  base: string;
  /**
   * Quem está olhando. A lixeira só aparece no lançamento que esta pessoa
   * registrou — ordem de compra e lançamento do engenheiro não são dela.
   * É só a tela; quem recusa de verdade é a RLS.
   */
  perfilId: string | null;
}) {
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);

  /*
   * A busca e o filtro valem para as DUAS abas.
   *
   * Zerá-los ao trocar de aba seria o comportamento mais fácil de programar e
   * o mais irritante de usar: quem procurou um fornecedor na janela de 15 dias
   * e não achou vai justamente para "todos os pagamentos" procurar o mesmo
   * nome.
   */
  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return lancamentos.filter((l) => {
      if (filtro !== "todos" && l.tipo !== filtro) return false;
      if (!termo) return true;
      return (
        l.descricao.toLowerCase().includes(termo) ||
        l.fornecedor.toLowerCase().includes(termo)
      );
    });
  }, [lancamentos, busca, filtro]);

  const proximos = filtrados.filter(
    (l) => l.situacao !== "pago" && l.diasAte >= 0 && l.diasAte <= DIAS_JANELA
  );

  const tiposPresentes = useMemo(() => {
    const vistos = new Set(lancamentos.map((l) => l.tipo).filter(Boolean));
    return [...vistos] as TipoItemOrcamento[];
  }, [lancamentos]);

  return (
    <Tabs defaultValue="proximos" className="gap-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 pt-3">
        <TabsList variant="line" className="h-auto gap-4 p-0">
          <TabsTrigger value="proximos" className="h-9 flex-none px-0">
            <CalendarClock className="size-4" aria-hidden />
            Próximos {DIAS_JANELA} dias
          </TabsTrigger>
          <TabsTrigger value="todos" className="h-9 flex-none px-0">
            <ListFilter className="size-4" aria-hidden />
            Todos os pagamentos
          </TabsTrigger>
        </TabsList>

        <div className="flex items-center gap-2 pb-2">
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por fornecedor, descrição..."
              aria-label="Buscar lançamentos"
              className="h-9 w-full pl-8 sm:w-64"
            />
          </div>
          {/* O filtro de tipo só aparece quando há mais de um tipo para
              escolher — botão que abre uma lista de uma opção só é ruído. */}
          {tiposPresentes.length > 1 && (
            <Button
              type="button"
              variant={filtro === "todos" ? "outline" : "default"}
              size="sm"
              className="h-9"
              aria-expanded={filtrosAbertos}
              onClick={() => setFiltrosAbertos((v) => !v)}
            >
              <ListFilter className="size-4" />
              Filtros
            </Button>
          )}
        </div>
      </div>

      {filtrosAbertos && tiposPresentes.length > 1 && (
        <div className="flex flex-wrap items-center gap-2 border-b bg-muted/40 px-4 py-2.5">
          <span className="text-xs font-medium text-muted-foreground">Tipo:</span>
          {(["todos", ...tiposPresentes] as Filtro[]).map((t) => (
            <Button
              key={t}
              type="button"
              size="sm"
              variant={filtro === t ? "default" : "outline"}
              className="h-7"
              onClick={() => setFiltro(t)}
            >
              {t === "todos" ? "Todos" : TIPO[t].rotulo}
            </Button>
          ))}
        </div>
      )}

      <TabsContent value="proximos">
        <Secao
          titulo={`Pagamentos dos próximos ${DIAS_JANELA} dias`}
          descricao={`Aqui estão os pagamentos que vencem ou estão previstos para os próximos ${DIAS_JANELA} dias.`}
          linhas={proximos}
          base={base}
          perfilId={perfilId}
          vazio={`Nenhum pagamento previsto para os próximos ${DIAS_JANELA} dias.`}
        />
      </TabsContent>

      <TabsContent value="todos">
        <Secao
          titulo="Todos os pagamentos"
          descricao="Todas as parcelas das ordens de compra desta obra, da mais próxima à mais distante."
          linhas={filtrados}
          base={base}
          perfilId={perfilId}
          vazio="Nenhum pagamento registrado nesta obra."
        />
      </TabsContent>
    </Tabs>
  );
}

function Secao({
  titulo,
  descricao,
  linhas,
  base,
  perfilId,
  vazio,
}: {
  titulo: string;
  descricao: string;
  linhas: LancamentoCliente[];
  base: string;
  perfilId: string | null;
  vazio: string;
}) {
  return (
    <div className="flex flex-col">
      <div className="px-4 pt-4 pb-2">
        <p className="font-heading text-base font-semibold">{titulo}</p>
        <p className="text-sm text-muted-foreground">{descricao}</p>
      </div>

      {linhas.length ? (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data de vencimento</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Fornecedor</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {linhas.map((l) => {
                const tipo = l.tipo ? TIPO[l.tipo] : null;
                const situacao = SITUACAO[l.situacao];
                const prazo = l.situacao === "pago" ? null : quandoVence(l.diasAte);
                return (
                  <TableRow key={l.id}>
                    <TableCell className="whitespace-nowrap">
                      <span className="block tabular-nums">{formatDateBR(l.vencimento)}</span>
                      {prazo && (
                        <span className="block text-xs text-muted-foreground">({prazo})</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {tipo ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
                          <tipo.Icone className={cn("size-3.5", tipo.cor)} aria-hidden />
                          {tipo.rotulo}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">
                      {l.descricao}
                      {l.numeroParcela > 1 && (
                        <span className="ml-1 text-xs font-normal text-muted-foreground">
                          · {l.numeroParcela}ª parcela
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{l.fornecedor}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {moeda(l.valor)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn("border-transparent", situacao.classe)}
                      >
                        {situacao.rotulo}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          nativeButton={false}
                          render={<Link href={`${base}/compras/${l.compraId}`}>Ver detalhes</Link>}
                        />
                        {l.ehLancamento && !!perfilId && l.criadoPor === perfilId && (
                          <ExcluirCompraDialog
                            compraId={l.compraId}
                            descricao={l.descricao}
                            ehLancamento
                          />
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        <p className="px-4 py-10 text-center text-sm text-muted-foreground">{vazio}</p>
      )}
    </div>
  );
}
