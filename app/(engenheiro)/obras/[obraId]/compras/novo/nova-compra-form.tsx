"use client";

import { useActionState, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { createCompra, type CompraFormState } from "@/app/actions/compras";
import { ItemCompraPicker, type ItemCompraLocal } from "@/components/compras/item-compra-picker";
import { CampoFornecedor } from "@/components/compras/campo-fornecedor";
import { CampoCategoria, type Categoria } from "@/components/compras/campo-categoria";
import { CamposNotaFiscal } from "@/components/compras/campos-nota-fiscal";
import { Trash2 } from "lucide-react";
import { enviarArquivoParaStorage, removerArquivosDoStorage } from "@/lib/storage/upload-direto";
import { SeletorAnexos } from "@/components/compras/seletor-anexos";
import { MAX_ANEXOS_COMPRA } from "@/lib/compras/anexos";

const initialState: CompraFormState = { error: null };

const formasPagamento = [
  { value: "pix", label: "Pix" },
  { value: "dinheiro", label: "Dinheiro" },
  { value: "boleto", label: "Boleto" },
  { value: "cartao_credito", label: "Cartão de crédito" },
  { value: "cartao_debito", label: "Cartão de débito" },
  { value: "transferencia", label: "Transferência" },
  { value: "cheque", label: "Cheque" },
  { value: "outro", label: "Outro" },
];

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function totalItem(item: ItemCompraLocal) {
  const subtotal = item.quantidade * item.preco_unitario;
  if (item.desconto_tipo === "percentual") {
    return Math.max(subtotal * (1 - (item.desconto_valor ?? 0) / 100), 0);
  }
  if (item.desconto_tipo === "valor") {
    return Math.max(subtotal - (item.desconto_valor ?? 0), 0);
  }
  return subtotal;
}

let nextRowId = 1;
let nextItemId = 1;

/** Divide o total em `n` parcelas iguais, jogando os centavos de arredondamento na última. */
function splitIgual(ids: number[], total: number): Record<number, string> {
  const n = ids.length;
  if (!n) return {};
  const centavosTotal = Math.round(total * 100);
  const base = Math.floor(centavosTotal / n);
  const resto = centavosTotal - base * n;
  const resultado: Record<number, string> = {};
  ids.forEach((id, i) => {
    const centavos = base + (i === n - 1 ? resto : 0);
    resultado[id] = (centavos / 100).toFixed(2);
  });
  return resultado;
}

export function NovaCompraForm({
  obraId,
  fornecedores,
  etapasOrcamento,
  categorias,
}: {
  obraId: string;
  fornecedores: { id: string; nome: string }[];
  /** Etapas do orçamento ativo. Vazio quando a obra ainda não tem orçamento. */
  etapasOrcamento: string[];
  categorias: Categoria[];
}) {
  const action = createCompra.bind(null, obraId);
  const [state, formAction, pending] = useActionState(action, initialState);
  const [anexos, setAnexos] = useState<File[]>([]);
  const [erroAnexo, setErroAnexo] = useState<string | null>(null);
  const [enviandoAnexo, setEnviandoAnexo] = useState(false);

  /**
   * Os anexos sobem direto ao Storage antes da ação e o formulário leva só os
   * caminhos: arquivo pela Server Action estoura o limite de payload em
   * produção. Antes, um erro de upload era descartado em silêncio e a ordem
   * de compra nascia sem o anexo que o usuário achava ter enviado.
   *
   * Em série: se o segundo falhar, o que já subiu é removido antes de
   * desistir, para a tentativa frustrada não deixar arquivo órfão no bucket.
   */
  async function handleSubmit(formData: FormData) {
    setErroAnexo(null);

    if (anexos.length) {
      setEnviandoAnexo(true);
      const enviados: { path: string; nome: string }[] = [];
      for (const arquivo of anexos) {
        const envio = await enviarArquivoParaStorage("cotacoes", obraId, arquivo);
        if (envio.path === null) {
          await removerArquivosDoStorage("cotacoes", enviados.map((e) => e.path));
          setEnviandoAnexo(false);
          setErroAnexo(envio.error);
          return;
        }
        enviados.push({ path: envio.path, nome: arquivo.name });
      }
      setEnviandoAnexo(false);

      for (const anexo of enviados) {
        formData.append("anexo_path", anexo.path);
        formData.append("anexo_nome", anexo.nome);
      }
    }

    formAction(formData);
  }
  const [rows, setRows] = useState([{ id: nextRowId++ }]);
  const [valoresParcelas, setValoresParcelas] = useState<Record<number, string>>({});
  const [parcelasEditadas, setParcelasEditadas] = useState<Set<number>>(new Set());
  const [itens, setItens] = useState<(ItemCompraLocal & { localId: number })[]>([]);
  const [descontoNotaTipo, setDescontoNotaTipo] = useState<"" | "valor" | "percentual">("");
  const [descontoNotaValor, setDescontoNotaValor] = useState("");

  const totalParcelas = rows.length;
  const subtotalItens = itens.reduce((sum, item) => sum + totalItem(item), 0);
  const totalNota =
    descontoNotaTipo === "percentual"
      ? Math.max(subtotalItens * (1 - (Number(descontoNotaValor) || 0) / 100), 0)
      : descontoNotaTipo === "valor"
        ? Math.max(subtotalItens - (Number(descontoNotaValor) || 0), 0)
        : subtotalItens;

  // Enquanto nenhuma parcela foi editada manualmente, mantém o valor (das parcelas
  // existentes) acompanhando o total da nota conforme itens/desconto mudam.
  useEffect(() => {
    if (parcelasEditadas.size === 0) {
      setValoresParcelas(splitIgual(rows.map((r) => r.id), totalNota));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalNota]);

  function adicionarParcela() {
    setRows((prev) => {
      const novasRows = [...prev, { id: nextRowId++ }];
      setValoresParcelas(splitIgual(novasRows.map((r) => r.id), totalNota));
      setParcelasEditadas(new Set());
      return novasRows;
    });
  }

  function removerParcela(id: number) {
    setRows((prev) => {
      const novasRows = prev.filter((r) => r.id !== id);
      setValoresParcelas(splitIgual(novasRows.map((r) => r.id), totalNota));
      setParcelasEditadas(new Set());
      return novasRows;
    });
  }

  // O <form> não declara `encType`: com `action` função, o React define a
  // codificação sozinho e sobrescreve o que for declarado, e o atributo só
  // gerava divergência de hidratação (servidor "multipart/form-data" ×
  // cliente null). Também não haveria o que codificar — o anexo não é campo
  // deste form: ele sobe direto para o Storage no `handleSubmit`, e o que
  // entra no FormData é só o caminho devolvido.
  return (
    <form action={handleSubmit}>
      <input type="hidden" name="itens" value={JSON.stringify(itens)} readOnly />
      <FieldGroup>
        {/*
          Três seções, cada uma numa grade de duas colunas.
          
          Era uma coluna só, com dezesseis campos empilhados numa faixa de
          550px no meio de uma tela de 1400 — rolagem longa e nenhuma pista de
          onde um assunto termina e o outro começa. Agrupar por pergunta ("o
          que é a compra", "como se paga", "que condições tem") e emparelhar os
          campos curtos corta a altura quase pela metade.
          
          Campo largo (descrição, anexo) ocupa a linha inteira com
          `sm:col-span-2`: espremê-lo em meia largura não ajudaria ninguém.
        */}
        <FieldSeparator>Dados da compra</FieldSeparator>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="fornecedor_id">Fornecedor</FieldLabel>
            <CampoFornecedor fornecedores={fornecedores} />
          </Field>

          <Field>
            <FieldLabel htmlFor="categoria_id">Categoria</FieldLabel>
            <CampoCategoria categorias={categorias} />
            <FieldDescription>
              Se faltar alguma, digite o nome e crie na hora.
            </FieldDescription>
          </Field>

          <Field className="sm:col-span-2">
            <FieldLabel htmlFor="descricao">Descrição (resumo da ordem de compra)</FieldLabel>
            <Textarea id="descricao" name="descricao" rows={2} required />
          </Field>

          {/*
            Etapa do orçamento: é o que permite comparar orçado × comprado por
            etapa na tela do orçamento. Opcional de propósito — compra que não
            pertence a nenhuma etapa (uma ferramenta, um frete) não deve ser
            forçada dentro de uma.
          */}
          <Field>
            <FieldLabel htmlFor="orcamento_etapa">Etapa do orçamento (opcional)</FieldLabel>
            <select
              id="orcamento_etapa"
              name="orcamento_etapa"
              disabled={!etapasOrcamento.length}
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm disabled:opacity-60"
            >
              <option value="">Não vincular</option>
              {etapasOrcamento.map((etapa) => (
                <option key={etapa} value={etapa}>
                  {etapa}
                </option>
              ))}
            </select>
            <FieldDescription>
              {etapasOrcamento.length
                ? "Vinculando, esta ordem entra no comparativo orçado × comprado da etapa."
                : "Essa obra ainda não tem orçamento ativo com etapas."}
            </FieldDescription>
          </Field>

          {/*
            Tipo e categoria convivem, por ora.
            
            Chegaram a ser um só — a categoria carrega um tipo e dava para
            deduzir. Voltaram a ser dois porque o tipo vai descer para o ITEM:
            uma ordem pode trazer material e serviço na mesma nota, e aí a
            classificação deixa de ser da ordem.
          */}
          <Field>
            <FieldLabel htmlFor="tipo_item">Tipo</FieldLabel>
            <select
              id="tipo_item"
              name="tipo_item"
              defaultValue=""
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
            >
              <option value="">Não classificar</option>
              <option value="material">Material</option>
              <option value="servico">Serviço</option>
              <option value="mao_de_obra">Mão de obra</option>
            </select>
            <FieldDescription>Separa os gastos no comparativo com o orçamento.</FieldDescription>
          </Field>
        </div>

        <FieldSeparator>Pagamento e documentos</FieldSeparator>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="forma_pagamento">Forma de pagamento</FieldLabel>
            <select
              id="forma_pagamento"
              name="forma_pagamento"
              required
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
            >
              {formasPagamento.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </Field>

          <Field>
            <FieldLabel htmlFor="data_cotacao">Data da cotação</FieldLabel>
            <Input
              id="data_cotacao"
              name="data_cotacao"
              type="date"
              defaultValue={new Date().toISOString().slice(0, 10)}
              required
            />
          </Field>

          {/*
            Entrega da ORDEM, uma vez só.
            
            Era campo de cada parcela, e o formulário perguntava em todas —
            três parcelas do mesmo cimento pediam três vezes quando o cimento
            chega. A mercadoria chega uma vez.
          */}
          <Field>
            <FieldLabel htmlFor="data_entrega_prevista">Entrega prevista (opcional)</FieldLabel>
            <Input id="data_entrega_prevista" name="data_entrega_prevista" type="date" />
          </Field>

          <Field className="sm:col-span-2">
            <FieldLabel htmlFor="anexo_cotacao">Anexos (opcional)</FieldLabel>
            <SeletorAnexos id="anexo_cotacao" arquivos={anexos} aoMudar={setAnexos} />
            <FieldDescription>
              Até {MAX_ANEXOS_COMPRA} arquivos — cotação, orçamento do fornecedor, nota.
            </FieldDescription>
            {erroAnexo && <FieldError>{erroAnexo}</FieldError>}
          </Field>

          <CamposNotaFiscal className="sm:col-span-2" />
        </div>

        <FieldSeparator>Condições</FieldSeparator>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field orientation="horizontal">
            <Checkbox id="pagamento_apos_recebimento" name="pagamento_apos_recebimento" />
            <FieldContent>
              <FieldLabel htmlFor="pagamento_apos_recebimento">
                Pagar somente após o recebimento da mercadoria
              </FieldLabel>
            </FieldContent>
          </Field>

          <Field orientation="horizontal">
            <Checkbox id="requer_aprovacao_cliente" name="requer_aprovacao_cliente" />
            <FieldContent>
              <FieldLabel htmlFor="requer_aprovacao_cliente">
                Exigir aprovação do cliente antes do pagamento
              </FieldLabel>
            </FieldContent>
          </Field>
        </div>

        <FieldSeparator>Itens</FieldSeparator>

        {!!itens.length && (
          <div className="overflow-x-auto rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Un.</TableHead>
                  <TableHead>Qtd.</TableHead>
                  <TableHead>Preço unit.</TableHead>
                  <TableHead>Desconto</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {itens.map((item) => (
                  <TableRow key={item.localId}>
                    <TableCell className="max-w-48 truncate">{item.descricao}</TableCell>
                    <TableCell>{item.unidade}</TableCell>
                    <TableCell>{item.quantidade}</TableCell>
                    <TableCell>{formatCurrency(item.preco_unitario)}</TableCell>
                    <TableCell className="text-xs">
                      {item.desconto_tipo === "percentual"
                        ? `${item.desconto_valor}%`
                        : item.desconto_tipo === "valor"
                          ? formatCurrency(item.desconto_valor ?? 0)
                          : "—"}
                    </TableCell>
                    <TableCell>{formatCurrency(totalItem(item))}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() =>
                          setItens((prev) => prev.filter((i) => i.localId !== item.localId))
                        }
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <ItemCompraPicker
          obraId={obraId}
          onAdd={(item) => setItens((prev) => [...prev, { ...item, localId: nextItemId++ }])}
        />

        <Field orientation="responsive">
          <div className="w-full">
            <FieldLabel htmlFor="desconto_tipo">Desconto na nota (opcional)</FieldLabel>
            <select
              id="desconto_tipo"
              name="desconto_tipo"
              value={descontoNotaTipo}
              onChange={(e) => setDescontoNotaTipo(e.target.value as typeof descontoNotaTipo)}
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
            >
              <option value="">Sem desconto</option>
              <option value="valor">Valor fixo (R$)</option>
              <option value="percentual">Percentual (%)</option>
            </select>
          </div>
          {descontoNotaTipo && (
            <div className="w-full">
              <FieldLabel htmlFor="desconto_valor">
                {descontoNotaTipo === "percentual" ? "Desconto (%)" : "Desconto (R$)"}
              </FieldLabel>
              <Input
                id="desconto_valor"
                name="desconto_valor"
                type="number"
                step="0.01"
                min="0"
                max={descontoNotaTipo === "percentual" ? 100 : undefined}
                value={descontoNotaValor}
                onChange={(e) => setDescontoNotaValor(e.target.value)}
              />
            </div>
          )}
        </Field>

        <div className="flex flex-col gap-1 rounded-lg border bg-muted/30 p-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal dos itens</span>
            <span>{formatCurrency(subtotalItens)}</span>
          </div>
          {descontoNotaTipo && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Desconto da nota</span>
              <span>-{formatCurrency(subtotalItens - totalNota)}</span>
            </div>
          )}
          <div className="flex justify-between font-medium">
            <span>Total da ordem de compra</span>
            <span>{formatCurrency(totalNota)}</span>
          </div>
        </div>

        <FieldSeparator>Parcelas</FieldSeparator>

        <div className="flex flex-col gap-3">
          {rows.map((row, i) => (
            <div
              key={row.id}
              className="grid grid-cols-1 items-end gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_1fr_auto]"
            >
              <div>
                <FieldLabel htmlFor={`parcela_valor_${i}`}>Valor (R$)</FieldLabel>
                <Input
                  id={`parcela_valor_${i}`}
                  name={`parcela_valor_${i}`}
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={valoresParcelas[row.id] ?? ""}
                  onChange={(e) => {
                    const valor = e.target.value;
                    setValoresParcelas((prev) => ({ ...prev, [row.id]: valor }));
                    setParcelasEditadas((prev) => new Set(prev).add(row.id));
                  }}
                />
              </div>
              <div>
                <FieldLabel htmlFor={`parcela_vencimento_${i}`}>Vencimento</FieldLabel>
                <Input
                  id={`parcela_vencimento_${i}`}
                  name={`parcela_vencimento_${i}`}
                  type="date"
                  required
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={rows.length === 1}
                onClick={() => removerParcela(row.id)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>

        <Button type="button" variant="outline" size="sm" className="w-fit" onClick={adicionarParcela}>
          Adicionar parcela
        </Button>

        {state.error && <FieldError>{state.error}</FieldError>}

        <Button type="submit" disabled={pending || enviandoAnexo || !itens.length}>
          {pending || enviandoAnexo
            ? "Salvando..."
            : `Registrar ordem de compra (${totalParcelas} parcela${totalParcelas > 1 ? "s" : ""})`}
        </Button>
      </FieldGroup>
    </form>
  );
}
