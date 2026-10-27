"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
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
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CampoUnidade } from "@/components/orcamento/campos-item";
import { criarInsumo, atualizarInsumo } from "@/app/actions/insumos";
import type { TipoItemOrcamento } from "@/lib/types/database.types";

const CLASSE_SELECT = "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm";

export const ROTULO_CATEGORIA: Record<TipoItemOrcamento, string> = {
  material: "Material",
  servico: "Serviço",
  mao_de_obra: "Mão de obra",
};

export type InsumoEditavel = {
  id: string;
  descricao: string;
  categoria_custo: TipoItemOrcamento;
  unidade: string;
};

/**
 * Cadastra ou edita um insumo. Três campos, e nenhum deles é preço.
 *
 * O cadastro responde "o que é este insumo"; quanto custa é do dia da compra.
 * Era isso que o formulário de compra misturava: pedia descrição, unidade,
 * quantidade e preço de uma vez, e por isso tudo tinha de ser redigitado em
 * cada compra do mesmo barrote.
 */
export function InsumoDialog({ insumo }: { insumo?: InsumoEditavel }) {
  const editando = !!insumo;
  const [open, setOpen] = useState(false);
  const [descricao, setDescricao] = useState(insumo?.descricao ?? "");
  const [categoria, setCategoria] = useState<string>(insumo?.categoria_custo ?? "");
  const [unidade, setUnidade] = useState(insumo?.unidade ?? "");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const router = useRouter();

  function salvar(formData: FormData) {
    setErro(null);
    // Conferido aqui para a mensagem aparecer junto do campo que falta: num
    // diálogo em portal a validação nativa nem sempre consegue focar o campo.
    if (!descricao.trim()) return setErro("Informe a descrição do insumo.");
    if (!categoria) return setErro("Escolha a categoria de custo.");
    if (!unidade) return setErro("Escolha a unidade.");

    iniciar(async () => {
      const r = insumo
        ? await atualizarInsumo(insumo.id, { error: null }, formData)
        : await criarInsumo({ error: null }, formData);

      if (r.error) return setErro(r.error);
      setOpen(false);
      if (!editando) {
        setDescricao("");
        setCategoria("");
        setUnidade("");
      }
      router.refresh();
    });
  }

  function handleOpenChange(proximo: boolean) {
    setOpen(proximo);
    // Reidrata ao abrir: o componente não remonta entre uma abertura e outra.
    if (proximo) {
      setDescricao(insumo?.descricao ?? "");
      setCategoria(insumo?.categoria_custo ?? "");
      setUnidade(insumo?.unidade ?? "");
      setErro(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          editando ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Editar ${insumo!.descricao}`}
            >
              <Pencil className="size-4" />
            </Button>
          ) : (
            <Button size="sm">
              <Plus className="size-4" />
              Novo insumo
            </Button>
          )
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editando ? insumo!.descricao : "Novo insumo"}</DialogTitle>
        </DialogHeader>
        <form action={salvar}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="descricao">Descrição</FieldLabel>
              <Input
                id="descricao"
                name="descricao"
                value={descricao}
                onChange={(e) => {
                  setDescricao(e.target.value);
                  setErro(null);
                }}
                placeholder="Barrote de Pinus 5x5"
                required
              />
              <FieldDescription>
                O nome como você procura por ele na compra. Específico ajuda: &ldquo;Cimento
                Apodi&rdquo; acha mais rápido que &ldquo;cimento&rdquo;.
              </FieldDescription>
            </Field>

            <Field orientation="responsive">
              <div className="w-full">
                <FieldLabel htmlFor="categoria_custo">Categoria de custo</FieldLabel>
                <select
                  id="categoria_custo"
                  name="categoria_custo"
                  value={categoria}
                  onChange={(e) => {
                    setCategoria(e.target.value);
                    setErro(null);
                  }}
                  className={CLASSE_SELECT}
                  required
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
                <FieldLabel htmlFor="unidade">Unidade</FieldLabel>
                {/* A mesma lista fechada do orçamento e da compra. Campo livre
                    aqui faria o catálogo nascer com "un", "UN" e "und". */}
                <CampoUnidade
                  id="unidade"
                  name="unidade"
                  value={unidade}
                  onValueChange={(v) => {
                    setUnidade(v);
                    setErro(null);
                  }}
                />
              </div>
            </Field>

            <FieldDescription>
              <strong>Sem preço.</strong> O preço é do dia da compra e do fornecedor daquele dia —
              você informa na ordem de compra, junto da quantidade.
            </FieldDescription>

            {erro && <FieldError>{erro}</FieldError>}
            <Button type="submit" disabled={pendente}>
              {pendente ? "Salvando..." : editando ? "Salvar" : "Cadastrar insumo"}
            </Button>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
