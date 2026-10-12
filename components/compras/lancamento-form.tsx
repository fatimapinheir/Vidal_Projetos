"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
import { CampoMoeda } from "@/components/orcamento/campos-item";
import { CampoFornecedor } from "./campo-fornecedor";
import { CampoCategoria, type Categoria } from "./campo-categoria";
import { CamposNotaFiscal } from "./campos-nota-fiscal";
import { ItemCompraPicker, type ItemCompraLocal } from "./item-compra-picker";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2 } from "lucide-react";
import { enviarArquivoParaStorage, removerArquivosDoStorage } from "@/lib/storage/upload-direto";
import { SeletorAnexos } from "./seletor-anexos";
import { MAX_ANEXOS_COMPRA } from "@/lib/compras/anexos";
import { criarLancamento, type LancamentoState } from "@/app/actions/lancamentos";
import { hojeNoFuso } from "@/lib/fuso";

const FORMAS = [
  { value: "pix", label: "Pix" },
  { value: "boleto", label: "Boleto" },
  { value: "transferencia", label: "Transferência" },
  { value: "cartao_credito", label: "Cartão de crédito" },
  { value: "cartao_debito", label: "Cartão de débito" },
  { value: "dinheiro", label: "Dinheiro" },
  { value: "cheque", label: "Cheque" },
  { value: "outro", label: "Outro" },
];

const estadoInicial: LancamentoState = { error: null };

/**
 * Registro de um pagamento que já aconteceu.
 *
 * Mesmas perguntas da ordem de compra, menos as que só fazem sentido antes da
 * compra: cotação, aprovação do cliente, entrega e parcelamento. O que entra
 * no lugar é o comprovante, obrigatório — é ele que separa "registrei um
 * gasto" de "este gasto existiu".
 */
let proximoItemId = 1;

/** Total líquido de um item, com o desconto individual já aplicado. */
function totalDoItem(item: ItemCompraLocal) {
  const bruto = item.quantidade * item.preco_unitario;
  if (item.desconto_tipo === "percentual") {
    return Math.max(bruto * (1 - (item.desconto_valor ?? 0) / 100), 0);
  }
  if (item.desconto_tipo === "valor") return Math.max(bruto - (item.desconto_valor ?? 0), 0);
  return bruto;
}

const moeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function LancamentoForm({
  obraId,
  fornecedores,
  categorias,
  voltarPara,
  permiteCadastrarFornecedor = true,
}: {
  obraId: string;
  fornecedores: { id: string; nome: string }[];
  categorias: Categoria[];
  /** Para onde ir depois de salvar. */
  voltarPara: string;
  permiteCadastrarFornecedor?: boolean;
}) {
  const acao = criarLancamento.bind(null, obraId);
  const [estado, enviar, pendente] = useActionState(acao, estadoInicial);
  const router = useRouter();

  const [valor, setValor] = useState(0);
  const [itens, setItens] = useState<(ItemCompraLocal & { localId: number })[]>([]);
  const [comprovantes, setComprovantes] = useState<File[]>([]);
  const [erroArquivo, setErroArquivo] = useState<string | null>(null);
  const totalItens = itens.reduce((soma, item) => soma + totalDoItem(item), 0);
  const [enviandoArquivo, setEnviandoArquivo] = useState(false);

  /**
   * Os comprovantes sobem direto ao Storage e o formulário leva só os
   * caminhos — binário em Server Action estoura o limite de payload em
   * produção.
   *
   * Em série, e não em paralelo: se o segundo arquivo falhar, o primeiro já
   * subiu, e o que subiu é removido antes de desistir. Sem isso, cada tentativa
   * frustrada deixaria arquivo órfão no bucket.
   */
  async function aoEnviar(formData: FormData) {
    setErroArquivo(null);

    if (!comprovantes.length) {
      setErroArquivo("Anexe o comprovante do pagamento.");
      return;
    }

    setEnviandoArquivo(true);
    const enviados: { path: string; nome: string }[] = [];
    for (const arquivo of comprovantes) {
      const envio = await enviarArquivoParaStorage("comprovantes-pagamento", obraId, arquivo);
      if (envio.path === null) {
        await removerArquivosDoStorage(
          "comprovantes-pagamento",
          enviados.map((e) => e.path)
        );
        setEnviandoArquivo(false);
        setErroArquivo(envio.error);
        return;
      }
      enviados.push({ path: envio.path, nome: arquivo.name });
    }
    setEnviandoArquivo(false);

    // O primeiro vira o comprovante da parcela; todos entram como anexo.
    formData.set("comprovante_path", enviados[0].path);
    for (const anexo of enviados) {
      formData.append("anexo_path", anexo.path);
      formData.append("anexo_nome", anexo.nome);
    }

    formData.set("itens", JSON.stringify(itens));
    // Com itens, o valor é a soma — o campo de moeda nem está montado.
    if (itens.length) formData.set("valor", String(totalItens));
    enviar(formData);
  }

  useEffect(() => {
    if (!estado.sucesso) return;
    toast.success("Lançamento registrado.");
    router.push(voltarPara);
  }, [estado.sucesso, router, voltarPara]);

  return (
    <form action={aoEnviar}>
      <FieldGroup>
        {/* Mesma organização da ordem de compra: seções por pergunta e duas
            colunas para os campos curtos. */}
        <FieldSeparator>Dados do pagamento</FieldSeparator>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="fornecedor_id">Fornecedor / favorecido</FieldLabel>
            <CampoFornecedor
              fornecedores={fornecedores}
              permiteCadastrar={permiteCadastrarFornecedor}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="categoria_id">Categoria</FieldLabel>
            <CampoCategoria categorias={categorias} />
            <FieldDescription>
              Se faltar alguma, digite o nome e crie na hora.
            </FieldDescription>
          </Field>

          <Field className="sm:col-span-2">
            <FieldLabel htmlFor="descricao">Descrição</FieldLabel>
            <Textarea id="descricao" name="descricao" rows={2} required />
          </Field>

          {/* Mesmo campo da ordem de compra, pela mesma razão: tipo e
              categoria respondem coisas diferentes, e o tipo vai descer para
              o item. */}
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

          <Field>
            <FieldLabel htmlFor="forma_pagamento">Forma de pagamento</FieldLabel>
            <select
              id="forma_pagamento"
              name="forma_pagamento"
              required
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
            >
              {FORMAS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </Field>

          <Field>
            <FieldLabel htmlFor="valor">Valor pago</FieldLabel>
            {/*
              Com itens, o valor é a soma deles e o campo vira leitura.
              
              Deixá-lo editável criaria duas verdades sobre o mesmo pagamento:
              a soma dos itens e o número digitado. Quem manda é a soma — é ela
              que o banco recalcula por gatilho.
            */}
            {itens.length ? (
              <div className="flex h-8 items-center rounded-lg border border-input bg-muted/40 px-2.5 text-sm font-medium tabular-nums">
                {moeda(totalItens)}
              </div>
            ) : (
              <CampoMoeda id="valor" name="valor" value={valor} onValueChange={setValor} />
            )}
          </Field>

          <Field>
            <FieldLabel htmlFor="data_pagamento">Data do pagamento</FieldLabel>
            <Input
              id="data_pagamento"
              name="data_pagamento"
              type="date"
              defaultValue={hojeNoFuso()}
              required
            />
          </Field>

          <CamposNotaFiscal className="sm:col-span-2" />
        </div>

        {/*
          Itens são OPCIONAIS no lançamento.
          
          A ordem de compra exige ao menos um — ela descreve uma compra. O
          lançamento descreve dinheiro que saiu, e metade dos casos (IPTU,
          água, uma taxa) não tem o que itemizar. Quando houver, o total passa
          a vir deles.
        */}
        <FieldSeparator>Itens (opcional)</FieldSeparator>

        <div className="flex flex-col gap-3">

          {!!itens.length && (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Un.</TableHead>
                    <TableHead>Qtd.</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itens.map((item) => (
                    <TableRow key={item.localId}>
                      <TableCell className="font-medium">{item.descricao}</TableCell>
                      <TableCell>{item.unidade}</TableCell>
                      <TableCell>{item.quantidade}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {moeda(totalDoItem(item))}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Remover ${item.descricao}`}
                          onClick={() =>
                            setItens((atuais) =>
                              atuais.filter((i) => i.localId !== item.localId)
                            )
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
            onAdd={(item) =>
              setItens((atuais) => [...atuais, { ...item, localId: proximoItemId++ }])
            }
          />
        </div>

        <FieldSeparator>Comprovante</FieldSeparator>

        <Field>
          <FieldLabel htmlFor="comprovante">Comprovante do pagamento</FieldLabel>
          <SeletorAnexos
            id="comprovante"
            arquivos={comprovantes}
            aoMudar={setComprovantes}
          />
          <FieldDescription>
            Obrigatório: o lançamento entra no sistema como pagamento já feito. Até{" "}
            {MAX_ANEXOS_COMPRA} arquivos — comprovante, nota, foto do recibo.
          </FieldDescription>
          {erroArquivo && <FieldError>{erroArquivo}</FieldError>}
        </Field>

        {estado.error && <FieldError>{estado.error}</FieldError>}

        <Button
          type="submit"
          disabled={
            pendente ||
            enviandoArquivo ||
            !comprovantes.length ||
            (itens.length ? totalItens : valor) <= 0
          }
        >
          {pendente || enviandoArquivo ? "Salvando..." : "Registrar lançamento"}
        </Button>
      </FieldGroup>
    </form>
  );
}
