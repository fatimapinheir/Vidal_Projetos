"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldDescription, FieldError } from "@/components/ui/field";
import { enviarArquivoParaStorage } from "@/lib/storage/upload-direto";
import { removerLogoEmpresa, salvarLogoEmpresa } from "@/app/actions/perfil";

const TIPOS = ["image/png", "image/svg+xml", "image/webp"];
const TAMANHO_MAX = 2 * 1024 * 1024;

/**
 * A logo da construtora, que aparece no topo do menu — para você e para os
 * seus clientes no portal.
 *
 * JPG fica de fora da lista de tipos de propósito: o formato não guarda
 * transparência, e uma logo com fundo branco chapado vira um retângulo claro
 * sobre o navy do menu. PNG, SVG e WEBP guardam.
 */
export function LogoUpload({ urlAtual }: { urlAtual: string | null }) {
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const router = useRouter();

  async function aoEscolher(arquivo: File | null) {
    if (!arquivo) return;
    setErro(null);

    if (!TIPOS.includes(arquivo.type)) {
      setErro("Use PNG, SVG ou WEBP — formatos que guardam fundo transparente.");
      return;
    }
    if (arquivo.size > TAMANHO_MAX) {
      setErro("A imagem passa de 2 MB. Reduza antes de enviar.");
      return;
    }

    setEnviando(true);
    const envio = await enviarArquivoParaStorage("logos", "empresa", arquivo);
    if (envio.path === null) {
      setEnviando(false);
      setErro(envio.error);
      return;
    }

    const r = await salvarLogoEmpresa(envio.path);
    setEnviando(false);
    if (r.error) return setErro(r.error);

    toast.success("Logo salva.");
    router.refresh();
  }

  async function remover() {
    if (!confirm("Remover a logo? O menu volta a mostrar a marca do sistema.")) return;
    setEnviando(true);
    await removerLogoEmpresa();
    setEnviando(false);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      {urlAtual ? (
        /*
          Prévia sobre o NAVY do menu, não sobre a cor da página.
          
          É o único lugar onde dá para perceber, antes de salvar, que uma logo
          escura some no lugar onde ela vai aparecer. Mostrá-la sobre fundo
          claro aqui seria mostrar um resultado que não existe.
        */
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex h-24 w-48 items-center justify-center rounded-xl bg-sidebar p-3">
            <Image
              src={urlAtual}
              alt="Logo da empresa"
              width={400}
              height={400}
              unoptimized
              className="max-h-full w-auto object-contain"
            />
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={remover} disabled={enviando}>
            <Trash2 className="size-4" />
            Remover
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Nenhuma logo enviada — o menu mostra a marca do sistema.
        </p>
      )}

      <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium shadow-xs transition-colors hover:bg-muted">
        <Upload className="size-4" aria-hidden />
        {enviando ? "Enviando..." : urlAtual ? "Trocar logo" : "Enviar logo"}
        <input
          type="file"
          accept={TIPOS.join(",")}
          className="sr-only"
          disabled={enviando}
          onChange={(e) => {
            void aoEscolher(e.target.files?.[0] ?? null);
            e.target.value = "";
          }}
        />
      </label>

      <FieldDescription>
        Aparece no topo do menu, para você e para os seus clientes no portal. O fundo ali é escuro,
        então envie uma versão <strong>clara e com fundo transparente</strong> — uma logo preta
        desaparece. Formato livre; a altura é ajustada sozinha.
      </FieldDescription>

      {erro && <FieldError>{erro}</FieldError>}
    </div>
  );
}
