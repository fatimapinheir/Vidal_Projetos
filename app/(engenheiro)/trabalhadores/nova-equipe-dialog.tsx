"use client";

import { useActionState, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldGroup, FieldLabel, FieldError, FieldDescription } from "@/components/ui/field";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { criarEquipe, type EquipeFormState } from "@/app/actions/equipes";

const initialState: EquipeFormState = { error: null };

/**
 * A equipe é cadastro global: só nome, responsável e membros. Tipo de contrato
 * e valor por unidade não entram aqui — eles se negociam por obra e são
 * definidos ao colocar a equipe numa obra, na visão geral dela.
 */
export function NovaEquipeDialog({
  trabalhadores,
}: {
  trabalhadores: { id: string; nome: string; funcao: string | null }[];
}) {
  const [open, setOpen] = useState(false);
  const [membros, setMembros] = useState<Set<string>>(new Set());
  const [state, formAction, pending] = useActionState(criarEquipe, initialState);

  useEffect(() => {
    if (state.success) setOpen(false);
  }, [state.success]);

  function handleOpenChange(proximo: boolean) {
    if (!proximo) setMembros(new Set());
    setOpen(proximo);
  }

  function alternarMembro(id: string, marcado: boolean) {
    setMembros((anterior) => {
      const proximo = new Set(anterior);
      if (marcado) proximo.add(id);
      else proximo.delete(id);
      return proximo;
    });
  }

  const selecionados = trabalhadores.filter((t) => membros.has(t.id));

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button>Nova equipe</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova equipe</DialogTitle>
        </DialogHeader>
        <form action={formAction}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="nome">Nome da equipe</FieldLabel>
              <Input id="nome" name="nome" required placeholder="Equipe de alvenaria" />
            </Field>

            <Field>
              <FieldLabel>Membros</FieldLabel>
              <FieldDescription>
                A equipe pode ser usada em qualquer obra. As condições de pagamento são definidas
                na obra, ao colocá-la lá.
              </FieldDescription>
              <div className="flex max-h-56 flex-col gap-2 overflow-y-auto rounded-lg border p-2">
                {trabalhadores.map((t) => (
                  <label key={t.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      name="membros"
                      value={t.id}
                      checked={membros.has(t.id)}
                      onCheckedChange={(marcado) => alternarMembro(t.id, marcado === true)}
                    />
                    {t.nome}
                    {t.funcao && <span className="text-muted-foreground">· {t.funcao}</span>}
                  </label>
                ))}
                {!trabalhadores.length && (
                  <p className="p-2 text-sm text-muted-foreground">
                    Nenhum colaborador cadastrado ainda.
                  </p>
                )}
              </div>
            </Field>

            <Field>
              <FieldLabel htmlFor="responsavel_id">Responsável</FieldLabel>
              <select
                id="responsavel_id"
                name="responsavel_id"
                required
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
              >
                <option value="">Selecione...</option>
                {selecionados.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nome}
                  </option>
                ))}
              </select>
              <FieldDescription>
                Só aparecem os membros marcados acima — é ele quem recebe o pagamento da equipe.
              </FieldDescription>
            </Field>

            {state.error && <FieldError>{state.error}</FieldError>}
            <Button type="submit" disabled={pending}>
              {pending ? "Criando..." : "Criar equipe"}
            </Button>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
