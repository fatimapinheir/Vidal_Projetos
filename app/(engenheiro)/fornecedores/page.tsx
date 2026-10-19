import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Phone, Star } from "lucide-react";
import { NovoFornecedorDialog } from "./novo-fornecedor-dialog";
import { EditarFornecedorDialog } from "@/components/fornecedores/editar-fornecedor-dialog";
import { AlternarAtivoFornecedor } from "@/components/fornecedores/alternar-ativo-fornecedor";
import type { CondicaoPagamento, FormaPagamento } from "@/lib/types/database.types";
import { AjudaDaPagina } from "@/components/ui/ajuda-da-pagina";
import { FiltrosDaLista } from "@/components/ui/filtros-da-lista";
import { SelosDeCategoria } from "@/components/fornecedores/campo-categorias";

const formaLabel: Record<FormaPagamento, string> = {
  pix: "Pix",
  boleto: "Boleto",
  transferencia: "Transferência",
  dinheiro: "Dinheiro",
  cartao_credito: "Cartão de crédito",
  cartao_debito: "Cartão de débito",
  cheque: "Cheque",
  outro: "Outro",
};

const condicaoLabel: Record<CondicaoPagamento, string> = {
  a_vista: "À vista",
  prazo: "A prazo",
};

/*
 * As ordenações da lista. Todas no banco, sobre a lista inteira.
 *
 * "Ativos primeiro" é o padrão porque inativo continua na lista — ele aparece
 * em compras antigas, e sumir faria parecer apagado — mas não é o que se
 * procura no dia a dia.
 */
const ORDENS = [
  {
    valor: "ativos",
    rotulo: "Ativos primeiro",
    criterios: [
      { coluna: "ativo", ascendente: false },
      { coluna: "nome", ascendente: true },
    ],
  },
  { valor: "az", rotulo: "Nome (A–Z)", criterios: [{ coluna: "nome", ascendente: true }] },
  { valor: "za", rotulo: "Nome (Z–A)", criterios: [{ coluna: "nome", ascendente: false }] },
  {
    valor: "recentes",
    rotulo: "Cadastrados recentemente",
    criterios: [{ coluna: "created_at", ascendente: false }],
  },
] as const;

export default async function FornecedoresPage({
  searchParams,
}: {
  searchParams: Promise<{ busca?: string; ordem?: string; categoria?: string }>;
}) {
  const f = await searchParams;
  const supabase = await createClient();

  const busca = (f.busca ?? "").trim();
  // Caracteres de significado especial saem: `, ( ) *` quebram a linguagem de
  // filtro do PostgREST e `% _ \` são curingas do LIKE.
  const termo = busca.replace(/[,()*%_\\]/g, " ").replace(/\s+/g, " ").trim();
  const ordem = ORDENS.find((o) => o.valor === f.ordem) ?? ORDENS[0];
  const categoria = /^[0-9a-f-]{36}$/i.test(f.categoria ?? "") ? f.categoria! : undefined;

  const [{ data: categorias }, { data: vinculosDaCategoria }] = await Promise.all([
    supabase
      .from("categorias_fornecedor")
      .select("id, nome, tipo")
      .eq("ativo", true)
      .order("ordem")
      .order("nome"),
    /*
     * O filtro por categoria vira uma lista de ids de fornecedor.
     *
     * A alternativa seria um `inner join` embutido na consulta principal, mas
     * aí a contagem de resultados passaria a contar VÍNCULOS e não
     * fornecedores: quem tem três categorias apareceria três vezes.
     */
    categoria
      ? supabase.from("fornecedor_categorias").select("fornecedor_id").eq("categoria_id", categoria)
      : Promise.resolve({ data: null }),
  ]);

  let consulta = supabase
    .from("fornecedores")
    .select(
      "*, fornecedor_contatos(id, nome, telefone, email, principal), fornecedor_pagamento(forma_pagamento, dados_pagamento, condicao_pagamento, condicao_prazo), fornecedor_categorias(categoria_id)"
    );

  if (termo) {
    consulta = consulta.or(
      `nome.ilike.%${termo}%,razao_social.ilike.%${termo}%,cnpj_cpf.ilike.%${termo}%`
    );
  }
  if (categoria) {
    const ids = (vinculosDaCategoria ?? []).map((v) => v.fornecedor_id);
    // Nenhum fornecedor na categoria: um `in` vazio devolveria TODOS, então o
    // filtro precisa de um id impossível para devolver nada.
    consulta = consulta.in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
  }
  for (const criterio of ordem.criterios) {
    consulta = consulta.order(criterio.coluna, { ascending: criterio.ascendente });
  }

  const { data: fornecedores } = await consulta;

  const porId = new Map((categorias ?? []).map((c) => [c.id, c]));
  const todasCategorias = (categorias ?? []).map((c) => ({
    id: c.id,
    nome: c.nome,
    tipo: c.tipo,
  }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-1 font-heading text-lg font-semibold">
          Fornecedores
          <AjudaDaPagina titulo="Fornecedores">
            <p>
              O cadastro usado nas ordens de compra e nas locações. Cada fornecedor pode ter vários
              vendedores — o marcado como principal é o que atende você.
            </p>
            <p>
              As <strong>categorias</strong> dizem o que ele fornece, e servem para achar quem vende
              o que você precisa. Um fornecedor pode ter várias: a mesma loja vende ferragem e
              material hidráulico.
            </p>
            <p>
              Fornecedor <strong>inativo</strong> continua na lista, apagado. Ele aparece em compras
              antigas, e sumir faria parecer apagado.
            </p>
          </AjudaDaPagina>
        </h1>
        <NovoFornecedorDialog categorias={todasCategorias} />
      </div>

      <FiltrosDaLista
        base="/fornecedores"
        busca={busca}
        placeholder="Buscar por nome, razão social ou CNPJ..."
        ordem={ordem.valor}
        ordens={ORDENS.map((o) => ({ valor: o.valor, rotulo: o.rotulo }))}
        campos={[
          {
            chave: "categoria",
            rotulo: "Categoria",
            tipo: "opcoes",
            opcoes: todasCategorias.map((c) => ({
              valor: c.id,
              rotulo: `${c.nome} (${c.tipo === "material" ? "material" : "serviço"})`,
            })),
          },
        ]}
        valores={{ categoria: categoria ?? "" }}
        resultados={fornecedores?.length ?? 0}
      />

      <div className="flex flex-col gap-3">
        {fornecedores?.map((f) => {
          const contatos = (f.fornecedor_contatos ?? []) as unknown as {
            id: string;
            nome: string;
            telefone: string | null;
            principal: boolean;
          }[];
          const contatosCompletos = contatos.map((c) => ({
            id: c.id,
            nome: c.nome,
            telefone: c.telefone,
            principal: c.principal,
          }));
          // Relação um-para-um, mas o PostgREST devolve objeto ou null.
          const pagamento = f.fornecedor_pagamento as unknown as {
            forma_pagamento: FormaPagamento | null;
            dados_pagamento: string | null;
            condicao_pagamento: CondicaoPagamento | null;
            condicao_prazo: string | null;
          } | null;

          const marcadas = ((f.fornecedor_categorias ?? []) as unknown as {
            categoria_id: string;
          }[])
            .map((v) => porId.get(v.categoria_id))
            .filter((c): c is NonNullable<typeof c> => !!c);

          const ordenados = [...contatos].sort(
            (a, b) => Number(b.principal) - Number(a.principal) || a.nome.localeCompare(b.nome, "pt-BR")
          );

          return (
            <div
              key={f.id}
              className={`flex flex-col gap-3 rounded-xl border p-3 ${
                // Inativo fica apagado, não escondido: ele continua aparecendo
                // em compras antigas, e sumir da lista faria parecer apagado.
                f.ativo ? "" : "border-dashed opacity-60"
              }`}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium">
                    {f.nome}
                    {!f.ativo && (
                      <Badge variant="outline" className="ml-2 align-middle">
                        Inativo
                      </Badge>
                    )}
                  </p>
                  {f.razao_social && (
                    <p className="truncate text-sm text-muted-foreground">{f.razao_social}</p>
                  )}
                  <p className="text-sm text-muted-foreground">
                    {[f.cnpj_cpf, f.telefone, f.email].filter(Boolean).join(" · ") || "—"}
                  </p>
                  {!!marcadas.length && (
                    <span className="mt-1 block">
                      <SelosDeCategoria categorias={marcadas} />
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {pagamento?.forma_pagamento && (
                    <Badge variant="outline">{formaLabel[pagamento.forma_pagamento]}</Badge>
                  )}
                  {pagamento?.condicao_pagamento && (
                    <Badge variant="secondary">
                      {condicaoLabel[pagamento.condicao_pagamento]}
                      {pagamento.condicao_prazo ? ` · ${pagamento.condicao_prazo}` : ""}
                    </Badge>
                  )}
                  <EditarFornecedorDialog
                    fornecedorId={f.id}
                    fornecedor={{
                      nome: f.nome,
                      razao_social: f.razao_social,
                      cnpj_cpf: f.cnpj_cpf,
                      telefone: f.telefone,
                      email: f.email,
                      observacoes: f.observacoes,
                      forma_pagamento: pagamento?.forma_pagamento ?? null,
                      dados_pagamento: pagamento?.dados_pagamento ?? null,
                      condicao_pagamento: pagamento?.condicao_pagamento ?? null,
                      condicao_prazo: pagamento?.condicao_prazo ?? null,
                    }}
                    contatos={contatosCompletos}
                    categorias={todasCategorias}
                    categoriasMarcadas={marcadas.map((c) => c.id)}
                  />
                  <AlternarAtivoFornecedor fornecedorId={f.id} nome={f.nome} ativo={f.ativo} />
                </div>
              </div>

              {pagamento?.dados_pagamento && (
                <p className="text-xs text-muted-foreground">
                  Pagamento: <span className="text-foreground">{pagamento.dados_pagamento}</span>
                </p>
              )}

              {!!ordenados.length && (
                <div className="flex flex-wrap gap-2">
                  {ordenados.map((c) => (
                    <span
                      key={c.id}
                      className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs"
                    >
                      {c.principal && (
                        <Star className="size-3 fill-atencao text-atencao" aria-label="Principal" />
                      )}
                      {c.nome}
                      {c.telefone && (
                        <span className="inline-flex items-center gap-1 text-muted-foreground">
                          <Phone className="size-3" aria-hidden />
                          {c.telefone}
                        </span>
                      )}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {!fornecedores?.length && (
          <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            {busca || categoria
              ? "Nenhum fornecedor encontrado com esse filtro."
              : "Nenhum fornecedor cadastrado ainda."}
          </p>
        )}
      </div>
    </div>
  );
}
