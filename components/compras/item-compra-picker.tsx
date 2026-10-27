"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldDescription,
  FieldError,
} from "@/components/ui/field";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ComboBusca } from "@/components/ui/combo-busca";
import { CampoMoeda, CampoUnidade } from "@/components/orcamento/campos-item";
import { rotuloUnidade } from "@/lib/orcamento/unidades";
import { criarInsumo } from "@/app/actions/insumos";
import type { TipoItemOrcamento } from "@/lib/types/database.types";

const CLASSE_SELECT = "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm";

export const ROTULO_CATEGORIA: Record<TipoItemOrcamento, string> = {
  material: "Material",
  servico: "Serviço",
  mao_de_obra: "Mão de obra",
};

export type InsumoOpcao = {
  id: string;
  descricao: string;
  categoria_custo: TipoItemOrcamento;
  unidade: string;
};

export type ItemCompraLocal = {
  insumo_id?: string;
  /**
   * Vínculo com o item do orçamento. Nenhuma tela o define hoje — o seletor
   * passou a buscar no catálogo de insumos —, mas item já gravado com o
   * vínculo não pode perdê-lo ao salvar uma edição.
   */
  orcamento_item_id?: string;
  descricao: string;
  unidade: string;
  categoria_custo?: TipoItemOrcamento;
  quantidade: number;
  preco_unitario: number;
  desconto_tipo?: "valor" | "percentual";
  desconto_valor?: number;
};

/**
 * Quantidade e valor — e mais nada, quando o insumo vem do catálogo.
 *
 * Era um formulário que pedia descrição, unidade, quantidade e preço em toda
 * compra. Comprar barrote hoje e barrote amanhã eram dois cadastros do zero, e
 * os dados mostram o resultado: dos 33 itens lançados, nenhum veio do seletor
 * de item planejado — todos foram redigitados à mão — e 64 dos 70 lançamentos
 * não têm item nenhum, com o insumo escrito na descrição em prosa
 * ("3 telhas de 4 metros a 30 o metro / 30 parafusos a 4 reais").
 *
 * Agora o que é o insumo (descrição, categoria de custo, unidade) vem do
 * cadastro; o que muda a cada compra (quantidade e valor) é o que se digita.
 */
function FormularioItem({
  insumo,
  descricaoInicial,
  categoriaInicial,
  onAdd,
  onCancel,
}: {
  /** Vindo do catálogo: descrição, unidade e categoria já estão resolvidas. */
  insumo?: InsumoOpcao;
  /** Item avulso: a descrição é digitada e não vira cadastro. */
  descricaoInicial?: string;
  categoriaInicial?: TipoItemOrcamento | "";
  onAdd: (item: ItemCompraLocal) => void;
  onCancel: () => void;
}) {
  const [descricao, setDescricao] = useState(insumo?.descricao ?? descricaoInicial ?? "");
  const [unidade, setUnidade] = useState(insumo?.unidade ?? "");
  const [categoria, setCategoria] = useState<string>(
    insumo?.categoria_custo ?? categoriaInicial ?? ""
  );
  const [quantidade, setQuantidade] = useState("");
  const [precoUnitario, setPrecoUnitario] = useState(0);
  const [descontoTipo, setDescontoTipo] = useState<"" | "valor" | "percentual">("");
  const [descontoValor, setDescontoValor] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  const doCatalogo = !!insumo;

  function enviar() {
    const q = Number(quantidade);
    if (!descricao.trim()) return setErro("Informe a descrição.");
    if (!unidade.trim()) return setErro("Informe a unidade.");
    if (!q || q <= 0) return setErro("Informe uma quantidade válida.");
    if (precoUnitario < 0 || Number.isNaN(precoUnitario)) {
      return setErro("Informe um valor unitário válido.");
    }

    onAdd({
      insumo_id: insumo?.id,
      descricao: descricao.trim(),
      unidade: unidade.trim(),
      categoria_custo: (categoria || undefined) as TipoItemOrcamento | undefined,
      quantidade: q,
      preco_unitario: precoUnitario,
      desconto_tipo: descontoTipo || undefined,
      desconto_valor: descontoTipo ? Number(descontoValor) || 0 : undefined,
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-3">
      <FieldGroup>
        {doCatalogo ? (
          /*
            Do catálogo, a identidade do insumo é LEITURA.
            
            Deixá-la editável aqui recriaria o problema: a correção valeria só
            para esta compra, e amanhã o mesmo barrote voltaria com a grafia
            antiga. Quem corrige o cadastro é a tela de insumos.
          */
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="text-sm font-medium">{insumo!.descricao}</span>
            <span className="text-xs text-muted-foreground">
              {rotuloUnidade(insumo!.unidade)} · {ROTULO_CATEGORIA[insumo!.categoria_custo]}
            </span>
          </div>
        ) : (
          <>
            <Field>
              <FieldLabel htmlFor="item_descricao">Descrição</FieldLabel>
              <Input
                id="item_descricao"
                value={descricao}
                onChange={(e) => {
                  setDescricao(e.target.value);
                  setErro(null);
                }}
              />
              <FieldDescription>
                Item avulso: fica só nesta compra e não entra no catálogo de insumos.
              </FieldDescription>
            </Field>
            <Field orientation="responsive">
              <div className="w-full">
                <FieldLabel htmlFor="item_unidade">Unidade</FieldLabel>
                <CampoUnidade id="item_unidade" value={unidade} onValueChange={setUnidade} />
              </div>
              <div className="w-full">
                <FieldLabel htmlFor="item_categoria">Categoria de custo</FieldLabel>
                <select
                  id="item_categoria"
                  value={categoria}
                  onChange={(e) => setCategoria(e.target.value)}
                  className={CLASSE_SELECT}
                >
                  <option value="">Não classificar</option>
                  <option value="material">Material</option>
                  <option value="servico">Serviço</option>
                  <option value="mao_de_obra">Mão de obra</option>
                </select>
              </div>
            </Field>
          </>
        )}

        {/* Quantidade e valor juntos, em destaque: com o insumo cadastrado, são
            os dois únicos campos que mudam de uma compra para a outra. */}
        <Field orientation="responsive">
          <div className="w-full">
            <FieldLabel htmlFor="item_quantidade">Quantidade</FieldLabel>
            <Input
              id="item_quantidade"
              type="number"
              step="0.01"
              min="0"
              autoFocus={doCatalogo}
              value={quantidade}
              onChange={(e) => {
                setQuantidade(e.target.value);
                setErro(null);
              }}
            />
          </div>
          <div className="w-full">
            <FieldLabel htmlFor="item_preco">Valor unitário</FieldLabel>
            {/* Máscara de centavos, como no orçamento: digita-se 1250 e sai
                12,50, sem ponto nem vírgula para acertar. */}
            <CampoMoeda id="item_preco" value={precoUnitario} onValueChange={setPrecoUnitario} />
          </div>
        </Field>

        <Field orientation="responsive">
          <div className="w-full">
            <FieldLabel htmlFor="item_desconto_tipo">Desconto no item</FieldLabel>
            <select
              id="item_desconto_tipo"
              value={descontoTipo}
              onChange={(e) => setDescontoTipo(e.target.value as typeof descontoTipo)}
              className={CLASSE_SELECT}
            >
              <option value="">Sem desconto</option>
              <option value="valor">Valor fixo (R$)</option>
              <option value="percentual">Percentual (%)</option>
            </select>
          </div>
          {descontoTipo && (
            <div className="w-full">
              <FieldLabel htmlFor="item_desconto_valor">
                {descontoTipo === "percentual" ? "Desconto (%)" : "Desconto (R$)"}
              </FieldLabel>
              <Input
                id="item_desconto_valor"
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

        {erro && <FieldError>{erro}</FieldError>}
        <div className="flex gap-2">
          <Button type="button" size="sm" onClick={enviar}>
            Adicionar item
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
        </div>
      </FieldGroup>
    </div>
  );
}

/**
 * Escolhe o insumo e lança quantidade e valor.
 *
 * A lista inteira de insumos ativos vem do servidor e filtra no navegador. Não
 * é busca por requisição de propósito: o catálogo de uma construtora tem
 * centenas de linhas, não milhares, e filtrar local responde na tecla — era a
 * demora da busca que fazia todo mundo ignorar o seletor antigo e redigitar
 * tudo em "Item avulso".
 */
export function ItemCompraPicker({
  insumos,
  podeCadastrar = false,
  onAdd,
}: {
  insumos: InsumoOpcao[];
  /**
   * Cadastrar insumo é do engenheiro. No portal do cliente fica desligado: um
   * catálogo aberto voltaria a juntar "barrote", "Barrote" e "barote", que é o
   * problema de origem. Ele continua podendo lançar pelo item avulso.
   */
  podeCadastrar?: boolean;
  onAdd: (item: ItemCompraLocal) => void;
}) {
  const [lista, setLista] = useState(insumos);
  const [escolhido, setEscolhido] = useState("");
  const [avulso, setAvulso] = useState(false);

  // Cadastro na hora: o momento em que falta o insumo é o momento em que se
  // está lançando a compra.
  const [cadastrando, setCadastrando] = useState(false);
  const [novaDescricao, setNovaDescricao] = useState("");
  const [novaCategoria, setNovaCategoria] = useState("");
  const [novaUnidade, setNovaUnidade] = useState("");
  const [erroCadastro, setErroCadastro] = useState<string | null>(null);
  const [salvando, iniciarCadastro] = useTransition();

  const insumo = lista.find((i) => i.id === escolhido);

  function resetar() {
    setEscolhido("");
    setAvulso(false);
  }

  function adicionar(item: ItemCompraLocal) {
    onAdd(item);
    resetar();
  }

  /*
   * Cadastro por transição, não por `useActionState`.
   *
   * Com `useActionState` a resposta chega num estado, e reagir a ela exigiria
   * um efeito com `setState` dentro — renderização em cascata. Aqui a resposta
   * é o retorno da chamada, e dá para inserir na lista, selecionar e fechar em
   * sequência. É o mesmo caminho do campo de categoria.
   */
  function cadastrar() {
    setErroCadastro(null);
    if (!novaDescricao.trim()) return setErroCadastro("Informe a descrição do insumo.");
    if (!novaCategoria) return setErroCadastro("Escolha a categoria de custo.");
    if (!novaUnidade) return setErroCadastro("Escolha a unidade.");

    const formData = new FormData();
    formData.set("descricao", novaDescricao.trim());
    formData.set("categoria_custo", novaCategoria);
    formData.set("unidade", novaUnidade);

    iniciarCadastro(async () => {
      const r = await criarInsumo({ error: null }, formData);
      if (r.error || !r.criadoId) {
        setErroCadastro(r.error ?? "Não foi possível cadastrar o insumo.");
        return;
      }
      const novo: InsumoOpcao = {
        id: r.criadoId,
        descricao: novaDescricao.trim(),
        categoria_custo: novaCategoria as TipoItemOrcamento,
        unidade: novaUnidade,
      };
      setLista((atuais) =>
        [...atuais, novo].sort((a, b) => a.descricao.localeCompare(b.descricao, "pt-BR"))
      );
      setEscolhido(novo.id);
      setCadastrando(false);
      setNovaDescricao("");
      setNovaCategoria("");
      setNovaUnidade("");
      toast.success("Insumo cadastrado. Já está no catálogo para as próximas compras.");
    });
  }

  if (insumo) {
    return <FormularioItem insumo={insumo} onAdd={adicionar} onCancel={resetar} />;
  }

  if (avulso) {
    return <FormularioItem onAdd={adicionar} onCancel={resetar} />;
  }

  return (
    <>
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="min-w-0 flex-1">
          <ComboBusca
            name="insumo_escolhido"
            opcoes={lista.map((i) => ({
              valor: i.id,
              rotulo: i.descricao,
              detalhe: `${rotuloUnidade(i.unidade)} · ${ROTULO_CATEGORIA[i.categoria_custo]}`,
            }))}
            valor={escolhido}
            aoMudar={setEscolhido}
            placeholder="Buscar insumo..."
            rotuloCadastrar={podeCadastrar ? "Cadastrar insumo" : undefined}
            aoCadastrar={
              podeCadastrar
                ? (texto) => {
                    setNovaDescricao(texto);
                    setCadastrando(true);
                  }
                : undefined
            }
          />
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => setAvulso(true)}>
          Item avulso
        </Button>
      </div>

      {!lista.length && (
        <FieldDescription>
          {podeCadastrar
            ? "O catálogo está vazio. Digite o nome do insumo acima e cadastre — da próxima vez ele já aparece na busca."
            : "Nenhum insumo no catálogo ainda. Use “Item avulso” para descrever o que foi comprado."}
        </FieldDescription>
      )}

      <Dialog open={cadastrando} onOpenChange={setCadastrando}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo insumo</DialogTitle>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="novo_insumo_descricao">Descrição</FieldLabel>
              <Input
                id="novo_insumo_descricao"
                value={novaDescricao}
                onChange={(e) => {
                  setNovaDescricao(e.target.value);
                  setErroCadastro(null);
                }}
                placeholder="Barrote de Pinus 5x5"
              />
            </Field>
            <Field orientation="responsive">
              <div className="w-full">
                <FieldLabel htmlFor="novo_insumo_categoria">Categoria de custo</FieldLabel>
                <select
                  id="novo_insumo_categoria"
                  value={novaCategoria}
                  onChange={(e) => {
                    setNovaCategoria(e.target.value);
                    setErroCadastro(null);
                  }}
                  className={CLASSE_SELECT}
                >
                  <option value="" disabled>
                    Escolha...
                  </option>
                  <option value="material">Material</option>
                  <option value="servico">Serviço</option>
                  <option value="mao_de_obra">Mão de obra</option>
                </select>
              </div>
              <div className="w-full">
                <FieldLabel htmlFor="novo_insumo_unidade">Unidade</FieldLabel>
                <CampoUnidade
                  id="novo_insumo_unidade"
                  value={novaUnidade}
                  onValueChange={(v) => {
                    setNovaUnidade(v);
                    setErroCadastro(null);
                  }}
                />
              </div>
            </Field>
            <FieldDescription>
              <strong>Sem preço.</strong> Ele é do dia da compra — você informa a seguir, junto da
              quantidade.
            </FieldDescription>
            {erroCadastro && <FieldError>{erroCadastro}</FieldError>}
            <div className="flex gap-2">
              <Button type="button" onClick={cadastrar} disabled={salvando}>
                <Plus className="size-4" />
                {salvando ? "Cadastrando..." : "Cadastrar insumo"}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setCadastrando(false)}>
                Cancelar
              </Button>
            </div>
          </FieldGroup>
        </DialogContent>
      </Dialog>
    </>
  );
}
