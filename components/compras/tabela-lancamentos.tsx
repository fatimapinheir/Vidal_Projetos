"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Paginacao } from "@/components/ui/paginacao";
import type { AbaLancamentos } from "@/lib/compras/lancamentos";
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
  total,
  pagina,
  busca,
  tipo,
  aba,
  base,
  perfilId,
}: {
  /** Só a página atual — o filtro já foi aplicado no banco. */
  lancamentos: LancamentoCliente[];
  /** Quantas linhas o filtro encontrou na obra inteira. */
  total: number;
  pagina: number;
  busca: string;
  tipo: TipoItemOrcamento | "todos";
  aba: AbaLancamentos;
  base: string;
  /**
   * Quem está olhando. A lixeira só aparece no lançamento que esta pessoa
   * registrou — ordem de compra e lançamento do engenheiro não são dela.
   * É só a tela; quem recusa de verdade é a RLS.
   */
  perfilId: string | null;
}) {
  /*
   * Os filtros moram na URL, não em estado de componente.
   *
   * Filtrar no cliente só enxerga a página carregada: procurar um fornecedor
   * acharia nada se ele estivesse na página 3, e a tela responderia "não
   * existe" para algo que existe. Com o filtro na URL, quem procura é o banco,
   * sobre a obra inteira — e de quebra o link é compartilhável e o voltar do
   * navegador funciona.
   */
  const router = useRouter();
  const [termo, setTermo] = useState(busca);
  const [filtrosAbertos, setFiltrosAbertos] = useState(tipo !== "todos");
  const [navegando, iniciar] = useTransition();
  const atrasoRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function irPara(mudancas: Record<string, string | undefined>) {
    const atual = { busca: termo, tipo, aba, pagina: String(pagina), ...mudancas };
    const query = new URLSearchParams();
    if (atual.busca?.trim()) query.set("busca", atual.busca.trim());
    if (atual.tipo && atual.tipo !== "todos") query.set("tipo", atual.tipo);
    if (atual.aba && atual.aba !== "proximos") query.set("aba", atual.aba);
    if (atual.pagina && atual.pagina !== "1") query.set("pagina", atual.pagina);
    const texto = query.toString();
    iniciar(() => router.replace(texto ? `${base}/compras?${texto}` : `${base}/compras`));
  }

  /*
   * A busca espera meio segundo antes de ir ao servidor.
   *
   * Sem isso, cada tecla seria uma consulta e uma renderização — a lista
   * piscaria a cada letra. O texto digitado fica em estado local para o campo
   * continuar respondendo na hora; quem demora é só a ida ao banco.
   *
   * Qualquer filtro novo volta para a página 1: continuar na 7 depois de
   * reduzir o resultado a dez linhas mostraria uma tela vazia.
   */
  function aoBuscar(valor: string) {
    setTermo(valor);
    if (atrasoRef.current) clearTimeout(atrasoRef.current);
    atrasoRef.current = setTimeout(() => irPara({ busca: valor, pagina: "1" }), 500);
  }

  const titulo =
    aba === "proximos"
      ? `Pagamentos dos próximos ${DIAS_JANELA} dias`
      : "Todos os pagamentos";
  const descricao =
    aba === "proximos"
      ? `Aqui estão os pagamentos que vencem ou estão previstos para os próximos ${DIAS_JANELA} dias.`
      : "Todas as parcelas das ordens de compra desta obra, da mais próxima à mais distante.";
  const vazio =
    busca || tipo !== "todos"
      ? "Nenhum pagamento encontrado com esse filtro."
      : aba === "proximos"
        ? `Nenhum pagamento previsto para os próximos ${DIAS_JANELA} dias.`
        : "Nenhum pagamento registrado nesta obra.";

  return (
    <Tabs value={aba} onValueChange={(v) => irPara({ aba: String(v), pagina: "1" })} className="gap-0">
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
              value={termo}
              onChange={(e) => aoBuscar(e.target.value)}
              placeholder="Buscar por fornecedor, descrição..."
              aria-label="Buscar lançamentos"
              className="h-9 w-full pl-8 sm:w-64"
            />
          </div>
          <Button
            type="button"
            variant={tipo === "todos" ? "outline" : "default"}
            size="sm"
            className="h-9"
            aria-expanded={filtrosAbertos}
            onClick={() => setFiltrosAbertos((v) => !v)}
          >
            <ListFilter className="size-4" />
            Filtros
          </Button>
        </div>
      </div>

      {filtrosAbertos && (
        <div className="flex flex-wrap items-center gap-2 border-b bg-muted/40 px-4 py-2.5">
          <span className="text-xs font-medium text-muted-foreground">Tipo:</span>
          {(["todos", "material", "servico", "mao_de_obra"] as Filtro[]).map((t) => (
            <Button
              key={t}
              type="button"
              size="sm"
              variant={tipo === t ? "default" : "outline"}
              className="h-7"
              onClick={() => irPara({ tipo: t, pagina: "1" })}
            >
              {t === "todos" ? "Todos" : TIPO[t].rotulo}
            </Button>
          ))}
        </div>
      )}

      <div className={navegando ? "opacity-60 transition-opacity" : undefined}>
        <Secao
          titulo={titulo}
          descricao={descricao}
          linhas={lancamentos}
          base={base}
          perfilId={perfilId}
          vazio={vazio}
        />

        {total > 0 && (
          <div className="border-t px-4 py-3">
            <Paginacao
              pagina={pagina}
              total={total}
              caminho={`${base}/compras`}
              parametros={{
                busca: busca || undefined,
                tipo: tipo !== "todos" ? tipo : undefined,
                aba: aba !== "proximos" ? aba : undefined,
              }}
              rotulo="pagamentos"
            />
          </div>
        )}
      </div>
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
