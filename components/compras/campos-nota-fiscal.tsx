"use client";

import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Field, FieldContent, FieldLabel } from "@/components/ui/field";
import { cn } from "@/lib/utils";

/**
 * Checkbox de nota fiscal e os dois campos que ele revela.
 *
 * Os campos ficam escondidos até a marcação porque boa parte das despesas de
 * obra não tem nota — mostrar número e data sempre colocaria dois campos
 * vazios no caminho de quem só vai lançar um pagamento de água.
 *
 * Não existe campo "tem nota" no banco: o número preenchido já é a resposta.
 * Desmarcar limpa os dois, e é por isso que os inputs são desmontados em vez
 * de ocultados — input escondido continua enviando o que tinha dentro.
 */
export function CamposNotaFiscal({
  numeroInicial = "",
  emissaoInicial = "",
  className,
}: {
  numeroInicial?: string;
  emissaoInicial?: string;
  /** Para ocupar a linha inteira quando está dentro de uma grade. */
  className?: string;
}) {
  const [temNota, setTemNota] = useState(!!numeroInicial);

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <Field orientation="horizontal">
        <Checkbox
          id="tem_nota_fiscal"
          checked={temNota}
          onCheckedChange={(marcado) => setTemNota(marcado === true)}
        />
        <FieldContent>
          <FieldLabel htmlFor="tem_nota_fiscal">Tem nota fiscal</FieldLabel>
        </FieldContent>
      </Field>

      {temNota && (
        <Field orientation="responsive">
          <div className="w-full">
            <FieldLabel htmlFor="nota_fiscal_numero">Número da NF</FieldLabel>
            <Input
              id="nota_fiscal_numero"
              name="nota_fiscal_numero"
              defaultValue={numeroInicial}
              required
              inputMode="numeric"
              placeholder="000123"
            />
          </div>
          <div className="w-full">
            <FieldLabel htmlFor="nota_fiscal_emissao">Data de emissão</FieldLabel>
            <Input
              id="nota_fiscal_emissao"
              name="nota_fiscal_emissao"
              type="date"
              defaultValue={emissaoInicial}
              required
            />
          </div>
        </Field>
      )}
    </div>
  );
}
