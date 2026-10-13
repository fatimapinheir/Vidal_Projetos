"use client";

import { useOptimistic, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Lock, LockOpen, Trash2, Upload, UserCheck } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import {
  fecharDia,
  reabrirDia,
  confirmarRecebimento,
  confirmarPresencaNoDiario,
  confirmarEquipeInteira,
  limparPresencaNoDiario,
  registrarFotos,
  salvarLegendaFoto,
  removerFoto,
  salvarExtraDoDia,
  type CampoExtraDiario,
} from "@/app/actions/diario";
import type { PresencaStatus } from "@/lib/types/database.types";
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
    /*
     * O aviso de "gente sem presença confirmada" saiu junto com a lista
     * nominal: o efetivo da folha agora é a contagem por função, digitada, e
     * não há o que ficar de fora por falta de confirmação.
     */
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
  compraId,
  recebidoEm,
}: {
  obraId: string;
  data: string;
  compraId: string;
  recebidoEm: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const recebido = !!recebidoEm;

  function handleClick() {
    startTransition(() => {
      confirmarRecebimento(obraId, data, compraId, !recebido).then(() => router.refresh());
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

const OPCOES_PRESENCA: { valor: "" | PresencaStatus; rotulo: string }[] = [
  { valor: "", rotulo: "Sem confirmar" },
  { valor: "presente", rotulo: "Presente" },
  { valor: "meia_diaria", rotulo: "Meia diária" },
  { valor: "falta", rotulo: "Falta" },
];

/**
 * ESTACIONADO. Não está em uso desde que o efetivo do diário virou contagem
 * por função; fica aqui para quando o fechamento de folha for revisto, que é
 * onde a presença individual precisa aparecer. Quem lança presença hoje usa a
 * tela de Presenças.
 *
 * Confirma a presença de uma pessoa sem sair da folha do dia.
 *
 * Grava na tabela `presencas`, a mesma da tela de presenças — a folha é só um
 * segundo lugar de onde lançar, não um registro paralelo. "Sem confirmar"
 * apaga o lançamento, que é como se corrige um clique errado.
 *
 * `useOptimistic` em vez de estado local porque o valor verdadeiro é o do
 * servidor: o select responde na hora e, quando o refresh chega, volta a seguir
 * o servidor sozinho — inclusive quando quem mudou a presença foi o atalho de
 * confirmar a equipe inteira.
 */
export function PresencaSelect({
  obraId,
  data,
  trabalhadorId,
  status,
}: {
  obraId: string;
  data: string;
  trabalhadorId: string;
  status: PresencaStatus | null;
}) {
  const [pending, startTransition] = useTransition();
  const [valor, setValor] = useOptimistic<"" | PresencaStatus>(status ?? "");
  const router = useRouter();

  function handleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const escolhido = event.target.value as "" | PresencaStatus;

    startTransition(async () => {
      setValor(escolhido);
      const resultado = escolhido
        ? await confirmarPresencaNoDiario(obraId, data, trabalhadorId, escolhido)
        : await limparPresencaNoDiario(obraId, data, trabalhadorId);
      if (resultado.error) alert(resultado.error);
      router.refresh();
    });
  }

  return (
    <select
      value={valor}
      onChange={handleChange}
      disabled={pending}
      aria-label="Presença"
      className={
        valor
          ? "h-8 rounded-lg border border-input bg-transparent px-2 text-xs disabled:opacity-60"
          : "h-8 rounded-lg border border-dashed border-primary/50 bg-transparent px-2 text-xs text-muted-foreground disabled:opacity-60"
      }
    >
      {OPCOES_PRESENCA.map((opcao) => (
        <option key={opcao.valor} value={opcao.valor}>
          {opcao.rotulo}
        </option>
      ))}
    </select>
  );
}

/**
 * ESTACIONADO junto com `PresencaSelect` — ver a nota acima.
 *
 * Atalho do dia normal: equipe inteira em obra, sem confirmar um por um.
 */
export function ConfirmarEquipeButton({
  obraId,
  data,
  semConfirmar,
}: {
  obraId: string;
  data: string;
  semConfirmar: number;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick() {
    startTransition(async () => {
      const resultado = await confirmarEquipeInteira(obraId, data);
      if (resultado.error) alert(resultado.error);
      router.refresh();
    });
  }

  return (
    <Button onClick={handleClick} disabled={pending} variant="outline" size="sm">
      <UserCheck className="size-4" />
      {pending ? "Confirmando..." : `Marcar ${semConfirmar} como presente`}
    </Button>
  );
}

/** Quantos uploads simultâneos. Três mantém a barra andando sem saturar o 4G da obra. */
const ENVIOS_EM_PARALELO = 3;

export function FotosUpload({ obraId, data }: { obraId: string; data: string }) {
  const [erro, setErro] = useState<string | null>(null);
  const [selecionadas, setSelecionadas] = useState(0);
  const [enviadas, setEnviadas] = useState(0);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  /**
   * As fotos vão direto do navegador para o Storage, e só os caminhos passam
   * pela Server Action. Foto de celular tem 2–4 MB cada; algumas de uma vez
   * estouram com folga o limite de payload da função em produção (~4,5 MB
   * depois do base64), mesmo funcionando em desenvolvimento.
   *
   * O lote sobe em paralelo, poucas por vez: em série, vinte fotos de obra
   * viram minutos de espera. Nenhuma pede legenda — registrar o dia tem de ser
   * mais rápido que descrever cada imagem, e a legenda pode vir depois, foto
   * por foto, ali embaixo.
   */
  function handleSubmit(formData: FormData) {
    setErro(null);
    setEnviadas(0);

    const arquivos = formData
      .getAll("fotos")
      .filter((f): f is File => f instanceof File && f.size > 0);
    if (!arquivos.length) return setErro("Selecione ao menos uma foto.");

    startTransition(async () => {
      const fila = [...arquivos];
      const paths: string[] = [];
      let falha: string | null = null;

      async function enviarDaFila() {
        while (fila.length && !falha) {
          const arquivo = fila.shift();
          if (!arquivo) return;
          const envio = await enviarArquivoParaStorage("diario-obra", `${obraId}/${data}`, arquivo);
          if (envio.path === null) {
            falha = envio.error;
            return;
          }
          paths.push(envio.path);
          setEnviadas(paths.length);
        }
      }

      await Promise.all(
        Array.from({ length: Math.min(ENVIOS_EM_PARALELO, arquivos.length) }, enviarDaFila)
      );

      if (falha) {
        // Falhou no meio do lote: desfaz as que já subiram, senão elas ficam
        // no bucket sem nenhuma linha apontando para elas.
        await removerArquivosDoStorage("diario-obra", paths);
        return setErro(falha);
      }

      const resultado = await registrarFotos(obraId, data, paths);
      if (resultado.error) return setErro(resultado.error);

      formRef.current?.reset();
      setSelecionadas(0);
      setEnviadas(0);
      router.refresh();
    });
  }

  return (
    <form ref={formRef} action={handleSubmit}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="fotos">Adicionar fotos</FieldLabel>
          <Input
            id="fotos"
            name="fotos"
            type="file"
            accept="image/*"
            multiple
            required
            onChange={(e) => {
              setErro(null);
              setSelecionadas(e.target.files?.length ?? 0);
            }}
          />
          <p className="text-xs text-muted-foreground">
            Pode selecionar várias de uma vez. Legenda é opcional e se escreve depois, na foto.
          </p>
        </Field>
        {erro && <FieldError>{erro}</FieldError>}
        <Button type="submit" variant="outline" disabled={pending || !selecionadas}>
          <Upload className="size-4" />
          {pending
            ? `Enviando ${enviadas} de ${selecionadas}...`
            : selecionadas > 1
              ? `Enviar ${selecionadas} fotos`
              : "Enviar foto"}
        </Button>
      </FieldGroup>
    </form>
  );
}

/**
 * Legenda de uma foto já enviada, escrita direto sobre a imagem.
 *
 * Fica aqui, e não no envio, porque legenda por foto no momento do upload é o
 * que fazia o engenheiro desistir de anexar: são vinte fotos e ele está na
 * obra. Em branco, a foto simplesmente não tem legenda e o RDO não imprime
 * nenhuma. Salva ao sair do campo — sem botão, porque um botão por foto numa
 * grade de vinte é mais ruído que ajuda.
 */
export function LegendaFoto({
  obraId,
  data,
  fotoId,
  legenda,
}: {
  obraId: string;
  data: string;
  fotoId: string;
  legenda: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [salva, setSalva] = useState(false);
  const router = useRouter();

  function handleBlur(event: React.FocusEvent<HTMLInputElement>) {
    const texto = event.target.value;
    if (texto.trim() === (legenda ?? "").trim()) return;

    startTransition(async () => {
      const resultado = await salvarLegendaFoto(obraId, data, fotoId, texto);
      if (resultado.error) return alert(resultado.error);
      setSalva(true);
      router.refresh();
    });
  }

  return (
    <input
      defaultValue={legenda ?? ""}
      onBlur={handleBlur}
      onChange={() => setSalva(false)}
      disabled={pending}
      placeholder={pending ? "Salvando..." : "Legenda (opcional)"}
      aria-label="Legenda da foto"
      className={
        salva
          ? "w-full border-t bg-sucesso/10 px-2 py-1.5 text-xs outline-none placeholder:text-muted-foreground"
          : "w-full border-t bg-transparent px-2 py-1.5 text-xs outline-none placeholder:text-muted-foreground focus:bg-muted/50"
      }
    />
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

/**
 * Campo de texto livre dentro de uma seção da folha.
 *
 * Salva ao sair do campo, sem botão — é o mesmo arranjo da legenda de foto, e
 * pela mesma razão: um botão por campo numa folha com quatro seções é mais
 * ruído que ajuda. Em branco, o campo simplesmente não tem conteúdo e a seção
 * volta a mostrar apenas o que veio das outras telas.
 */
export function CampoExtra({
  obraId,
  data,
  campo,
  valor,
  rotulo,
  exemplo,
}: {
  obraId: string;
  data: string;
  campo: CampoExtraDiario;
  valor: string | null;
  rotulo: string;
  exemplo: string;
}) {
  const [pending, startTransition] = useTransition();
  const [salvo, setSalvo] = useState(false);
  const router = useRouter();

  function handleBlur(event: React.FocusEvent<HTMLTextAreaElement>) {
    const texto = event.target.value;
    if (texto.trim() === (valor ?? "").trim()) return;

    startTransition(async () => {
      const resultado = await salvarExtraDoDia(obraId, data, campo, texto);
      if (resultado.error) return alert(resultado.error);
      setSalvo(true);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-1 border-t pt-2">
      <label
        htmlFor={`${campo}-${data}`}
        className="text-xs font-medium text-muted-foreground"
      >
        {rotulo}
      </label>
      <Textarea
        id={`${campo}-${data}`}
        defaultValue={valor ?? ""}
        onBlur={handleBlur}
        onChange={() => setSalvo(false)}
        disabled={pending}
        rows={2}
        placeholder={pending ? "Salvando..." : exemplo}
        className={salvo ? "bg-sucesso/10" : undefined}
      />
      <p className="text-xs text-muted-foreground">Um por linha. Salva ao sair do campo.</p>
    </div>
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
