"use client";

import { useState } from "react";
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
import { Plus, Trash2 } from "lucide-react";
import { createFornecedor } from "@/app/actions/fornecedores";
import { FornecedorFormCampos } from "@/components/fornecedores/fornecedor-form-campos";

let proximoId = 0;

export function NovoFornecedorDialog() {
  const [open, setOpen] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  // Um fornecedor costuma ter vários vendedores; o formulário começa com uma
  // linha e cresce conforme necessário.
  const [linhas, setLinhas] = useState<number[]>(() => [proximoId++]);

  /**
   * Chama a action direto em vez de `useActionState`: aquele padrão obriga a
   * fechar o diálogo num `useEffect` reagindo ao sucesso, que é setState em
   * efeito. Aqui o sucesso é conhecido no mesmo ponto em que se decide fechar.
   */
  async function enviar(formData: FormData) {
    setEnviando(true);
    setErro(null);
    const resultado = await createFornecedor({ error: null }, formData);
    setEnviando(false);

    if (!resultado.success) {
      setErro(resultado.error ?? "Não foi possível salvar o fornecedor.");
      return;
    }
    fechar(false);
  }

  function fechar(proximo: boolean) {
    if (!proximo) {
      // Remonta as linhas de vendedor para o próximo cadastro não herdar as
      // deste — os campos são `defaultValue`, então só trocar a chave limpa.
      setLinhas([proximoId++]);
      setErro(null);
    }
    setOpen(proximo);
  }

  return (
    <Dialog open={open} onOpenChange={fechar}>
      <DialogTrigger render={<Button>Novo fornecedor</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo fornecedor</DialogTitle>
        </DialogHeader>
        <form action={enviar}>
          <FieldGroup>
            <FornecedorFormCampos />

            <FieldSeparator />

            <Field>
              <FieldLabel>Vendedores</FieldLabel>
              <FieldDescription>
                Quem atende você nesse fornecedor. Marque o principal — é o contato que aparece
                primeiro na hora da compra.
              </FieldDescription>

              <div className="flex flex-col gap-3">
                {linhas.map((id, indice) => (
                  <div key={id} className="flex flex-col gap-2 rounded-lg border p-2.5">
                    <div className="flex items-start gap-2">
                      <div className="flex w-full flex-col gap-2 sm:flex-row">
                        <Input
                          name={`contato_nome_${id}`}
                          placeholder="Nome do vendedor"
                          aria-label={`Nome do vendedor ${indice + 1}`}
                        />
                        <Input
                          name={`contato_telefone_${id}`}
                          placeholder="Telefone"
                          aria-label={`Telefone do vendedor ${indice + 1}`}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setLinhas((l) => l.filter((x) => x !== id))}
                        disabled={linhas.length === 1}
                        aria-label={`Remover vendedor ${indice + 1}`}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Checkbox name={`contato_principal_${id}`} />
                      É o vendedor que me atende
                    </label>
                  </div>
                ))}
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setLinhas((l) => [...l, proximoId++])}
              >
                <Plus className="size-4" />
                Adicionar vendedor
              </Button>
            </Field>

            {erro && <FieldError>{erro}</FieldError>}
            <Button type="submit" disabled={enviando}>
              {enviando ? "Salvando..." : "Salvar fornecedor"}
            </Button>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
