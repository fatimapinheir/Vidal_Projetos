"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Lock, LockOpen, Trash2, Upload } from "lucide-react";
import {
  fecharDia,
  reabrirDia,
  confirmarRecebimento,
  registrarFotos,
  removerFoto,
} from "@/app/actions/diario";
import { enviarArquivoParaStorage, removerArquivosDoStorage } from "@/lib/storage/upload-direto";

export function FecharDiaButton({
  obraId,
  data,
  fechado,
}: {
  obraId: string;
  data: string;
  fechado: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick() {
    const mensagem = fechado
      ? "Reabrir esse dia? Ele sai da vista do cliente e volta a acompanhar as outras telas. Fica registrado que foi reaberto."
      : "Fechar esse dia? O efetivo, os equipamentos, as tarefas e as entregas ficam congelados como estão agora, e o cliente passa a ver essa folha.";
    if (!confirm(mensagem)) return;

    startTransition(() => {
      const acao = fechado ? reabrirDia(obraId, data) : fecharDia(obraId, data);
      acao.then((resultado) => {
        if (resultado?.error) alert(resultado.error);
        router.refresh();
      });
    });
  }

  return (
    <Button onClick={handleClick} disabled={pending} variant={fechado ? "outline" : "default"}>
      {fechado ? <LockOpen className="size-4" /> : <Lock className="size-4" />}
      {pending ? "Aguarde..." : fechado ? "Reabrir dia" : "Fechar o dia"}
    </Button>
  );
}

export function RecebimentoToggle({
  obraId,
  data,
  parcelaId,
  recebidoEm,
}: {
  obraId: string;
  data: string;
  parcelaId: string;
  recebidoEm: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const recebido = !!recebidoEm;

  function handleClick() {
    startTransition(() => {
      confirmarRecebimento(obraId, data, parcelaId, !recebido).then(() => router.refresh());
    });
  }

  return (
    <Button
      onClick={handleClick}
      disabled={pending}
      variant={recebido ? "secondary" : "outline"}
      size="sm"
    >
      {recebido ? "Recebido" : "Marcar recebido"}
    </Button>
  );
}

export function FotosUpload({ obraId, data }: { obraId: string; data: string }) {
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  /**
   * As fotos vão direto do navegador para o Storage, e só os caminhos passam
   * pela Server Action. Foto de celular tem 2–4 MB cada; algumas de uma vez
   * estouram com folga o limite de payload da função em produção (~4,5 MB
   * depois do base64), mesmo funcionando em desenvolvimento.
   */
  function handleSubmit(formData: FormData) {
    setErro(null);

    const arquivos = formData
      .getAll("fotos")
      .filter((f): f is File => f instanceof File && f.size > 0);
    if (!arquivos.length) return setErro("Selecione ao menos uma foto.");

    const legenda = (formData.get("legenda") as string) || null;

    startTransition(async () => {
      const paths: string[] = [];
      for (const arquivo of arquivos) {
        const envio = await enviarArquivoParaStorage("diario-obra", `${obraId}/${data}`, arquivo);
        if (envio.path === null) {
          // Falhou no meio do lote: desfaz as que já subiram, senão elas ficam
          // no bucket sem nenhuma linha apontando para elas.
          await removerArquivosDoStorage("diario-obra", paths);
          return setErro(envio.error);
        }
        paths.push(envio.path);
      }

      const resultado = await registrarFotos(obraId, data, paths, legenda);
      if (resultado.error) return setErro(resultado.error);
      router.refresh();
    });
  }

  return (
    <form action={handleSubmit}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="fotos">Adicionar fotos</FieldLabel>
          <Input id="fotos" name="fotos" type="file" accept="image/*" multiple required />
        </Field>
        <Field>
          <FieldLabel htmlFor="legenda">Legenda (opcional, vale para todas)</FieldLabel>
          <Input id="legenda" name="legenda" placeholder="Concretagem da laje do 2º pavimento" />
        </Field>
        {erro && <FieldError>{erro}</FieldError>}
        <Button type="submit" variant="outline" disabled={pending}>
          <Upload className="size-4" />
          {pending ? "Enviando..." : "Enviar fotos"}
        </Button>
      </FieldGroup>
    </form>
  );
}

export function RemoverFotoButton({
  obraId,
  data,
  fotoId,
}: {
  obraId: string;
  data: string;
  fotoId: string;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick() {
    if (!confirm("Remover essa foto?")) return;
    startTransition(() => {
      removerFoto(obraId, data, fotoId).then(() => router.refresh());
    });
  }

  return (
    <Button
      onClick={handleClick}
      disabled={pending}
      variant="ghost"
      size="icon-sm"
      className="absolute right-1 top-1 bg-background/80"
      aria-label="Remover foto"
    >
      <Trash2 className="size-4" />
    </Button>
  );
}

export function StatusDiarioBadge({
  fechadoEm,
  reabertoEm,
}: {
  fechadoEm: string | null;
  reabertoEm: string | null;
}) {
  if (fechadoEm) {
    return (
      <Badge variant="secondary">
        Fechado em {new Date(fechadoEm).toLocaleDateString("pt-BR")}
      </Badge>
    );
  }
  if (reabertoEm) {
    return (
      <Badge variant="outline">
        Reaberto em {new Date(reabertoEm).toLocaleDateString("pt-BR")}
      </Badge>
    );
  }
  return <Badge variant="outline">Aberto</Badge>;
}
