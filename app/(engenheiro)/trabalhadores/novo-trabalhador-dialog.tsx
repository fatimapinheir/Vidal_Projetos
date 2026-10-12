"use client";

import { useState } from "react";
import { useFormularioDeDialogo } from "@/lib/hooks/usar-formulario-de-dialogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldGroup, FieldLabel, FieldError, FieldDescription } from "@/components/ui/field";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createTrabalhador, type TrabalhadorFormState } from "@/app/actions/trabalhadores";
import type { FormaPagamento, RegimePagamento } from "@/lib/types/database.types";

const initialState: TrabalhadorFormState = { error: null };

const classeSelect = "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm";

const formasPagamento: { valor: FormaPagamento; label: string }[] = [
  { valor: "pix", label: "Pix" },
  { valor: "transferencia", label: "Transferência" },
  { valor: "dinheiro", label: "Dinheiro" },
  { valor: "cheque", label: "Cheque" },
  { valor: "boleto", label: "Boleto" },
  { valor: "outro", label: "Outro" },
];

/** O campo de dados muda de nome conforme a forma escolhida — "chave pix" e
 *  "agência e conta" pedem coisas diferentes de quem preenche. */
const rotuloDados: Partial<Record<FormaPagamento, string>> = {
  pix: "Chave pix",
  transferencia: "Banco, agência e conta",
  cheque: "Nominal a",
};

export function NovoTrabalhadorDialog() {
  const [regime, setRegime] = useState<RegimePagamento>("diaria");
  const [forma, setForma] = useState<FormaPagamento | "">("");
  const { aberto, mudarAberto, enviar, erro, enviando } = useFormularioDeDialogo({
    acao: createTrabalhador,
    estadoInicial: initialState,
    aoFechar: () => {
      setRegime("diaria");
      setForma("");
    },
  });

  const precisaDados = forma !== "" && forma !== "dinheiro";

  return (
    <Dialog open={aberto} onOpenChange={mudarAberto}>
      <DialogTrigger render={<Button>Novo colaborador</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo colaborador</DialogTitle>
        </DialogHeader>
        <form action={enviar}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="nome">Nome</FieldLabel>
              <Input id="nome" name="nome" required />
            </Field>

            <Field>
              <FieldLabel htmlFor="funcao">Função</FieldLabel>
              <Input id="funcao" name="funcao" placeholder="Pedreiro, servente, eletricista..." />
            </Field>

            <Field>
              <FieldLabel htmlFor="regime_pagamento">Regime de pagamento</FieldLabel>
              <select
                id="regime_pagamento"
                name="regime_pagamento"
                value={regime}
                onChange={(e) => setRegime(e.target.value as RegimePagamento)}
                className={classeSelect}
              >
                <option value="diaria">Diária</option>
                <option value="pacote_servico">Pacote de serviço</option>
              </select>
              <FieldDescription>
                {regime === "diaria"
                  ? "O pagamento é calculado pelos dias trabalhados × o valor da diária."
                  : "Valor fechado pelo serviço, sem contagem de dias. O valor é combinado na obra."}
              </FieldDescription>
            </Field>

            {/* Diária padrão só aparece no regime de diária: guardá-la num
                colaborador por pacote induziria a erro no fechamento. */}
            {regime === "diaria" && (
              <Field>
                <FieldLabel htmlFor="valor_diaria_padrao">Diária padrão (R$)</FieldLabel>
                <Input
                  id="valor_diaria_padrao"
                  name="valor_diaria_padrao"
                  type="number"
                  step="0.01"
                  min="0"
                />
                <FieldDescription>
                  Sugestão ao alocar em uma obra — o valor final é definido lá, obra a obra.
                </FieldDescription>
              </Field>
            )}

            <Field>
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
                  placeholder={forma === "pix" ? "CPF, telefone, e-mail ou chave aleatória" : ""}
                />
              </Field>
            )}

            <Field>
              <FieldLabel htmlFor="cpf">CPF</FieldLabel>
              <Input id="cpf" name="cpf" />
            </Field>

            <Field>
              <FieldLabel htmlFor="telefone">Telefone</FieldLabel>
              <Input id="telefone" name="telefone" />
            </Field>

            {erro && <FieldError>{erro}</FieldError>}
            <Button type="submit" disabled={enviando}>
              {enviando ? "Salvando..." : "Salvar colaborador"}
            </Button>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
