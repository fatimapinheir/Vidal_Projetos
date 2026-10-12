"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldGroup, FieldLabel, FieldError } from "@/components/ui/field";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { atualizarItemOrcamento } from "@/app/actions/orcamento";
import { TIPOS_ITEM } from "./sinapi-picker";
import { CampoMoeda, CampoUnidade } from "./campos-item";

const classeSelect = "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm";

export type ItemEditavel = {
  id: string;
  codigo_sinapi: string | null;
  descricao: string;
  unidade: string;
  quantidade: number;
  preco_unitario: number;
  etapa: string | null;
  tipo_item: string | null;
};

/**
 * Edita um item do rascunho.
 *
 * Mudar a etapa aqui é o que permite mover um item de lugar sem apagar e
 * redigitar — com o template entregando 33 linhas, remanejar tinha de ser
 * barato.
 */
export function EditarItemDialog({
  obraId,
  item,
  etapas,
}: {
  obraId: string;
  item: ItemEditavel;
  etapas: string[];
}) {
  const [open, setOpen] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const router = useRouter();

  async function salvar(formData: FormData) {
    setSalvando(true);
    setErro(null);
    const r = await atualizarItemOrcamento(obraId, item.id, { error: null }, formData);
    setSalvando(false);
    if (!r.success) {
      setErro(r.error ?? "Não foi possível salvar.");
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setErro(null); }}>
      <DialogTrigger
        render={
          <Button type="button" variant="ghost" size="icon-sm" aria-label={`Editar ${item.descricao}`}>
            <Pencil className="size-4" />
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar item</DialogTitle>
        </DialogHeader>
        <form action={salvar}>
          <FieldGroup>
            <input type="hidden" name="codigo_sinapi" value={item.codigo_sinapi ?? ""} />

            <Field orientation="responsive">
              <div className="w-full">
                <FieldLabel htmlFor="tipo_item">Categoria</FieldLabel>
                <select
                  id="tipo_item"
                  name="tipo_item"
                  defaultValue={item.tipo_item ?? "servico"}
                  className={classeSelect}
                >
                  {TIPOS_ITEM.map((t) => (
                    <option key={t.valor} value={t.valor}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="w-full">
                <FieldLabel htmlFor="etapa">Etapa</FieldLabel>
                <select
                  id="etapa"
                  name="etapa"
                  defaultValue={item.etapa ?? ""}
                  className={classeSelect}
                >
                  <option value="">Sem etapa</option>
                  {/*
                    A etapa atual entra como opção mesmo que não esteja na
                    lista da versão.

                    Sem isto, lista incompleta fazia o select cair em "Sem
                    etapa" — e salvar apagava a etapa do item sem avisar. Foi
                    o que aconteceu quando o rascunho criado por "Editar
                    orçamento" nasceu sem copiar as etapas: todo item abria
                    aparentando não ter etapa nenhuma.
                  */}
                  {!!item.etapa && !etapas.includes(item.etapa) && (
                    <option value={item.etapa}>{item.etapa} (fora da lista)</option>
                  )}
                  {etapas.map((e) => (
                    <option key={e} value={e}>
                      {e}
                    </option>
                  ))}
                </select>
              </div>
            </Field>

            <Field>
              <FieldLabel htmlFor="descricao">Descrição</FieldLabel>
              <Input id="descricao" name="descricao" defaultValue={item.descricao} required />
            </Field>

            {/* Os três curtos na mesma linha, como no cadastro. */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-[1fr_1fr_11rem]">
              <div>
                <FieldLabel htmlFor="unidade">Unidade</FieldLabel>
                <CampoUnidade id="unidade" name="unidade" defaultValue={item.unidade} required />
              </div>
              <div>
                <FieldLabel htmlFor="quantidade">Quantidade</FieldLabel>
                <Input
                  id="quantidade"
                  name="quantidade"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={item.quantidade}
                  className="text-right tabular-nums"
                  required
                />
              </div>
              <div>
                <FieldLabel htmlFor="preco_unitario">Preço unitário</FieldLabel>
                <CampoMoeda
                  id="preco_unitario"
                  name="preco_unitario"
                  defaultValue={item.preco_unitario}
                  required
                />
              </div>
            </div>

            {erro && <FieldError>{erro}</FieldError>}
            <div>
              <Button type="submit" disabled={salvando}>
                {salvando ? "Salvando..." : "Salvar item"}
              </Button>
            </div>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
