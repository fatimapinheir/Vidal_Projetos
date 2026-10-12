"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ImagePlus, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { enviarArquivoParaStorage } from "@/lib/storage/upload-direto";
import { salvarImagemObra, removerImagemObra } from "@/app/actions/obras";
import {
  BUCKET_IMAGENS_OBRA,
  IMAGENS_OBRA,
  TAMANHO_MAX_IMAGEM,
  TIPOS_IMAGEM,
  fracaoVisivel,
  type CampoImagemObra,
} from "@/lib/obras/imagens";

/**
 * Carrega uma das imagens da obra.
 *
 * A pré-visualização usa a MESMA proporção e o mesmo `object-cover` da caixa
 * onde a foto vai aparecer no portal. É o ponto central do componente: quem
 * escolhe a foto precisa ver o recorte antes de salvar, senão descobre que
 * cortou a fachada ao meio só quando o cliente reclama.
 *
 * Nenhum tamanho de arquivo quebra a tela — a caixa é de proporção fixa e a
 * foto é recortada para caber. As medidas sugeridas evitam o outro problema:
 * foto pequena esticada, que fica borrada.
 */
export function ImagemObraUpload({
  obraId,
  campo,
  urlAtual,
}: {
  obraId: string;
  campo: CampoImagemObra;
  urlAtual: string | null;
}) {
  const espec = IMAGENS_OBRA[campo];
  const visivel = fracaoVisivel(espec);
  const corte = ((1 - visivel) / 2) * 100;
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const router = useRouter();

  async function aoEscolher(arquivo: File | null) {
    if (!arquivo) return;
    setErro(null);

    if (!TIPOS_IMAGEM.includes(arquivo.type)) {
      setErro("Use uma imagem JPG, PNG ou WEBP.");
      return;
    }
    if (arquivo.size > TAMANHO_MAX_IMAGEM) {
      setErro("A imagem passa de 2 MB. Reduza antes de enviar.");
      return;
    }

    setEnviando(true);
    // Prefixo com o id da obra: é o primeiro segmento do path que a policy do
    // Storage lê para saber de que obra o arquivo é.
    const envio = await enviarArquivoParaStorage(
      BUCKET_IMAGENS_OBRA,
      `${obraId}/${campo}`,
      arquivo
    );
    if (envio.path === null) {
      setEnviando(false);
      setErro(envio.error);
      return;
    }

    const r = await salvarImagemObra(obraId, campo, envio.path);
    setEnviando(false);
    if (r.error) {
      setErro(r.error);
      return;
    }
    toast.success(`${espec.rotulo} atualizada.`);
    router.refresh();
  }

  async function remover() {
    setEnviando(true);
    const r = await removerImagemObra(obraId, campo);
    setEnviando(false);
    if (r.error) {
      setErro(r.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2">
      <div>
        <p className="text-sm font-medium">{espec.rotulo}</p>
        <p className="text-xs text-muted-foreground">Aparece {espec.onde}.</p>
      </div>

      <div
        className="relative overflow-hidden rounded-xl border bg-muted"
        style={{ aspectRatio: `${espec.larguraIdeal} / ${espec.alturaIdeal}` }}
      >
        {urlAtual ? (
          <>
            <Image
              src={urlAtual}
              alt={`${espec.rotulo} da obra`}
              fill
              unoptimized
              sizes="(min-width: 768px) 24rem, 100vw"
              className="object-cover"
            />
            {/*
              A faixa clara é o que o cliente vai ver; o escurecido é o que o
              recorte come em cima e embaixo. Sem esta marcação o engenheiro
              aprova uma foto inteira e descobre o corte depois, pelo portal.
            */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 bg-foreground/55"
              style={{ height: `${corte}%` }}
            />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 bottom-0 bg-foreground/55"
              style={{ height: `${corte}%` }}
            />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 border-y border-dashed border-white/70"
              style={{ top: `${corte}%`, height: `${visivel * 100}%` }}
            />
            <span className="pointer-events-none absolute bottom-1.5 left-1.5 rounded bg-foreground/70 px-1.5 py-0.5 text-[10px] font-medium text-background">
              faixa visível no portal
            </span>
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-1 text-muted-foreground">
            <ImagePlus className="size-6" aria-hidden />
            <p className="text-xs">Sem imagem</p>
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Ideal:{" "}
        <strong className="font-medium text-foreground">
          {espec.larguraIdeal} × {espec.alturaIdeal} px
        </strong>{" "}
        · JPG, PNG ou WEBP · até 2 MB. {espec.enquadramento} Qualquer tamanho é aceito — a foto é
        recortada para caber, nunca deformada.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium shadow-xs transition-colors hover:bg-muted">
          <Upload className="size-4" />
          {enviando ? "Enviando..." : urlAtual ? "Trocar imagem" : "Carregar imagem"}
          <input
            type="file"
            accept={TIPOS_IMAGEM.join(",")}
            className="sr-only"
            disabled={enviando}
            onChange={(e) => aoEscolher(e.target.files?.[0] ?? null)}
          />
        </label>

        {urlAtual && (
          <Button type="button" variant="ghost" size="sm" onClick={remover} disabled={enviando}>
            <Trash2 className="size-4" />
            Remover
          </Button>
        )}
      </div>

      {erro && <FieldError>{erro}</FieldError>}
    </div>
  );
}
