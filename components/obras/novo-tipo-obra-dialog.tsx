"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldGroup, FieldLabel, FieldError } from "@/components/ui/field";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { criarTipoObra } from "@/app/actions/obras";

export function NovoTipoObraDialog() {
  const [open, setOpen] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const router = useRouter();

  /**
   * Chama a action direto em vez de `useActionState`.
   *
   * O padrão com `useActionState` obriga a reagir ao sucesso num `useEffect`
   * para fechar o diálogo, o que é `setState` dentro de efeito — render em
   * cascata, e o lint reclama com razão. Aqui o sucesso é conhecido no mesmo
   * ponto em que se decide fechar.
   */
  async function enviar(formData: FormData) {
    setEnviando(true);
    setErro(null);
    const resultado = await criarTipoObra({ error: null }, formData);
    setEnviando(false);

    if (!resultado.success) {
      setErro(resultado.error ?? "Não foi possível criar o tipo.");
      return;
    }
    setOpen(false);
    // Recarrega os dados do servidor para o tipo novo aparecer no select sem
    // perder o que já foi digitado na obra — que é o motivo de criar o tipo
    // daqui em vez de numa tela separada.
    router.refresh();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(aberto) => {
        setOpen(aberto);
        if (!aberto) setErro(null);
      }}
    >
      <DialogTrigger
        render={
          <Button type="button" variant="outline" size="sm" className="gap-1.5">
            <Plus className="size-4" />
            Novo tipo
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo tipo de obra</DialogTitle>
        </DialogHeader>
        <form action={enviar}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="nome-tipo">Nome do tipo</FieldLabel>
              <Input id="nome-tipo" name="nome" placeholder="Galpão industrial" required />
            </Field>
            {erro && <FieldError>{erro}</FieldError>}
            <Button type="submit" disabled={enviando}>
              {enviando ? "Criando..." : "Criar tipo"}
            </Button>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
