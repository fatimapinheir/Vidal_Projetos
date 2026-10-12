"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldDescription, FieldError } from "@/components/ui/field";
import { enviarArquivoParaStorage } from "@/lib/storage/upload-direto";
import { removerAssinatura, salvarAssinatura } from "@/app/actions/perfil";

const TIPOS = ["image/png", "image/jpeg", "image/webp"];
const TAMANHO_MAX = 2 * 1024 * 1024;

/**
 * Carrega a imagem da assinatura.
 *
 * O arquivo vai direto do navegador para o Storage e só o caminho passa pela
 * action — binário em Server Action viaja em base64 e estoura o limite de
 * payload em produção.
 */
export function AssinaturaUpload({ urlAtual }: { urlAtual: string | null }) {
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const router = useRouter();

  async function aoEscolher(arquivo: File | null) {
    if (!arquivo) return;
    setErro(null);

    if (!TIPOS.includes(arquivo.type)) {
      setErro("Use uma imagem PNG, JPG ou WEBP.");
      return;
    }
    if (arquivo.size > TAMANHO_MAX) {
      setErro("A imagem passa de 2 MB. Reduza antes de enviar.");
      return;
    }

    setEnviando(true);
    const envio = await enviarArquivoParaStorage("assinaturas", "assinatura", arquivo);
    if (envio.path === null) {
      setEnviando(false);
      setErro(envio.error);
      return;
    }

    const r = await salvarAssinatura(envio.path);
    setEnviando(false);
    if (r.error) {
      setErro(r.error);
      return;
    }
    toast.success("Assinatura salva.");
    router.refresh();
  }

  async function remover() {
    setEnviando(true);
    await removerAssinatura();
    setEnviando(false);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      {urlAtual ? (
        <div className="flex flex-wrap items-center gap-4">
          {/* Fundo branco fixo: a assinatura é impressa sobre papel, e no tema
              escuro um traço preto sobre fundo escuro sumiria na pré-visualização. */}
          <div className="rounded-lg border bg-white p-3">
            <Image
              src={urlAtual}
              alt="Sua assinatura"
              width={220}
              height={80}
              unoptimized
              className="h-20 w-auto object-contain"
            />
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={remover} disabled={enviando}>
            <Trash2 className="size-4" />
            Remover
          </Button>
        </div>
      ) : (
        <FieldDescription>Nenhuma assinatura carregada ainda.</FieldDescription>
      )}

      <div>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium shadow-xs transition-colors hover:bg-muted">
          <Upload className="size-4" />
          {enviando ? "Enviando..." : urlAtual ? "Trocar imagem" : "Carregar assinatura"}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            disabled={enviando}
            onChange={(e) => aoEscolher(e.target.files?.[0] ?? null)}
          />
        </label>
      </div>

      {erro && <FieldError>{erro}</FieldError>}
    </div>
  );
}
