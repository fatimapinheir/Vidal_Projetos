"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldError,
  FieldDescription,
  FieldSeparator,
} from "@/components/ui/field";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  atualizarFornecedor,
  adicionarContatoFornecedor,
  removerContatoFornecedor,
} from "@/app/actions/fornecedores";
import {
  FornecedorFormCampos,
  type FornecedorCampos,
} from "./fornecedor-form-campos";

export type ContatoFornecedor = {
  id: string;
  nome: string;
  telefone: string | null;
  principal: boolean;
};

/**
 * Edição do fornecedor.
 *
 * Dois formulários separados de propósito. Os dados do fornecedor são um
 * registro só e salvam de uma vez; os vendedores são registros independentes
 * que já existem no banco e entram e saem um a um. Num formulário único,
 * acrescentar um vendedor obrigaria a salvar o resto junto — e o engenheiro
 * que só queria trocar um telefone acabaria gravando alterações pela metade.
 */
export function EditarFornecedorDialog({
  fornecedorId,
  fornecedor,
  contatos,
}: {
  fornecedorId: string;
  fornecedor: Partial<FornecedorCampos>;
  contatos: ContatoFornecedor[];
}) {
  const [open, setOpen] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erroContato, setErroContato] = useState<string | null>(null);
  const [salvandoContato, setSalvandoContato] = useState(false);
  const router = useRouter();

  async function salvar(formData: FormData) {
    setEnviando(true);
    setErro(null);
    const r = await atualizarFornecedor(fornecedorId, { error: null }, formData);
    setEnviando(false);

    if (!r.success) {
      setErro(r.error ?? "Não foi possível salvar o fornecedor.");
      return;
    }
    setOpen(false);
    router.refresh();
  }

  async function adicionarVendedor(formData: FormData) {
    setSalvandoContato(true);
    setErroContato(null);
    const r = await adicionarContatoFornecedor(fornecedorId, { error: null }, formData);
    setSalvandoContato(false);

    if (!r.success) {
      setErroContato(r.error ?? "Não foi possível adicionar o vendedor.");
      return;
    }
    // O diálogo fica aberto: quem adiciona um vendedor costuma adicionar
    // outro em seguida. Só a lista precisa se atualizar.
    router.refresh();
  }

  async function removerVendedor(contatoId: string) {
    await removerContatoFornecedor(contatoId);
    router.refresh();
  }

  const ordenados = [...contatos].sort(
    (a, b) => Number(b.principal) - Number(a.principal) || a.nome.localeCompare(b.nome, "pt-BR")
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(proximo) => {
        setOpen(proximo);
        if (!proximo) {
          setErro(null);
          setErroContato(null);
        }
      }}
    >
      <DialogTrigger
        render={
          <Button variant="ghost" size="sm">
            <Pencil className="size-4" />
            Editar
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar fornecedor</DialogTitle>
        </DialogHeader>

        <form action={salvar}>
          <FieldGroup>
            <FornecedorFormCampos fornecedor={fornecedor} />
            {erro && <FieldError>{erro}</FieldError>}
            <Button type="submit" disabled={enviando}>
              {enviando ? "Salvando..." : "Salvar fornecedor"}
            </Button>
          </FieldGroup>
        </form>

        <FieldSeparator />

        <div className="flex flex-col gap-3">
          <div>
            <p className="text-sm font-medium">Vendedores</p>
            <p className="text-xs text-muted-foreground">
              Quem atende você nesse fornecedor. Entram e saem na hora, sem passar pelo botão de
              salvar acima.
            </p>
          </div>

          {ordenados.length > 0 && (
            <ul className="flex flex-col gap-1.5">
              {ordenados.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-sm"
                >
                  <span className="flex min-w-0 items-center gap-1.5">
                    {c.principal && (
                      <Star className="size-3.5 shrink-0 fill-atencao text-atencao" aria-label="Principal" />
                    )}
                    <span className="truncate">{c.nome}</span>
                    {c.telefone && (
                      <span className="truncate text-muted-foreground">· {c.telefone}</span>
                    )}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => removerVendedor(c.id)}
                    aria-label={`Remover ${c.nome}`}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}

          <form action={adicionarVendedor}>
            <FieldGroup>
              <Field orientation="responsive">
                <div className="w-full">
                  <FieldLabel htmlFor="contato-nome">Nome do vendedor</FieldLabel>
                  <Input id="contato-nome" name="nome" required />
                </div>
                <div className="w-full">
                  <FieldLabel htmlFor="contato-telefone">Telefone</FieldLabel>
                  <Input id="contato-telefone" name="telefone" />
                </div>
              </Field>
              <Field orientation="horizontal">
                <Checkbox id="contato-principal" name="principal" />
                <FieldLabel htmlFor="contato-principal" className="font-normal">
                  É o vendedor que me atende
                </FieldLabel>
              </Field>
              {erroContato && <FieldError>{erroContato}</FieldError>}
              <div>
                <Button type="submit" variant="outline" size="sm" disabled={salvandoContato}>
                  <Plus className="size-4" />
                  {salvandoContato ? "Adicionando..." : "Adicionar vendedor"}
                </Button>
              </div>
            </FieldGroup>
          </form>

          {!ordenados.length && (
            <FieldDescription>Nenhum vendedor cadastrado ainda.</FieldDescription>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
