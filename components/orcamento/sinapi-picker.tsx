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
import { CampoMoeda, CampoUnidade } from "./campos-item";

type ResultadoSinapi = { id: string; codigo: string; descricao: string; unidade: string; preco_unitario: number };

const initialState: ItemOrcamentoState = { error: null };

/** Classificação do item. Serviço é o padrão: é o que vem da composição SINAPI. */
export const TIPOS_ITEM = [
  { valor: "servico", label: "Serviço" },
  { valor: "material", label: "Material" },
  { valor: "mao_de_obra", label: "Mão de obra" },
] as const;

function AdicionarItemForm({
  obraId,
  versaoId,
  inicial,
  etapa,
  onDone,
}: {
  obraId: string;
  versaoId: string;
  inicial: { codigo_sinapi?: string; descricao: string; unidade: string; preco_unitario: number };
  /** Quando o formulário abre dentro de uma etapa, ela já vem travada no campo. */
  etapa?: string;
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
        <Field orientation="responsive">
          <div className="w-full sm:max-w-48">
            <FieldLabel htmlFor="tipo_item">Categoria</FieldLabel>
            <select
              id="tipo_item"
              name="tipo_item"
              defaultValue="servico"
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
            >
              {TIPOS_ITEM.map((t) => (
                <option key={t.valor} value={t.valor}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div className="w-full">
            <FieldLabel htmlFor="descricao">Descrição</FieldLabel>
            <Input id="descricao" name="descricao" defaultValue={inicial.descricao} required />
          </div>
        </Field>

        {/*
          Unidade, quantidade, preço e etapa numa linha só: são quatro campos
          curtos, e empilhados faziam o formulário rolar para cadastrar um item
          de uma linha.
        */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-[7rem_7rem_11rem_1fr]">
          <div>
            <FieldLabel htmlFor="unidade">Unidade</FieldLabel>
            <CampoUnidade id="unidade" name="unidade" defaultValue={inicial.unidade} required />
          </div>
          <div>
            <FieldLabel htmlFor="quantidade">Quantidade</FieldLabel>
            <Input
              id="quantidade"
              name="quantidade"
              type="number"
              step="0.01"
              min="0"
              className="text-right tabular-nums"
              required
            />
          </div>
          <div>
            <FieldLabel htmlFor="preco_unitario">Preço unitário</FieldLabel>
            <CampoMoeda
              id="preco_unitario"
              name="preco_unitario"
              defaultValue={inicial.preco_unitario}
              required
            />
          </div>
          <div>
            <FieldLabel htmlFor="etapa">Etapa</FieldLabel>
            <Input
              id="etapa"
              name="etapa"
              defaultValue={etapa ?? ""}
              placeholder="Fundação, alvenaria..."
              readOnly={!!etapa}
              className={etapa ? "bg-muted" : undefined}
            />
          </div>
        </div>
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

export function SinapiPicker({
  obraId,
  versaoId,
  etapa,
  onDone,
}: {
  obraId: string;
  versaoId: string;
  /** Preenchida quando o picker abre dentro de uma etapa. */
  etapa?: string;
  onDone?: () => void;
}) {
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
    onDone?.();
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
        etapa={etapa}
        onDone={resetar}
      />
    );
  }

  if (avulso) {
    return (
      <AdicionarItemForm
        obraId={obraId}
        versaoId={versaoId}
        /*
          A descrição começa com o que já foi digitado na busca: quem procurou
          "Despachante prefeitura" e não achou na SINAPI estava escrevendo o
          nome do item, e mandá-lo digitar de novo no campo ao lado é perder o
          que ele acabou de fazer.
        */
        key={termo}
        inicial={{ descricao: termo.trim(), unidade: "", preco_unitario: 0 }}
        etapa={etapa}
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
          {termo.trim() ? "Cadastrar como item avulso" : "Item avulso"}
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
