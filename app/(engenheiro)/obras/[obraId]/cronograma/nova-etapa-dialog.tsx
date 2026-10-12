"use client";

import { useFormularioDeDialogo } from "@/lib/hooks/usar-formulario-de-dialogo";
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
import { criarEtapa, type CronogramaFormState } from "@/app/actions/cronograma";

const initialState: CronogramaFormState = { error: null };

export function NovaEtapaDialog({ obraId }: { obraId: string }) {
  const action = criarEtapa.bind(null, obraId);
  const { aberto, mudarAberto, enviar, erro, enviando } = useFormularioDeDialogo({
    acao: action,
    estadoInicial: initialState
  });

  return (
    <Dialog open={aberto} onOpenChange={mudarAberto}>
      <DialogTrigger render={<Button>Nova etapa</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova etapa</DialogTitle>
        </DialogHeader>
        <form action={enviar}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="nome">Nome da etapa</FieldLabel>
              <Input id="nome" name="nome" placeholder="Fundação" required />
            </Field>
            {erro && <FieldError>{erro}</FieldError>}
            <Button type="submit" disabled={enviando}>
              {enviando ? "Criando..." : "Criar etapa"}
            </Button>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
