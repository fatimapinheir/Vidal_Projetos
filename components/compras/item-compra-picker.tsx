"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { buscarItensPlanejamento } from "@/app/actions/compras";
import { CampoMoeda, CampoUnidade } from "@/components/orcamento/campos-item";

export type ItemCompraLocal = {
  orcamento_item_id?: string;
  descricao: string;
  unidade: string;
  quantidade: number;
  preco_unitario: number;
  desconto_tipo?: "valor" | "percentual";
  desconto_valor?: number;
};

type ResultadoPlanejamento = {
  id: string;
  codigo_sinapi: string | null;
  descricao: string;
  unidade: string;
  preco_unitario: number;
};

function FormularioItem({
  inicial,
  onAdd,
  onCancel,
}: {
  inicial: { orcamento_item_id?: string; descricao: string; unidade: string; preco_unitario: number };
  onAdd: (item: ItemCompraLocal) => void;
  onCancel: () => void;
}) {
  const [descricao, setDescricao] = useState(inicial.descricao);
  const [unidade, setUnidade] = useState(inicial.unidade);
  const [quantidade, setQuantidade] = useState("");
  const [precoUnitario, setPrecoUnitario] = useState(inicial.preco_unitario || 0);
  const [descontoTipo, setDescontoTipo] = useState<"" | "valor" | "percentual">("");
  const [descontoValor, setDescontoValor] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit() {
    const q = Number(quantidade);
    const p = precoUnitario;
    if (!descricao.trim()) return setError("Informe a descrição.");
    if (!unidade.trim()) return setError("Informe a unidade.");
    if (!q || q <= 0) return setError("Informe uma quantidade válida.");
    if (p < 0 || Number.isNaN(p)) return setError("Informe um preço unitário válido.");

    onAdd({
      orcamento_item_id: inicial.orcamento_item_id,
      descricao: descricao.trim(),
      unidade: unidade.trim(),
      quantidade: q,
      preco_unitario: p,
      desconto_tipo: descontoTipo || undefined,
      desconto_valor: descontoTipo ? Number(descontoValor) || 0 : undefined,
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-3">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="item_descricao">Descrição</FieldLabel>
          <Input id="item_descricao" value={descricao} onChange={(e) => setDescricao(e.target.value)} />
        </Field>
        <Field orientation="responsive">
          <div className="w-full">
            <FieldLabel htmlFor="item_unidade">Unidade</FieldLabel>
            {/* A mesma lista fechada do orçamento. O campo era livre aqui, e
                "un"/"UN"/"und" voltavam a aparecer justamente na compra, que é
                onde o item vira gasto. */}
            <CampoUnidade id="item_unidade" value={unidade} onValueChange={setUnidade} />
          </div>
          <div className="w-full">
            <FieldLabel htmlFor="item_quantidade">Quantidade</FieldLabel>
            <Input
              id="item_quantidade"
              type="number"
              step="0.01"
              min="0"
              value={quantidade}
              onChange={(e) => setQuantidade(e.target.value)}
            />
          </div>
        </Field>
        <Field orientation="responsive">
          <div className="w-full">
            <FieldLabel htmlFor="item_preco">Preço unitário pago</FieldLabel>
            {/* Mesma máscara de centavos do orçamento: digita-se 1250 e sai
                12,50, sem ponto nem vírgula para acertar. */}
            <CampoMoeda id="item_preco" value={precoUnitario} onValueChange={setPrecoUnitario} />
          </div>
          <div className="w-full">
            <FieldLabel htmlFor="item_desconto_tipo">Desconto no item</FieldLabel>
            <select
              id="item_desconto_tipo"
              value={descontoTipo}
              onChange={(e) => setDescontoTipo(e.target.value as typeof descontoTipo)}
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
            >
              <option value="">Sem desconto</option>
              <option value="valor">Valor fixo (R$)</option>
              <option value="percentual">Percentual (%)</option>
            </select>
          </div>
        </Field>
        {descontoTipo && (
          <Field>
            <FieldLabel htmlFor="item_desconto_valor">
              {descontoTipo === "percentual" ? "Desconto (%)" : "Desconto (R$)"}
            </FieldLabel>
            <Input
              id="item_desconto_valor"
              type="number"
              step="0.01"
              min="0"
              max={descontoTipo === "percentual" ? 100 : undefined}
              value={descontoValor}
              onChange={(e) => setDescontoValor(e.target.value)}
            />
          </Field>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex gap-2">
          <Button type="button" size="sm" onClick={handleSubmit}>
            Adicionar item
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
        </div>
      </FieldGroup>
    </div>
  );
}

export function ItemCompraPicker({
  obraId,
  onAdd,
}: {
  obraId: string;
  onAdd: (item: ItemCompraLocal) => void;
}) {
  const [termo, setTermo] = useState("");
  const [resultados, setResultados] = useState<ResultadoPlanejamento[]>([]);
  const [selecionado, setSelecionado] = useState<ResultadoPlanejamento | null>(null);
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
      setResultados(await buscarItensPlanejamento(obraId, value));
    });
  }

  function resetar() {
    setSelecionado(null);
    setAvulso(false);
    setTermo("");
    setResultados([]);
  }

  function handleAdd(item: ItemCompraLocal) {
    onAdd(item);
    resetar();
  }

  if (selecionado) {
    return (
      <FormularioItem
        inicial={{
          orcamento_item_id: selecionado.id,
          descricao: selecionado.descricao,
          unidade: selecionado.unidade,
          preco_unitario: selecionado.preco_unitario,
        }}
        onAdd={handleAdd}
        onCancel={resetar}
      />
    );
  }

  if (avulso) {
    return (
      <FormularioItem
        inicial={{ descricao: "", unidade: "", preco_unitario: 0 }}
        onAdd={handleAdd}
        onCancel={resetar}
      />
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Input
          placeholder="Buscar item planejado nessa obra..."
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
                <TableHead>Preço planejado</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {resultados.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="text-xs">{item.codigo_sinapi ?? "—"}</TableCell>
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
                    Nenhum item planejado encontrado com esse termo. Use &ldquo;Item
                    avulso&rdquo; se não estiver no planejamento dessa obra.
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
