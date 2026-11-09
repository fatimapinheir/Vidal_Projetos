"use client";

import { useActionState, useState } from "react";
import { Trash2, Pencil } from "lucide-react";
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
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { criarProposta, atualizarProposta, type CotacaoFormState } from "@/app/actions/cotacoes";
import {
  subtotalDosItens,
  totalLiquidoDoItem,
  aplicarDescontoDaNota,
  rotuloDesconto,
} from "@/lib/compras/total-item";
import { ratearEmParcelasIguais } from "@/lib/compras/rateio";
import { enviarAnexos, anexarAoForm } from "@/lib/storage/enviar-anexos";
import {
  ItemCompraPicker,
  type ItemCompraLocal,
  type InsumoOpcao,
} from "@/components/compras/item-compra-picker";
import { CampoFornecedor } from "@/components/compras/campo-fornecedor";
import { CampoCategoria, type Categoria } from "@/components/compras/campo-categoria";
import { SeletorAnexos } from "@/components/compras/seletor-anexos";
import { MAX_ANEXOS_COMPRA } from "@/lib/compras/anexos";

const initialState: CotacaoFormState = { error: null };

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

function moeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

let proximaLinha = 1;
let proximoItem = 1;

export type PropostaInicial = {
  id: string;
  fornecedorId: string;
  categoriaId: string;
  observacoes: string;
  formaPagamento: string;
  dataProposta: string;
  entregaPrevista: string;
  descontoTipo: "" | "valor" | "percentual";
  descontoValor: string;
  itens: ItemCompraLocal[];
  parcelas: { valor: string; vencimento: string }[];
};

/**
 * Uma proposta de preço: o fornecedor, o que ele cotou, e em que condições.
 *
 * É a ordem de compra sem o que ainda não existe. Não tem nota fiscal (não
 * houve compra), não tem "exigir aprovação do cliente" (a cotação INTEIRA é o
 * pedido de aprovação) e não tem etapa do orçamento (é da cotação — as três
 * propostas são para a mesma etapa, por definição).
 *
 * O que ela tem de igual é o que a conversão depende: itens do catálogo de
 * insumos, desconto por item e na nota, e o plano de parcelas. `escolher_proposta`
 * copia isso coluna a coluna para `compras`, então o que o formulário aceitar
 * aqui precisa ser aceitável como ordem de compra lá — daí a conferência de
 * "parcelas somam o total" existir nos dois lugares.
 *
 * Formulário próprio, e não o de ordem de compra parametrizado: as diferenças
 * são de campo, e espalhar `variante === "proposta"` por setecentas linhas
 * custaria mais do que as duas marcações separadas. O que não podia ser
 * duplicado é a LÓGICA — rateio e upload de anexo vivem em `lib/` e são as
 * mesmas funções que a ordem de compra usa.
 */
export function PropostaForm({
  obraId,
  cotacaoId,
  fornecedores,
  categorias,
  insumos,
  inicial,
}: {
  obraId: string;
  cotacaoId: string;
  fornecedores: { id: string; nome: string }[];
  categorias: Categoria[];
  insumos: InsumoOpcao[];
  inicial?: PropostaInicial;
}) {
  const editando = !!inicial;
  const action = inicial
    ? atualizarProposta.bind(null, obraId, cotacaoId, inicial.id)
    : criarProposta.bind(null, obraId, cotacaoId);
  const [state, formAction, pending] = useActionState(action, initialState);

  const [itemEditando, setItemEditando] = useState<number | null>(null);
  const [anexos, setAnexos] = useState<File[]>([]);
  const [erroLocal, setErroLocal] = useState<string | null>(null);
  const [enviandoAnexo, setEnviandoAnexo] = useState(false);

  // Mesma razão do formulário de ordem: `rows` e `valoresEditados` falam das
  // mesmas parcelas e precisam compartilhar os ids.
  const [linhasIniciais] = useState(() =>
    (inicial?.parcelas.length ? inicial.parcelas : [{ valor: "", vencimento: "" }]).map((p) => ({
      id: proximaLinha++,
      vencimento: p.vencimento,
      valor: p.valor,
    }))
  );
  const [rows, setRows] = useState<{ id: number; vencimento: string }[]>(() =>
    linhasIniciais.map(({ id, vencimento }) => ({ id, vencimento }))
  );
  const [valoresEditados, setValoresEditados] = useState<Record<number, string>>(() =>
    inicial?.parcelas.length
      ? Object.fromEntries(linhasIniciais.map((l) => [l.id, l.valor]))
      : {}
  );
  const [itens, setItens] = useState<(ItemCompraLocal & { localId: number })[]>(() =>
    (inicial?.itens ?? []).map((item) => ({ ...item, localId: proximoItem++ }))
  );
  const [descontoTipo, setDescontoTipo] = useState<"" | "valor" | "percentual">(
    inicial?.descontoTipo ?? ""
  );
  const [descontoValor, setDescontoValor] = useState(inicial?.descontoValor ?? "");

  const subtotal = subtotalDosItens(itens);
  const total = aplicarDescontoDaNota(subtotal, descontoTipo || null, Number(descontoValor) || 0);

  // Derivado, não guardado: ver o comentário longo no formulário de ordem.
  const rateio = ratearEmParcelasIguais(
    rows.map((r) => r.id),
    total
  );
  const valores = Object.keys(valoresEditados).length ? valoresEditados : rateio;

  function editarParcela(id: number, valor: string) {
    setValoresEditados((anteriores) =>
      Object.keys(anteriores).length ? { ...anteriores, [id]: valor } : { ...rateio, [id]: valor }
    );
  }

  function adicionarParcela() {
    setRows((prev) => [...prev, { id: proximaLinha++, vencimento: "" }]);
    setValoresEditados({});
  }

  function removerParcela(id: number) {
    setRows((prev) => prev.filter((r) => r.id !== id));
    setValoresEditados({});
  }

  async function handleSubmit(formData: FormData) {
    setErroLocal(null);

    // Valida ANTES de subir anexo, e com mensagem na tela: botão desabilitado
    // em silêncio é indistinguível de sistema quebrado no celular.
    if (!itens.length) {
      setErroLocal("Adicione ao menos um item à proposta.");
      return;
    }

    if (anexos.length) {
      setEnviandoAnexo(true);
      const envio = await enviarAnexos("cotacoes", obraId, anexos);
      setEnviandoAnexo(false);
      if (envio.anexos === null) {
        setErroLocal(envio.error);
        return;
      }
      anexarAoForm(formData, envio.anexos);
    }

    formAction(formData);
  }

  return (
    <form action={handleSubmit}>
      <input type="hidden" name="itens" value={JSON.stringify(itens)} readOnly />
      <FieldGroup>
        <FieldSeparator>Fornecedor</FieldSeparator>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="fornecedor_id">Fornecedor</FieldLabel>
            <CampoFornecedor fornecedores={fornecedores} valorInicial={inicial?.fornecedorId} />
          </Field>

          <Field>
            <FieldLabel htmlFor="categoria_id">Categoria</FieldLabel>
            <CampoCategoria categorias={categorias} valorInicial={inicial?.categoriaId} />
            <FieldDescription>Se faltar alguma, digite o nome e crie na hora.</FieldDescription>
          </Field>

          <Field>
            <FieldLabel htmlFor="forma_pagamento">Forma de pagamento proposta</FieldLabel>
            <select
              id="forma_pagamento"
              name="forma_pagamento"
              defaultValue={inicial?.formaPagamento}
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
            <FieldLabel htmlFor="data_proposta">Data da proposta</FieldLabel>
            <Input
              id="data_proposta"
              name="data_proposta"
              type="date"
              defaultValue={inicial?.dataProposta ?? new Date().toISOString().slice(0, 10)}
              required
            />
          </Field>

          {/* Prazo de entrega costuma pesar tanto quanto preço na escolha, e é
              o segundo número que o cliente compara. */}
          <Field>
            <FieldLabel htmlFor="data_entrega_prevista">Entrega prevista (opcional)</FieldLabel>
            <Input
              id="data_entrega_prevista"
              name="data_entrega_prevista"
              type="date"
              defaultValue={inicial?.entregaPrevista}
            />
          </Field>

          {/*
            O anexo aparece TAMBÉM na edição, diferente da ordem de compra.
            
            Lá os arquivos se gerenciam na tela da ordem, então esconder aqui
            evita dois lugares editando a mesma lista. A proposta não tem essa
            tela: escondido na edição, a proposta criada sem anexo nunca
            poderia receber um — e o campo opcional que foi pedido viraria
            inalcançável depois do primeiro salvamento.
            
            Editando, o que vem aqui é ACRESCENTADO ao que já existe (a ação
            não apaga anexos ao salvar). O teto de três é do gatilho no banco.
          */}
          <Field>
            <FieldLabel htmlFor="anexo_proposta">Documento do fornecedor (opcional)</FieldLabel>
            <SeletorAnexos id="anexo_proposta" arquivos={anexos} aoMudar={setAnexos} />
            <FieldDescription>
              {editando
                ? `Some aos arquivos já anexados, até ${MAX_ANEXOS_COMPRA} no total.`
                : `Até ${MAX_ANEXOS_COMPRA} arquivos. O cliente baixa daqui na hora de escolher.`}
            </FieldDescription>
          </Field>

          <Field className="sm:col-span-2">
            <FieldLabel htmlFor="observacoes">Condições e observações (opcional)</FieldLabel>
            <Textarea
              id="observacoes"
              name="observacoes"
              rows={2}
              placeholder="Frete incluso, marca alternativa, validade da proposta…"
              defaultValue={inicial?.observacoes}
            />
          </Field>
        </div>

        <FieldSeparator>Itens cotados</FieldSeparator>

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
                    <TableCell>{moeda(item.preco_unitario)}</TableCell>
                    <TableCell className="text-xs">
                      {rotuloDesconto(item.desconto_tipo, item.desconto_valor) ?? "—"}
                    </TableCell>
                    <TableCell>{moeda(totalLiquidoDoItem(item))}</TableCell>
                    <TableCell className="text-right">
                      <span className="flex items-center justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Editar ${item.descricao}`}
                          onClick={() => setItemEditando(item.localId)}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Remover ${item.descricao}`}
                          onClick={() => {
                            if (itemEditando === item.localId) setItemEditando(null);
                            setItens((prev) => prev.filter((i) => i.localId !== item.localId));
                          }}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <ItemCompraPicker
          insumos={insumos}
          onAdd={(item) => setItens((prev) => [...prev, { ...item, localId: proximoItem++ }])}
          itemEmEdicao={itens.find((i) => i.localId === itemEditando) ?? null}
          onSalvarEdicao={(editado) => {
            setItens((prev) =>
              prev.map((i) => (i.localId === itemEditando ? { ...editado, localId: i.localId } : i))
            );
            setItemEditando(null);
          }}
          onCancelarEdicao={() => setItemEditando(null)}
        />

        <Field orientation="responsive">
          <div className="w-full">
            <FieldLabel htmlFor="desconto_tipo">Desconto na proposta (opcional)</FieldLabel>
            <select
              id="desconto_tipo"
              name="desconto_tipo"
              value={descontoTipo}
              onChange={(e) => setDescontoTipo(e.target.value as typeof descontoTipo)}
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
            >
              <option value="">Sem desconto</option>
              <option value="valor">Valor fixo (R$)</option>
              <option value="percentual">Percentual (%)</option>
            </select>
          </div>
          {descontoTipo && (
            <div className="w-full">
              <FieldLabel htmlFor="desconto_valor">
                {descontoTipo === "percentual" ? "Desconto (%)" : "Desconto (R$)"}
              </FieldLabel>
              <Input
                id="desconto_valor"
                name="desconto_valor"
                type="number"
                step="0.01"
                min="0"
                max={descontoTipo === "percentual" ? 100 : undefined}
                value={descontoValor}
                onChange={(e) => setDescontoValor(e.target.value)}
              />
            </div>
          )}
        </Field>

        <div className="flex flex-col gap-1 rounded-lg border bg-muted/30 p-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal dos itens</span>
            <span>{moeda(subtotal)}</span>
          </div>
          {descontoTipo && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Desconto</span>
              <span>-{moeda(subtotal - total)}</span>
            </div>
          )}
          <div className="flex justify-between font-medium">
            <span>Total da proposta</span>
            <span>{moeda(total)}</span>
          </div>
        </div>

        <FieldSeparator>Parcelas propostas</FieldSeparator>

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
                  value={valores[row.id] ?? ""}
                  onChange={(e) => editarParcela(row.id, e.target.value)}
                />
              </div>
              <div>
                <FieldLabel htmlFor={`parcela_vencimento_${i}`}>Vencimento</FieldLabel>
                <Input
                  id={`parcela_vencimento_${i}`}
                  name={`parcela_vencimento_${i}`}
                  type="date"
                  required
                  value={row.vencimento}
                  onChange={(e) =>
                    setRows((prev) =>
                      prev.map((r) => (r.id === row.id ? { ...r, vencimento: e.target.value } : r))
                    )
                  }
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

        {erroLocal && <FieldError>{erroLocal}</FieldError>}
        {state.error && <FieldError>{state.error}</FieldError>}

        <Button type="submit" disabled={pending || enviandoAnexo}>
          {pending || enviandoAnexo
            ? "Salvando..."
            : editando
              ? "Salvar alterações"
              : "Adicionar proposta"}
        </Button>
      </FieldGroup>
    </form>
  );
}
