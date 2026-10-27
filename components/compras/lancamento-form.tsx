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
import { CampoFornecedor } from "./campo-fornecedor";
import { CampoCategoria, type Categoria } from "./campo-categoria";
import { CamposNotaFiscal } from "./campos-nota-fiscal";
import { CamposEntrega } from "./campos-entrega";
import {
  ItemCompraPicker,
  type ItemCompraLocal,
  type InsumoOpcao,
} from "./item-compra-picker";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2 } from "lucide-react";
import { enviarArquivoParaStorage, removerArquivosDoStorage } from "@/lib/storage/upload-direto";
import { SeletorAnexos } from "./seletor-anexos";
import { MAX_ANEXOS_COMPRA } from "@/lib/compras/anexos";
import {
  criarLancamento,
  atualizarLancamento,
  type LancamentoState,
} from "@/app/actions/lancamentos";
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

/** O lançamento como ele está gravado, para o formulário abrir preenchido. */
export type LancamentoInicial = {
  id: string;
  fornecedorId: string;
  categoriaId: string;
  descricao: string;
  tipoItem: string;
  orcamentoEtapa: string;
  formaPagamento: string;
  dataPagamento: string;
  notaNumero: string;
  notaEmissao: string;
  entregaPrevista: string;
  entregaReal: string;
  itens: ItemCompraLocal[];
};

export function LancamentoForm({
  obraId,
  fornecedores,
  categorias,
  insumos,
  permiteCadastrarInsumo = true,
  voltarPara,
  etapasOrcamento = [],
  permiteCadastrarFornecedor = true,
  inicial,
}: {
  obraId: string;
  fornecedores: { id: string; nome: string }[];
  categorias: Categoria[];
  /** O catálogo de insumos ativos, para a busca do item. */
  insumos: InsumoOpcao[];
  /** Desligado no portal: cadastrar insumo é do engenheiro. */
  permiteCadastrarInsumo?: boolean;
  /**
   * Etapas do orçamento ativo. Vazio esconde o campo — é o caso do portal:
   * classificar gasto por etapa é trabalho de engenharia, e na tela de
   * detalhe o cliente também só vê a etapa, não escolhe.
   */
  etapasOrcamento?: string[];
  /** Para onde ir depois de salvar. */
  voltarPara: string;
  permiteCadastrarFornecedor?: boolean;
  /**
   * Presente = edição de um lançamento existente.
   *
   * O mesmo formulário serve aos dois casos de propósito: são os mesmos
   * campos, e duplicá-lo garantiria que um dia só um dos dois ganhasse um
   * campo novo. A diferença toda é a ação chamada e os arquivos — na edição
   * eles são geridos na tela de detalhe, onde dá para remover também.
   */
  inicial?: LancamentoInicial;
}) {
  const editando = !!inicial;
  const acao = inicial
    ? atualizarLancamento.bind(null, inicial.id)
    : criarLancamento.bind(null, obraId);
  const [estado, enviar, pendente] = useActionState(acao, estadoInicial);
  const router = useRouter();

  const [itens, setItens] = useState<(ItemCompraLocal & { localId: number })[]>(
    () => (inicial?.itens ?? []).map((item) => ({ ...item, localId: proximoItemId++ }))
  );
  const [comprovantes, setComprovantes] = useState<File[]>([]);
  const [dataPagamento, setDataPagamento] = useState(inicial?.dataPagamento ?? hojeNoFuso());
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

    /*
      Item é obrigatório, e a checagem vem antes de subir arquivo.
      
      Barrar aqui evita o caso em que o comprovante já foi para o Storage e a
      ação recusa o lançamento: o arquivo ficaria órfão no bucket e a pessoa
      veria o erro depois da espera do upload.
    */
    if (!itens.length) {
      setErroArquivo("Adicione ao menos um item ao lançamento.");
      return;
    }

    if (editando) {
      formData.set("itens", JSON.stringify(itens));
      enviar(formData);
      return;
    }

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
    enviar(formData);
  }

  useEffect(() => {
    if (!estado.sucesso) return;
    toast.success(editando ? "Lançamento atualizado." : "Lançamento registrado.");
    router.push(voltarPara);
  }, [estado.sucesso, editando, router, voltarPara]);

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
              valorInicial={inicial?.fornecedorId}
              permiteCadastrar={permiteCadastrarFornecedor}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="categoria_id">Categoria</FieldLabel>
            <CampoCategoria categorias={categorias} valorInicial={inicial?.categoriaId} />
            <FieldDescription>
              Se faltar alguma, digite o nome e crie na hora.
            </FieldDescription>
          </Field>

          <Field className="sm:col-span-2">
            <FieldLabel htmlFor="descricao">Descrição</FieldLabel>
            <Textarea
              id="descricao"
              name="descricao"
              rows={2}
              defaultValue={inicial?.descricao}
              required
            />
          </Field>

          {/* Mesmo campo da ordem de compra, pela mesma razão: tipo e
              categoria respondem coisas diferentes, e o tipo vai descer para
              o item. */}
          <Field>
            <FieldLabel htmlFor="tipo_item">Tipo</FieldLabel>
            <select
              id="tipo_item"
              name="tipo_item"
              defaultValue={inicial?.tipoItem ?? ""}
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
            >
              <option value="">Não classificar</option>
              <option value="material">Material</option>
              <option value="servico">Serviço</option>
              <option value="mao_de_obra">Mão de obra</option>
            </select>
            <FieldDescription>Separa os gastos no comparativo com o orçamento.</FieldDescription>
          </Field>

          {/* Só aparece com orçamento ativo: um select vazio seria um campo
              que não responde nada. */}
          {!!etapasOrcamento.length && (
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
                Vinculando, este gasto entra no comparativo orçado × gasto da etapa.
              </FieldDescription>
            </Field>
          )}

          <Field>
            <FieldLabel htmlFor="forma_pagamento">Forma de pagamento</FieldLabel>
            <select
              id="forma_pagamento"
              name="forma_pagamento"
              defaultValue={inicial?.formaPagamento}
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

          {/*
            "Valor pago" saiu daqui.
            
            Era um campo digitado ao lado dos itens, e isso criava duas verdades
            sobre o mesmo pagamento: o número escrito e a soma dos itens. Quem
            manda é a soma — é ela que o gatilho `trg_compra_itens_recalcula`
            grava em `compras.valor_total`. O total agora aparece no fim do
            formulário, depois dos itens, onde ele é consequência e não palpite.
          */}
          <Field>
            <FieldLabel htmlFor="data_pagamento">Data do pagamento</FieldLabel>
            <Input
              id="data_pagamento"
              name="data_pagamento"
              type="date"
              value={dataPagamento}
              onChange={(e) => setDataPagamento(e.target.value)}
              required
            />
          </Field>

          {/* Entrega: mesma pergunta da ordem de compra, mesma coluna no
              banco. Quem paga material no balcão e combina a entrega para
              quinta precisa dela; quem lança um IPTU, não. A data do
              pagamento entra como sugestão porque pagar e levar na hora é o
              caso mais comum de um lançamento. */}
          <CamposEntrega
            className="sm:col-span-2"
            dataInicial={dataPagamento}
            entregueInicial={inicial?.entregaReal}
            previstaInicial={inicial?.entregaPrevista}
          />

          <CamposNotaFiscal
            className="sm:col-span-2"
            numeroInicial={inicial?.notaNumero}
            emissaoInicial={inicial?.notaEmissao}
          />
        </div>

        {/*
          Itens são OBRIGATÓRIOS, como na ordem de compra.
          
          Eram opcionais, com o argumento de que IPTU e água não têm o que
          itemizar. Os dados mostraram o custo disso: 64 dos 70 lançamentos
          ficaram sem item nenhum, e o insumo foi escrito na descrição em prosa
          — "3 telhas de 4 metros a 30 o metro / 30 parafusos a 4 reais". Esse
          texto não soma, não filtra e não vira relatório.
          
          O que não é insumo de prateleira entra pelo catálogo como serviço ou
          mão de obra ("Alvará de construção" já foi digitado duas vezes), ou
          como item avulso quando for mesmo coisa de uma vez só.
        */}
        <FieldSeparator>Itens</FieldSeparator>

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
            insumos={insumos}
            podeCadastrar={permiteCadastrarInsumo}
            onAdd={(item) =>
              setItens((atuais) => [...atuais, { ...item, localId: proximoItemId++ }])
            }
          />

          {/* O total fecha a seção dos itens: é a soma do que está acima. */}
          <div className="flex items-baseline justify-between gap-3 rounded-lg border bg-muted/30 px-3 py-2">
            <span className="text-sm font-medium">Valor total da compra</span>
            <span className="text-base font-semibold tabular-nums">{moeda(totalItens)}</span>
          </div>
        </div>

        {/*
          Na edição os arquivos não aparecem aqui.
          
          Eles são geridos na tela de detalhe, onde dá para REMOVER também —
          e a remoção apaga o arquivo do Storage, operação que não cabe num
          formulário que pode ser abandonado sem salvar.
        */}
        {!editando && (
          <>
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
          </>
        )}

        {estado.error && <FieldError>{estado.error}</FieldError>}

        <Button
          type="submit"
          disabled={
            pendente ||
            enviandoArquivo ||
            (!editando && !comprovantes.length) ||
            // Sem item não há total, e sem total não há lançamento.
            !itens.length ||
            totalItens <= 0
          }
        >
          {pendente || enviandoArquivo
            ? "Salvando..."
            : editando
              ? "Salvar alterações"
              : "Registrar lançamento"}
        </Button>
      </FieldGroup>
    </form>
  );
}
