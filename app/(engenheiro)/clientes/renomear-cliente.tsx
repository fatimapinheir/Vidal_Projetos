"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { renomearCliente } from "@/app/actions/obra-clientes";

/**
 * Corrige o nome de um cliente, na própria linha da lista.
 *
 * Em linha e não em diálogo: é um campo só, e abrir uma janela para trocar uma
 * palavra é cerimônia demais. O lápis fica escondido até o cursor passar, para
 * a lista continuar sendo uma lista.
 *
 * Existe porque cliente convidado só com o e-mail ficava com o e-mail no lugar
 * do nome — e até agora não havia como arrumar em tela nenhuma.
 */
export function RenomearCliente({ id, nome }: { id: string; nome: string }) {
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(nome);
  const [salvando, iniciar] = useTransition();
  const router = useRouter();

  function salvar() {
    const limpo = valor.trim();
    if (!limpo || limpo === nome) {
      setEditando(false);
      setValor(nome);
      return;
    }

    iniciar(async () => {
      const dados = new FormData();
      dados.set("cliente_id", id);
      dados.set("nome", limpo);
      const r = await renomearCliente({ error: null }, dados);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      setEditando(false);
      toast.success("Nome atualizado.");
      router.refresh();
    });
  }

  if (!editando) {
    return (
      <span className="group/nome flex items-center gap-1.5">
        <span className="font-medium">{nome}</span>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Corrigir o nome de ${nome}`}
          title="Corrigir nome"
          onClick={() => setEditando(true)}
          className="text-muted-foreground opacity-0 transition-opacity group-hover/nome:opacity-100 focus-visible:opacity-100"
        >
          <Pencil className="size-3.5" />
        </Button>
      </span>
    );
  }

  return (
    <span className="flex items-center gap-1">
      <Input
        value={valor}
        autoFocus
        disabled={salvando}
        aria-label="Nome do cliente"
        onChange={(e) => setValor(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") salvar();
          if (e.key === "Escape") {
            setValor(nome);
            setEditando(false);
          }
        }}
        className="h-8 w-56"
      />
      <Button type="button" variant="ghost" size="icon-sm" onClick={salvar} disabled={salvando} aria-label="Salvar">
        <Check className="size-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        disabled={salvando}
        aria-label="Cancelar"
        onClick={() => {
          setValor(nome);
          setEditando(false);
        }}
      >
        <X className="size-4" />
      </Button>
    </span>
  );
}
