"use client";

import { useState } from "react";
import { useFormularioDeDialogo } from "@/lib/hooks/usar-formulario-de-dialogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldContent,
  FieldGroup,
  FieldLabel,
  FieldDescription,
  FieldError,
} from "@/components/ui/field";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Pencil } from "lucide-react";
import { criarLocacao, atualizarLocacao, type LocacaoFormState } from "@/app/actions/locacoes";
import type { LocacaoUnidade } from "@/lib/types/database.types";

const initialState: LocacaoFormState = { error: null };

export type LocacaoEditavel = {
  id: string;
  fornecedor_id: string;
  equipamento: string;
  quantidade: number;
  unidade: LocacaoUnidade;
  valor_unitario: number;
  data_inicio: string;
  horas_utilizadas: number;
  data_devolucao: string | null;
  data_primeiro_vencimento: string | null;
  meses_contratados: number | null;
  observacoes: string | null;
};

const classeSelect = "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm";

export function LocacaoDialog({
  obraId,
  fornecedores,
  locacao,
}: {
  obraId: string;
  fornecedores: { id: string; nome: string }[];
  /** Ausente = nova locação. Presente = edição da locação existente. */
  locacao?: LocacaoEditavel;
}) {
  const editando = !!locacao;
  const [unidade, setUnidade] = useState<LocacaoUnidade>(locacao?.unidade ?? "dia");
  const [devolvido, setDevolvido] = useState(!!locacao?.data_devolucao);

  const action = editando
    ? atualizarLocacao.bind(null, obraId, locacao.id)
    : criarLocacao.bind(null, obraId);
  const { aberto, mudarAberto, enviar, erro, enviando } = useFormularioDeDialogo({
    acao: action,
    estadoInicial: initialState,
    aoFechar: () => {
      setUnidade(locacao?.unidade ?? "dia");
      setDevolvido(!!locacao?.data_devolucao);
    },
  });

  return (
    <Dialog open={aberto} onOpenChange={mudarAberto}>
      <DialogTrigger
        render={
          editando ? (
            <Button variant="ghost" size="icon-sm" aria-label="Editar locação">
              <Pencil className="size-4" />
            </Button>
          ) : (
            <Button>Nova locação</Button>
          )
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editando ? "Editar locação" : "Nova locação de equipamento"}</DialogTitle>
        </DialogHeader>
        <form action={enviar}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="equipamento">Equipamento</FieldLabel>
              <Input
                id="equipamento"
                name="equipamento"
                required
                defaultValue={locacao?.equipamento}
                placeholder="Betoneira 400L, andaime, compactador..."
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="fornecedor_id">Locador</FieldLabel>
              <select
                id="fornecedor_id"
                name="fornecedor_id"
                required
                defaultValue={locacao?.fornecedor_id ?? ""}
                className={classeSelect}
              >
                <option value="">Selecione...</option>
                {fornecedores.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nome}
                  </option>
                ))}
              </select>
              <FieldDescription>
                Vem do cadastro de fornecedores. Se o locador ainda não estiver lá, cadastre em
                Fornecedores no menu.
              </FieldDescription>
            </Field>

            <Field orientation="responsive">
              <div className="w-full">
                <FieldLabel htmlFor="quantidade">Quantidade</FieldLabel>
                <Input
                  id="quantidade"
                  name="quantidade"
                  type="number"
                  min={1}
                  step={1}
                  required
                  defaultValue={locacao?.quantidade ?? 1}
                />
              </div>
              <div className="w-full">
                <FieldLabel htmlFor="unidade">Cobrança</FieldLabel>
                <select
                  id="unidade"
                  name="unidade"
                  value={unidade}
                  onChange={(e) => setUnidade(e.target.value as LocacaoUnidade)}
                  className={classeSelect}
                >
                  <option value="dia">Por dia</option>
                  <option value="hora">Por hora</option>
                  <option value="mes">Por mês</option>
                </select>
              </div>
              <div className="w-full">
                <FieldLabel htmlFor="valor_unitario">
                  {unidade === "dia"
                    ? "Valor por dia (R$)"
                    : unidade === "hora"
                      ? "Valor por hora (R$)"
                      : "Valor por mês (R$)"}
                </FieldLabel>
                <Input
                  id="valor_unitario"
                  name="valor_unitario"
                  required
                  inputMode="decimal"
                  defaultValue={locacao?.valor_unitario}
                  placeholder="150,00"
                />
              </div>
            </Field>

            <Field orientation="responsive">
              <div className="w-full">
                <FieldLabel htmlFor="data_inicio">Data inicial da locação</FieldLabel>
                <Input
                  id="data_inicio"
                  name="data_inicio"
                  type="date"
                  required
                  defaultValue={locacao?.data_inicio}
                />
              </div>
              {unidade === "hora" && (
                <div className="w-full">
                  <FieldLabel htmlFor="horas_utilizadas">Horas utilizadas</FieldLabel>
                  <Input
                    id="horas_utilizadas"
                    name="horas_utilizadas"
                    inputMode="decimal"
                    defaultValue={locacao?.horas_utilizadas ?? 0}
                    placeholder="0"
                  />
                </div>
              )}
            </Field>

            {unidade === "hora" && (
              <FieldDescription>
                Na cobrança por hora o valor sai das horas que você informar aqui (do horímetro ou
                da medição do locador) — vá atualizando conforme o equipamento roda. Por dia, o
                sistema conta sozinho os dias corridos desde a data inicial.
              </FieldDescription>
            )}

            {/*
              Cobrança mensal: os dois campos que transformam a locação em
              conta a pagar.
              
              Por dia e por hora o custo CORRE — sobe enquanto o equipamento
              está na obra — e não existe boleto a vencer. O contrato mensal é
              o contrário: são obrigações com data, e é delas que sai a parcela
              que o engenheiro precisa pagar. Com estes dois campos o sistema
              monta uma ordem de compra com uma parcela por mês, e a
              mensalidade passa a aparecer em contas a pagar como qualquer
              outra conta.
            */}
            {unidade === "mes" && (
              <>
                <Field orientation="responsive">
                  <div className="w-full">
                    <FieldLabel htmlFor="data_primeiro_vencimento">
                      Vencimento da 1ª mensalidade
                    </FieldLabel>
                    <Input
                      id="data_primeiro_vencimento"
                      name="data_primeiro_vencimento"
                      type="date"
                      required
                      defaultValue={locacao?.data_primeiro_vencimento ?? undefined}
                    />
                  </div>
                  <div className="w-full">
                    <FieldLabel htmlFor="meses_contratados">Meses contratados</FieldLabel>
                    <Input
                      id="meses_contratados"
                      name="meses_contratados"
                      type="number"
                      min={1}
                      max={120}
                      step={1}
                      required
                      defaultValue={locacao?.meses_contratados ?? 1}
                    />
                  </div>
                </Field>
                <FieldDescription>
                  O sistema gera uma ordem de compra com uma parcela por mês, vencendo sempre no
                  mesmo dia, e ela entra em contas a pagar. Quando o contrato se estender, aumente
                  os meses aqui — as mensalidades já pagas não são mexidas.
                </FieldDescription>
              </>
            )}

            <Field orientation="horizontal">
              <Checkbox
                id="devolvido"
                name="devolvido"
                checked={devolvido}
                onCheckedChange={(checked) => setDevolvido(checked === true)}
              />
              <FieldContent>
                <FieldLabel htmlFor="devolvido">Equipamento devolvido</FieldLabel>
                <FieldDescription>
                  Encerra a contagem financeira: o valor para de subir e congela na data da
                  devolução.
                </FieldDescription>
              </FieldContent>
            </Field>

            {devolvido && (
              <Field>
                <FieldLabel htmlFor="data_devolucao">Data da devolução</FieldLabel>
                <Input
                  id="data_devolucao"
                  name="data_devolucao"
                  type="date"
                  defaultValue={locacao?.data_devolucao ?? undefined}
                />
                <FieldDescription>Deixe em branco para usar a data de hoje.</FieldDescription>
              </Field>
            )}

            <Field>
              <FieldLabel htmlFor="observacoes">Observações (opcional)</FieldLabel>
              <Input
                id="observacoes"
                name="observacoes"
                defaultValue={locacao?.observacoes ?? undefined}
                placeholder="Nº do contrato, estado do equipamento, etc."
              />
            </Field>

            {erro && <FieldError>{erro}</FieldError>}

            <Button type="submit" disabled={enviando}>
              {enviando ? "Salvando..." : editando ? "Salvar alterações" : "Registrar locação"}
            </Button>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
