"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldLabel,
  FieldDescription,
  FieldSeparator,
} from "@/components/ui/field";
import type { CondicaoPagamento, FormaPagamento } from "@/lib/types/database.types";
import { CampoCategorias, type CategoriaFornecedor } from "./campo-categorias";

export const classeSelect =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm";

const formasPagamento: { valor: FormaPagamento; label: string }[] = [
  { valor: "pix", label: "Pix" },
  { valor: "boleto", label: "Boleto" },
  { valor: "transferencia", label: "Transferência" },
  { valor: "dinheiro", label: "Dinheiro" },
  { valor: "cartao_credito", label: "Cartão de crédito" },
  { valor: "cartao_debito", label: "Cartão de débito" },
  { valor: "cheque", label: "Cheque" },
  { valor: "outro", label: "Outro" },
];

const rotuloDados: Partial<Record<FormaPagamento, string>> = {
  pix: "Chave pix",
  transferencia: "Banco, agência e conta",
  boleto: "Instruções para o boleto",
};

export type FornecedorCampos = {
  nome: string;
  razao_social: string | null;
  cnpj_cpf: string | null;
  telefone: string | null;
  email: string | null;
  observacoes: string | null;
  forma_pagamento: FormaPagamento | null;
  dados_pagamento: string | null;
  condicao_pagamento: CondicaoPagamento | null;
  condicao_prazo: string | null;
};

/**
 * Identificação e condições de pagamento do fornecedor.
 *
 * Compartilhado entre cadastrar e editar. Os vendedores ficam de fora: na
 * criação são linhas soltas que ainda não existem no banco, na edição são
 * registros com id próprio, adicionados e removidos um a um. São dois
 * controles diferentes para o mesmo dado, e juntá-los aqui só criaria um
 * componente cheio de "se for edição".
 */
export function FornecedorFormCampos({
  fornecedor,
  categorias,
  categoriasMarcadas,
}: {
  fornecedor?: Partial<FornecedorCampos>;
  categorias: CategoriaFornecedor[];
  categoriasMarcadas?: string[];
}) {
  const [forma, setForma] = useState<FormaPagamento | "">(fornecedor?.forma_pagamento ?? "");
  const [condicao, setCondicao] = useState<CondicaoPagamento | "">(
    fornecedor?.condicao_pagamento ?? ""
  );

  const precisaDados = forma !== "" && forma !== "dinheiro";

  return (
    <>
      <Field>
        <FieldLabel htmlFor="nome">Nome fantasia</FieldLabel>
        <Input
          id="nome"
          name="nome"
          required
          placeholder="Depósito Central"
          defaultValue={fornecedor?.nome ?? ""}
        />
        {/* É este que aparece em ordem de compra, locação e RDO — por isso ele
            é o obrigatório, e não a razão social. */}
        <FieldDescription>O nome que aparece em todas as telas do sistema.</FieldDescription>
      </Field>

      <Field>
        <FieldLabel htmlFor="razao_social">Razão social</FieldLabel>
        <Input
          id="razao_social"
          name="razao_social"
          placeholder="Depósito Central Comércio de Materiais Ltda"
          defaultValue={fornecedor?.razao_social ?? ""}
        />
        <FieldDescription>Para a nota fiscal e o pagamento. Opcional.</FieldDescription>
      </Field>

      <Field orientation="responsive">
        <div className="w-full">
          <FieldLabel htmlFor="cnpj_cpf">CNPJ/CPF</FieldLabel>
          <Input id="cnpj_cpf" name="cnpj_cpf" defaultValue={fornecedor?.cnpj_cpf ?? ""} />
        </div>
        <div className="w-full">
          <FieldLabel htmlFor="telefone">Telefone da empresa</FieldLabel>
          <Input id="telefone" name="telefone" defaultValue={fornecedor?.telefone ?? ""} />
        </div>
      </Field>

      <Field>
        <FieldLabel htmlFor="email">E-mail</FieldLabel>
        <Input id="email" name="email" type="email" defaultValue={fornecedor?.email ?? ""} />
      </Field>

      <FieldSeparator />

      <CampoCategorias categorias={categorias} marcadas={categoriasMarcadas} />

      <FieldSeparator />

      <Field orientation="responsive">
        <div className="w-full">
          <FieldLabel htmlFor="forma_pagamento">Forma de pagamento</FieldLabel>
          <select
            id="forma_pagamento"
            name="forma_pagamento"
            value={forma}
            onChange={(e) => setForma(e.target.value as FormaPagamento | "")}
            className={classeSelect}
          >
            <option value="">Não informada</option>
            {formasPagamento.map((f) => (
              <option key={f.valor} value={f.valor}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
        <div className="w-full">
          <FieldLabel htmlFor="condicao_pagamento">Condição</FieldLabel>
          <select
            id="condicao_pagamento"
            name="condicao_pagamento"
            value={condicao}
            onChange={(e) => setCondicao(e.target.value as CondicaoPagamento | "")}
            className={classeSelect}
          >
            <option value="">Não informada</option>
            <option value="a_vista">À vista</option>
            <option value="prazo">A prazo</option>
          </select>
        </div>
      </Field>

      {precisaDados && (
        <Field>
          <FieldLabel htmlFor="dados_pagamento">
            {rotuloDados[forma as FormaPagamento] ?? "Dados para pagamento"}
          </FieldLabel>
          <Input
            id="dados_pagamento"
            name="dados_pagamento"
            required={forma === "pix"}
            placeholder={forma === "pix" ? "CNPJ, telefone, e-mail ou chave aleatória" : ""}
            defaultValue={fornecedor?.dados_pagamento ?? ""}
          />
        </Field>
      )}

      {condicao === "prazo" && (
        <Field>
          <FieldLabel htmlFor="condicao_prazo">Prazo</FieldLabel>
          <Input
            id="condicao_prazo"
            name="condicao_prazo"
            required
            placeholder="30/60/90 dias, 28 dias fora a quinzena..."
            defaultValue={fornecedor?.condicao_prazo ?? ""}
          />
          <FieldDescription>
            Texto livre — prazo de fornecedor raramente cabe num número só.
          </FieldDescription>
        </Field>
      )}

      <Field>
        <FieldLabel htmlFor="observacoes">Observações</FieldLabel>
        <Input id="observacoes" name="observacoes" defaultValue={fornecedor?.observacoes ?? ""} />
      </Field>
    </>
  );
}
