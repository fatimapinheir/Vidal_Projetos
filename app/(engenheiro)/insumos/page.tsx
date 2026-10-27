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
import { AjudaDaPagina } from "@/components/ui/ajuda-da-pagina";
import { FiltrosDaLista } from "@/components/ui/filtros-da-lista";
import { BotaoExcluir } from "@/components/ui/botao-excluir";
import { rotuloUnidade } from "@/lib/orcamento/unidades";
import { removerInsumo } from "@/app/actions/insumos";
import { InsumoDialog, ROTULO_CATEGORIA } from "./insumo-dialog";
import { AlternarAtivoInsumo } from "./alternar-ativo-insumo";
import type { TipoItemOrcamento } from "@/lib/types/database.types";

/*
 * As ordenações, todas no banco e sobre a lista inteira.
 *
 * "Ativos primeiro" é o padrão pelo mesmo motivo dos fornecedores: o inativo
 * continua na lista, apagado — ele aparece em compras antigas e sumir faria
 * parecer apagado —, mas não é o que se procura no dia a dia.
 */
const ORDENS = [
  {
    valor: "ativos",
    rotulo: "Ativos primeiro",
    criterios: [
      { coluna: "ativo", ascendente: false },
      { coluna: "descricao", ascendente: true },
    ],
  },
  {
    valor: "az",
    rotulo: "Descrição (A–Z)",
    criterios: [{ coluna: "descricao", ascendente: true }],
  },
  {
    valor: "za",
    rotulo: "Descrição (Z–A)",
    criterios: [{ coluna: "descricao", ascendente: false }],
  },
  {
    valor: "recentes",
    rotulo: "Cadastrados recentemente",
    criterios: [{ coluna: "created_at", ascendente: false }],
  },
] as const;

const CATEGORIAS: { valor: TipoItemOrcamento; rotulo: string }[] = [
  { valor: "material", rotulo: "Material" },
  { valor: "servico", rotulo: "Serviço" },
  { valor: "mao_de_obra", rotulo: "Mão de obra" },
];

export default async function InsumosPage({
  searchParams,
}: {
  searchParams: Promise<{ busca?: string; ordem?: string; categoria?: string }>;
}) {
  const f = await searchParams;
  const supabase = await createClient();

  const busca = (f.busca ?? "").trim();
  // Mesma limpeza da lista de fornecedores: `, ( ) *` quebram a linguagem de
  // filtro do PostgREST e `% _ \` são curingas do LIKE.
  const termo = busca.replace(/[,()*%_\\]/g, " ").replace(/\s+/g, " ").trim();
  const ordem = ORDENS.find((o) => o.valor === f.ordem) ?? ORDENS[0];
  const categoria = CATEGORIAS.find((c) => c.valor === f.categoria)?.valor;

  let consulta = supabase.from("insumos").select("id, descricao, categoria_custo, unidade, ativo");

  if (termo) consulta = consulta.ilike("descricao", `%${termo}%`);
  if (categoria) consulta = consulta.eq("categoria_custo", categoria);
  for (const criterio of ordem.criterios) {
    consulta = consulta.order(criterio.coluna, { ascending: criterio.ascendente });
  }

  const { data: insumos } = await consulta;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-1 font-heading text-lg font-semibold">
          Insumos
          <AjudaDaPagina titulo="Insumos">
            <p>
              O que a obra compra, cadastrado <strong>uma vez</strong>. Na ordem de compra e no
              lançamento você digita o começo do nome, escolhe, e a unidade já vem preenchida —
              resta informar a quantidade e o valor.
            </p>
            <p>
              <strong>Não tem preço</strong>, de propósito. O preço é do dia da compra e do
              fornecedor daquele dia; guardado aqui viraria um número velho com cara de verdade.
            </p>
            <p>
              A <strong>categoria de custo</strong> — material, serviço ou mão de obra — é a mesma
              do orçamento, e é por ela que o gasto se classifica.
            </p>
            <p>
              Insumo <strong>inativo</strong> sai da busca da compra e continua aqui, apagado. A
              lixeira apaga de vez: é seguro, porque cada compra guarda a própria cópia do que foi
              comprado.
            </p>
          </AjudaDaPagina>
        </h1>
        <InsumoDialog />
      </div>

      <FiltrosDaLista
        base="/insumos"
        busca={busca}
        placeholder="Buscar insumo pela descrição..."
        ordem={ordem.valor}
        ordens={ORDENS.map((o) => ({ valor: o.valor, rotulo: o.rotulo }))}
        campos={[
          {
            chave: "categoria",
            rotulo: "Categoria de custo",
            tipo: "opcoes",
            opcoes: CATEGORIAS.map((c) => ({ valor: c.valor, rotulo: c.rotulo })),
          },
        ]}
        valores={{ categoria: categoria ?? "" }}
        resultados={insumos?.length ?? 0}
      />

      <div className="overflow-x-auto rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Descrição</TableHead>
              <TableHead>Categoria de custo</TableHead>
              <TableHead>Unidade</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {insumos?.map((insumo) => (
              <TableRow key={insumo.id} className={insumo.ativo ? "" : "opacity-60"}>
                <TableCell className="font-medium">
                  {insumo.descricao}
                  {!insumo.ativo && (
                    <Badge variant="outline" className="ml-2">
                      Inativo
                    </Badge>
                  )}
                </TableCell>
                <TableCell>{ROTULO_CATEGORIA[insumo.categoria_custo]}</TableCell>
                <TableCell>{rotuloUnidade(insumo.unidade)}</TableCell>
                <TableCell className="text-right">
                  {/* A lixeira fica NA LINHA, no fim: é o padrão de exclusão
                      do sistema inteiro. */}
                  <div className="flex items-center justify-end gap-1">
                    <InsumoDialog
                      insumo={{
                        id: insumo.id,
                        descricao: insumo.descricao,
                        categoria_custo: insumo.categoria_custo,
                        unidade: insumo.unidade,
                      }}
                    />
                    <AlternarAtivoInsumo
                      insumoId={insumo.id}
                      descricao={insumo.descricao}
                      ativo={insumo.ativo}
                    />
                    <BotaoExcluir
                      rotulo="Excluir insumo"
                      confirmacao={
                        `Excluir "${insumo.descricao}" do catálogo?\n\n` +
                        `As compras que usaram esse insumo continuam inteiras — cada item guarda a ` +
                        `própria descrição, unidade e categoria. O que se perde é só o vínculo com o ` +
                        `catálogo, e o insumo some da busca de novas compras.`
                      }
                      acao={removerInsumo.bind(null, insumo.id)}
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {!insumos?.length && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  {termo || categoria
                    ? "Nenhum insumo encontrado com esse filtro."
                    : "Nenhum insumo cadastrado ainda. Cadastre aqui, ou direto na ordem de compra quando faltar."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
