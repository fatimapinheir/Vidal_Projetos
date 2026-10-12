"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SinapiPicker } from "./sinapi-picker";
import { adicionarEtapaOrcamento, removerEtapaOrcamento } from "@/app/actions/orcamento";

/**
 * Botão de adicionar item dentro de uma etapa.
 *
 * O formulário abre colado na etapa e já com ela preenchida. Antes havia um
 * único campo de busca no topo e a etapa era digitada à mão em cada item — o
 * que, além de trabalhoso, produzia "Fundação" e "Fundacao" como etapas
 * diferentes.
 */
export function AdicionarItemNaEtapa({
  obraId,
  versaoId,
  etapa,
}: {
  obraId: string;
  versaoId: string;
  etapa: string;
}) {
  const [aberto, setAberto] = useState(false);

  if (!aberto) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setAberto(true)}>
        <Plus className="size-4" />
        Adicionar item
      </Button>
    );
  }

  return (
    <div className="w-full">
      <SinapiPicker
        obraId={obraId}
        versaoId={versaoId}
        etapa={etapa}
        onDone={() => setAberto(false)}
      />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="mt-2"
        onClick={() => setAberto(false)}
      >
        Fechar
      </Button>
    </div>
  );
}

/** Remove a etapa do roteiro. A action recusa se ainda houver item dentro. */
export function RemoverEtapaButton({
  obraId,
  versaoId,
  etapa,
}: {
  obraId: string;
  versaoId: string;
  etapa: string;
}) {
  const [pendente, setPendente] = useState(false);
  const router = useRouter();

  async function remover() {
    setPendente(true);
    const r = await removerEtapaOrcamento(obraId, versaoId, etapa);
    setPendente(false);
    if (r.error) {
      toast.error(r.error);
      return;
    }
    router.refresh();
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      onClick={remover}
      disabled={pendente}
      aria-label={`Remover etapa ${etapa}`}
    >
      <Trash2 className="size-4" />
    </Button>
  );
}

/** Cria uma etapa vazia, para quem monta o roteiro sem usar template. */
export function NovaEtapaButton({ obraId, versaoId }: { obraId: string; versaoId: string }) {
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [pendente, setPendente] = useState(false);
  const router = useRouter();

  async function criar() {
    setPendente(true);
    const r = await adicionarEtapaOrcamento(obraId, versaoId, nome);
    setPendente(false);
    if (r.error) {
      toast.error(r.error);
      return;
    }
    setNome("");
    setAberto(false);
    router.refresh();
  }

  if (!aberto) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setAberto(true)}>
        <Plus className="size-4" />
        Nova etapa
      </Button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        placeholder="Nome da etapa"
        className="max-w-56"
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            criar();
          }
        }}
      />
      <Button type="button" size="sm" onClick={criar} disabled={pendente || !nome.trim()}>
        {pendente ? "Criando..." : "Criar"}
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={() => setAberto(false)}>
        Cancelar
      </Button>
    </div>
  );
}
