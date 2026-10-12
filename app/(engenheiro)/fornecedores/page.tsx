import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Phone, Star } from "lucide-react";
import { NovoFornecedorDialog } from "./novo-fornecedor-dialog";
import { EditarFornecedorDialog } from "@/components/fornecedores/editar-fornecedor-dialog";
import { AlternarAtivoFornecedor } from "@/components/fornecedores/alternar-ativo-fornecedor";
import type { CondicaoPagamento, FormaPagamento } from "@/lib/types/database.types";

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

export default async function FornecedoresPage() {
  const supabase = await createClient();

  const { data: fornecedores } = await supabase
    .from("fornecedores")
    .select(
      "*, fornecedor_contatos(id, nome, telefone, email, principal), fornecedor_pagamento(forma_pagamento, dados_pagamento, condicao_pagamento, condicao_prazo)"
    )
    .order("ativo", { ascending: false })
    .order("nome");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-lg font-semibold">Fornecedores</h1>
          <p className="text-sm text-muted-foreground">
            Cadastro usado nas ordens de compra. Cada fornecedor pode ter vários vendedores — o
            marcado como principal é o que atende você.
          </p>
        </div>
        <NovoFornecedorDialog />
      </div>

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
                  <p className="text-sm text-muted-foreground">
                    {[f.cnpj_cpf, f.telefone, f.email].filter(Boolean).join(" · ") || "—"}
                  </p>
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
            Nenhum fornecedor cadastrado ainda.
          </p>
        )}
      </div>
    </div>
  );
}
