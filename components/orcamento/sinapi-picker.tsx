"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldGroup, FieldLabel, FieldError } from "@/components/ui/field";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { buscarSinapi } from "@/app/actions/sinapi";
import { adicionarItemOrcamento, type ItemOrcamentoState } from "@/app/actions/orcamento";

type ResultadoSinapi = { id: string; codigo: string; descricao: string; unidade: string; preco_unitario: number };

const initialState: ItemOrcamentoState = { error: null };

function AdicionarItemForm({
  obraId,
  versaoId,
  inicial,
  onDone,
}: {
  obraId: string;
  versaoId: string;
  inicial: { codigo_sinapi?: string; descricao: string; unidade: string; preco_unitario: number };
  onDone: () => void;
}) {
  const action = adicionarItemOrcamento.bind(null, obraId, versaoId);
  const [state, formAction, pending] = useActionState(action, initialState);

  useEffect(() => {
    if (state.success) onDone();
  }, [state.success, onDone]);

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-3">
      <input type="hidden" name="codigo_sinapi" value={inicial.codigo_sinapi ?? ""} />
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="descricao">Descrição</FieldLabel>
          <Input id="descricao" name="descricao" defaultValue={inicial.descricao} required />
        </Field>
        <Field orientation="responsive">
          <div className="w-full">
            <FieldLabel htmlFor="unidade">Unidade</FieldLabel>
            <Input id="unidade" name="unidade" defaultValue={inicial.unidade} required />
          </div>
          <div className="w-full">
            <FieldLabel htmlFor="quantidade">Quantidade</FieldLabel>
            <Input id="quantidade" name="quantidade" type="number" step="0.01" min="0" required />
          </div>
        </Field>
        <Field orientation="responsive">
          <div className="w-full">
            <FieldLabel htmlFor="preco_unitario">Preço unitário (R$)</FieldLabel>
            <Input
              id="preco_unitario"
              name="preco_unitario"
              type="number"
              step="0.01"
              min="0"
              defaultValue={inicial.preco_unitario}
              required
            />
          </div>
          <div className="w-full">
            <FieldLabel htmlFor="etapa">Etapa (opcional)</FieldLabel>
            <Input id="etapa" name="etapa" placeholder="Fundação, alvenaria..." />
          </div>
        </Field>
        {state.error && <FieldError>{state.error}</FieldError>}
        <div className="flex gap-2">
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Adicionando..." : "Adicionar ao orçamento"}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={onDone}>
            Cancelar
          </Button>
        </div>
      </FieldGroup>
    </form>
  );
}

export function SinapiPicker({ obraId, versaoId }: { obraId: string; versaoId: string }) {
  const [termo, setTermo] = useState("");
  const [resultados, setResultados] = useState<ResultadoSinapi[]>([]);
  const [selecionado, setSelecionado] = useState<ResultadoSinapi | null>(null);
  const [avulso, setAvulso] = useState(false);
  const [, startTransition] = useTransition();

  function handleChange(value: string) {
    setTermo(value);
    setSelecionado(null);
    if (value.trim().length < 2) {
      setResultados([]);
      return;
    }
    startTransition(async () => {
      setResultados(await buscarSinapi(value));
    });
  }

  function resetar() {
    setSelecionado(null);
    setAvulso(false);
    setTermo("");
    setResultados([]);
  }

  if (selecionado) {
    return (
      <AdicionarItemForm
        obraId={obraId}
        versaoId={versaoId}
        inicial={{
          codigo_sinapi: selecionado.codigo,
          descricao: selecionado.descricao,
          unidade: selecionado.unidade,
          preco_unitario: selecionado.preco_unitario,
        }}
        onDone={resetar}
      />
    );
  }

  if (avulso) {
    return (
      <AdicionarItemForm
        obraId={obraId}
        versaoId={versaoId}
        inicial={{ descricao: "", unidade: "", preco_unitario: 0 }}
        onDone={resetar}
      />
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Input
          placeholder="Buscar item na SINAPI por código ou descrição..."
          value={termo}
          onChange={(e) => handleChange(e.target.value)}
        />
        <Button type="button" variant="outline" onClick={() => setAvulso(true)}>
          Item avulso
        </Button>
      </div>
      {termo.trim().length >= 2 && (
        <div className="overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Un.</TableHead>
                <TableHead>Preço unit.</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {resultados.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="text-xs">{item.codigo}</TableCell>
                  <TableCell className="max-w-64 truncate">{item.descricao}</TableCell>
                  <TableCell>{item.unidade}</TableCell>
                  <TableCell>
                    {item.preco_unitario.toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    })}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" onClick={() => setSelecionado(item)}>
                      Selecionar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {!resultados.length && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Nenhum item encontrado na tabela SINAPI ativa.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
