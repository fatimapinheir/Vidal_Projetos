"use client";

import { useState, useTransition } from "react";
import { useFormularioDeDialogo } from "@/lib/hooks/usar-formulario-de-dialogo";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldGroup, FieldLabel, FieldError, FieldDescription } from "@/components/ui/field";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Trash2 } from "lucide-react";
import {
  vincularEquipeNaObra,
  desvincularEquipeDaObra,
  type EquipeFormState,
} from "@/app/actions/equipes";

const initialState: EquipeFormState = { error: null };

export type EquipeNaObra = {
  equipeId: string;
  nome: string;
  responsavel: string | null;
  membros: string[];
  tipoContrato: "diaria" | "empreitada";
  unidadeMedida: string | null;
  valorUnidade: number | null;
};

function formatCurrency(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/**
 * Equipes desta obra — a seleção mora aqui, na visão geral, porque é decisão
 * do dia a dia. A equipe em si vem do cadastro global; o que se define aqui é
 * como ela é paga **nesta** obra.
 */
export function EquipeDaObraCard({
  obraId,
  equipesNaObra,
  equipesDisponiveis,
}: {
  obraId: string;
  equipesNaObra: EquipeNaObra[];
  equipesDisponiveis: { id: string; nome: string }[];
}) {
  const [tipoContrato, setTipoContrato] = useState<"diaria" | "empreitada">("diaria");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const action = vincularEquipeNaObra.bind(null, obraId);
  const { aberto, mudarAberto, enviar, erro, enviando } = useFormularioDeDialogo({
    acao: action,
    estadoInicial: initialState,
    aoFechar: () => {
      setTipoContrato("diaria");
    },
  });

  function handleRemover(equipeId: string, nome: string) {
    if (!confirm(`Tirar a equipe "${nome}" desta obra? Os fechamentos já feitos continuam.`)) return;
    startTransition(() => {
      desvincularEquipeDaObra(obraId, equipeId).then(() => router.refresh());
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {equipesNaObra.map((eq) => (
        <div key={eq.equipeId} className="flex flex-wrap items-start justify-between gap-2 rounded-lg border p-3">
          <div className="min-w-0">
            <p className="text-sm font-medium">
              {eq.nome}
              <Badge variant="outline" className="ml-2">
                {eq.tipoContrato === "diaria"
                  ? "Diária"
                  : `Empreitada · ${eq.unidadeMedida} a ${formatCurrency(eq.valorUnidade ?? 0)}`}
              </Badge>
            </p>
            <p className="text-xs text-muted-foreground">
              Responsável: {eq.responsavel ?? "—"} · {eq.membros.join(", ") || "sem membros"}
            </p>
          </div>
          <Button
            onClick={() => handleRemover(eq.equipeId, eq.nome)}
            disabled={pending}
            variant="ghost"
            size="icon-sm"
            aria-label={`Tirar ${eq.nome} da obra`}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      ))}

      {!equipesNaObra.length && (
        <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
          Nenhuma equipe nesta obra ainda.
        </p>
      )}

      <Dialog open={aberto} onOpenChange={mudarAberto}>
        <DialogTrigger
          render={
            <Button variant="outline" size="sm" disabled={!equipesDisponiveis.length}>
              Colocar equipe nesta obra
            </Button>
          }
        />
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Colocar equipe nesta obra</DialogTitle>
          </DialogHeader>
          <form action={enviar}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="equipe_id">Equipe</FieldLabel>
                <select
                  id="equipe_id"
                  name="equipe_id"
                  required
                  className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                >
                  <option value="">Selecione...</option>
                  {equipesDisponiveis.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.nome}
                    </option>
                  ))}
                </select>
                <FieldDescription>
                  Vem do cadastro de Equipes. Se a que você precisa não estiver aí, cadastre em
                  Cadastros → Equipes.
                </FieldDescription>
              </Field>

              <Field>
                <FieldLabel htmlFor="tipo_contrato">Como essa equipe é paga nesta obra</FieldLabel>
                <select
                  id="tipo_contrato"
                  name="tipo_contrato"
                  value={tipoContrato}
                  onChange={(e) => setTipoContrato(e.target.value as "diaria" | "empreitada")}
                  className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                >
                  <option value="diaria">Diária</option>
                  <option value="empreitada">Empreitada (por entrega)</option>
                </select>
                <FieldDescription>
                  A mesma equipe pode ser diária numa obra e empreitada em outra.
                </FieldDescription>
              </Field>

              {tipoContrato === "empreitada" && (
                <Field orientation="responsive">
                  <div className="w-full">
                    <FieldLabel htmlFor="unidade_medida">Unidade</FieldLabel>
                    <Input id="unidade_medida" name="unidade_medida" placeholder="m²" />
                  </div>
                  <div className="w-full">
                    <FieldLabel htmlFor="valor_unidade">Valor por unidade (R$)</FieldLabel>
                    <Input id="valor_unidade" name="valor_unidade" inputMode="decimal" placeholder="45,00" />
                  </div>
                </Field>
              )}

              {erro && <FieldError>{erro}</FieldError>}
              <Button type="submit" disabled={enviando}>
                {enviando ? "Salvando..." : "Colocar na obra"}
              </Button>
            </FieldGroup>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
