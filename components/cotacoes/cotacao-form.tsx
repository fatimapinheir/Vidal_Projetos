"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field";
import { criarCotacao, atualizarCotacao, type CotacaoFormState } from "@/app/actions/cotacoes";

const initialState: CotacaoFormState = { error: null };

export type CotacaoInicial = {
  id: string;
  descricao: string;
  orcamentoEtapa: string;
  prazoDecisao: string;
  observacoes: string;
};

/**
 * A cotação em si: só o QUE se quer comprar.
 *
 * Fornecedor, preço, parcelas e prazo não estão aqui de propósito — são da
 * PROPOSTA, e é justamente o que vai variar entre elas. Perguntar preço nesta
 * tela sugeriria que a cotação tem um valor, e ela não tem: tem uma faixa.
 *
 * Por isso o formulário é curto. Cadastrar uma cotação precisa ser mais rápido
 * que cadastrar uma ordem de compra, senão o engenheiro cria a ordem direto e
 * a comparação nunca acontece.
 */
export function CotacaoForm({
  obraId,
  etapasOrcamento,
  inicial,
}: {
  obraId: string;
  /** Etapas da versão ativa do orçamento. Vazio quando a obra não tem orçamento. */
  etapasOrcamento: string[];
  inicial?: CotacaoInicial;
}) {
  const action = inicial
    ? atualizarCotacao.bind(null, obraId, inicial.id)
    : criarCotacao.bind(null, obraId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction}>
      <FieldGroup>
        <FieldSeparator>O que está sendo cotado</FieldSeparator>

        <Field>
          <FieldLabel htmlFor="descricao">Descrição</FieldLabel>
          <Textarea
            id="descricao"
            name="descricao"
            rows={2}
            required
            placeholder="Material hidráulico — pavimento térreo"
            defaultValue={inicial?.descricao}
          />
          <FieldDescription>
            É este texto que vira a descrição da ordem de compra, quando uma proposta for escolhida.
          </FieldDescription>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="orcamento_etapa">Etapa do orçamento (opcional)</FieldLabel>
            <select
              id="orcamento_etapa"
              name="orcamento_etapa"
              defaultValue={inicial?.orcamentoEtapa ?? ""}
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
            >
              <option value="">Não vincular</option>
              {etapasOrcamento.map((etapa) => (
                <option key={etapa} value={etapa}>
                  {etapa}
                </option>
              ))}
            </select>
            <FieldDescription>
              A ordem gerada já nasce ligada a ela, sem reclassificar depois.
            </FieldDescription>
          </Field>

          {/*
            Prazo para decidir, e não "validade da cotação": o que importa aqui
            é até quando o cliente tem para escolher. A validade é de cada
            proposta, e cada fornecedor dá a sua.
          */}
          <Field>
            <FieldLabel htmlFor="prazo_decisao">Prazo para decidir (opcional)</FieldLabel>
            <Input
              id="prazo_decisao"
              name="prazo_decisao"
              type="date"
              defaultValue={inicial?.prazoDecisao}
            />
          </Field>
        </div>

        <Field>
          <FieldLabel htmlFor="observacoes">Observações para o cliente (opcional)</FieldLabel>
          <Textarea
            id="observacoes"
            name="observacoes"
            rows={3}
            placeholder="O que pesa na decisão além do preço — prazo, marca, condição de pagamento."
            defaultValue={inicial?.observacoes}
          />
          <FieldDescription>Aparece na tela em que o cliente escolhe.</FieldDescription>
        </Field>

        {state.error && <FieldError>{state.error}</FieldError>}

        <Button type="submit" disabled={pending}>
          {pending ? "Salvando..." : inicial ? "Salvar alterações" : "Criar cotação"}
        </Button>
      </FieldGroup>
    </form>
  );
}
