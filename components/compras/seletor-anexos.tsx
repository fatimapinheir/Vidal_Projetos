"use client";

import { useRef, useState } from "react";
import { Paperclip, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { MAX_ANEXOS_COMPRA } from "@/lib/compras/anexos";

/** Tamanho em KB/MB, para quem anexa foto de celular saber o que escolheu. */
function tamanho(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(Math.round(bytes / 1024), 1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Escolha de até três arquivos, controlada pelo formulário que a usa.
 *
 * Controlada e não autônoma porque o envio ao Storage acontece no submit do
 * formulário (ver lib/storage/upload-direto): quem tem os `File` na mão
 * precisa ser quem envia.
 *
 * O `<input type="file">` fica escondido dentro de um <label> estilizado — o
 * controle nativo se perde no meio do formulário e ninguém o lê como ação. E o
 * value do input é limpo a cada escolha, senão escolher o MESMO arquivo depois
 * de removê-lo não dispara `change` e o campo fica mudo.
 */
export function SeletorAnexos({
  id,
  arquivos,
  aoMudar,
  max = MAX_ANEXOS_COMPRA,
  rotuloVazio = "Nenhum arquivo escolhido",
}: {
  id: string;
  arquivos: File[];
  aoMudar: (arquivos: File[]) => void;
  max?: number;
  rotuloVazio?: string;
}) {
  const [aviso, setAviso] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const cheio = arquivos.length >= max;

  function aoEscolher(escolhidos: FileList | null) {
    setAviso(null);
    if (!escolhidos?.length) return;

    const livres = max - arquivos.length;
    const novos = [...escolhidos].slice(0, livres);
    if (escolhidos.length > livres) {
      setAviso(`Máximo de ${max} arquivos — os excedentes não foram incluídos.`);
    }

    aoMudar([...arquivos, ...novos]);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <label
          className={
            cheio
              ? "pointer-events-none inline-flex items-center gap-2 rounded-lg border border-border bg-muted px-3 py-1.5 text-sm font-medium text-muted-foreground"
              : "inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium shadow-xs transition-colors hover:bg-muted"
          }
        >
          <Paperclip className="size-4" aria-hidden />
          {arquivos.length ? "Adicionar outro" : "Escolher arquivo"}
          <input
            ref={inputRef}
            id={id}
            type="file"
            multiple
            className="sr-only"
            disabled={cheio}
            onChange={(e) => aoEscolher(e.target.files)}
          />
        </label>
        <span className="text-xs text-muted-foreground">
          {arquivos.length ? `${arquivos.length} de ${max}` : rotuloVazio}
        </span>
      </div>

      {!!arquivos.length && (
        <ul className="flex flex-col gap-1">
          {arquivos.map((arquivo, i) => (
            <li
              key={`${arquivo.name}-${arquivo.lastModified}-${i}`}
              className="flex items-center gap-2 rounded-lg border bg-card px-2.5 py-1.5 text-sm"
            >
              <Paperclip className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
              <span className="min-w-0 flex-1 truncate">{arquivo.name}</span>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                {tamanho(arquivo.size)}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Remover ${arquivo.name}`}
                onClick={() => {
                  setAviso(null);
                  aoMudar(arquivos.filter((_, indice) => indice !== i));
                }}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {aviso && <FieldError>{aviso}</FieldError>}
    </div>
  );
}
