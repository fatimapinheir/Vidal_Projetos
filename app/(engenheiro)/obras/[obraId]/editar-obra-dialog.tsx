"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldError,
  FieldSet,
  FieldLegend,
  FieldDescription,
  FieldSeparator,
} from "@/components/ui/field";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Pencil, Trash2 } from "lucide-react";
import { atualizarObra, type ObraFormState } from "@/app/actions/obras";
import {
  vincularCliente,
  desvincularCliente,
  type VincularClienteState,
} from "@/app/actions/obra-clientes";
import type { Tables } from "@/lib/types/database.types";
import { ObraFormCampos, type TipoObra } from "@/components/obras/obra-form-campos";
import { ImagemObraUpload } from "@/components/obras/imagem-obra-upload";
import type { UrlsImagensObra } from "@/lib/obras/imagens";

const estadoObra: ObraFormState = { error: null };
const estadoCliente: VincularClienteState = { error: null };

export type ClienteVinculado = { id: string; nome: string; email: string | null };

/**
 * Edição da obra em diálogo, no mesmo padrão dos outros cadastros do sistema.
 *
 * O vínculo de cliente mora aqui dentro como seção, e não como um segundo
 * diálogo: diálogo sobre diálogo é confuso no desktop e inviável no celular.
 * São dois `form` irmãos — o de dados da obra e o de vincular — porque
 * formulário aninhado não é válido em HTML.
 */
export function EditarObraDialog({
  obra,
  clientes,
  tipos,
  imagens,
  gatilho,
}: {
  obra: Tables<"obras">;
  clientes: ClienteVinculado[];
  tipos: TipoObra[];
  /** URLs assinadas das fotos — o bucket é privado, quem assina é a página. */
  imagens: UrlsImagensObra;
  /** Permite abrir o mesmo diálogo pelo card de dados ou pelo card de cliente. */
  gatilho?: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const salvarObra = atualizarObra.bind(null, obra.id);
  const [estadoSalvar, salvarAction, salvando] = useActionState(salvarObra, estadoObra);

  const vincular = vincularCliente.bind(null, obra.id);
  const [estadoVincular, vincularAction, vinculando] = useActionState(vincular, estadoCliente);

  useEffect(() => {
    if (estadoSalvar.success) toast.success("Obra atualizada.");
  }, [estadoSalvar.success]);

  useEffect(() => {
    if (estadoVincular.success) toast.success("Cliente vinculado.");
  }, [estadoVincular.success]);

  function handleDesvincular(clienteId: string, nome: string) {
    if (!confirm(`Remover o acesso de ${nome} a esta obra? A conta dele continua existindo.`)) {
      return;
    }
    startTransition(() => {
      desvincularCliente(obra.id, clienteId).then(() => router.refresh());
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          gatilho ?? (
            <Button variant="ghost" size="sm">
              <Pencil className="size-4" />
              Editar
            </Button>
          )
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar obra</DialogTitle>
        </DialogHeader>

        <form action={salvarAction} className="flex flex-col gap-4">
          <ObraFormCampos obra={obra} tipos={tipos} />
          {estadoSalvar.error && <FieldError>{estadoSalvar.error}</FieldError>}
          <div>
            <Button type="submit" disabled={salvando}>
              {salvando ? "Salvando..." : "Salvar dados da obra"}
            </Button>
          </div>
        </form>

        <FieldSeparator />

        {/*
          As fotos ficam fora do <form> dos dados, e salvam sozinhas.
          
          Elas não passam pela Server Action junto com os outros 24 campos:
          binário em action viaja em base64 e estoura o limite de payload da
          função em produção. Cada upload vai direto para o Storage e grava o
          caminho na hora — por isso não depende do botão "Salvar dados da
          obra", e é bom que não dependa: trocar a capa não deveria obrigar a
          revalidar o cadastro inteiro.
        */}
        <div className="flex flex-col gap-5">
          <div>
            <p className="text-sm font-medium">Fotos da obra</p>
            <p className="text-xs text-muted-foreground">
              Aparecem no portal do cliente. Salvam sozinhas, assim que você escolhe o arquivo.
            </p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <ImagemObraUpload obraId={obra.id} campo="capa" urlAtual={imagens.capa} />
            <ImagemObraUpload obraId={obra.id} campo="rdo" urlAtual={imagens.rdo} />
          </div>
        </div>

        <FieldSeparator />

        <div className="flex flex-col gap-3">
          <div>
            <p className="text-sm font-medium">Clientes com acesso</p>
            <p className="text-xs text-muted-foreground">
              Quem acompanha esta obra pelo portal. Só se mexe aqui — na visão geral o cliente
              aparece apenas para leitura.
            </p>
          </div>

          {clientes.map((c) => (
            <div
              key={c.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-2.5 text-sm"
            >
              <div className="min-w-0">
                <p className="font-medium">{c.nome}</p>
                <p className="truncate text-muted-foreground">{c.email ?? "—"}</p>
              </div>
              <Button
                onClick={() => handleDesvincular(c.id, c.nome)}
                disabled={pending}
                variant="ghost"
                size="icon-sm"
                aria-label={`Remover acesso de ${c.nome}`}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}

          {!clientes.length && (
            <p className="rounded-lg border border-dashed p-3 text-center text-sm text-muted-foreground">
              Nenhum cliente com acesso a esta obra.
            </p>
          )}

          <form action={vincularAction}>
            <FieldGroup>
              <Field orientation="responsive">
                <div className="w-full">
                  <FieldLabel htmlFor="email">E-mail do cliente</FieldLabel>
                  <Input id="email" name="email" type="email" required />
                </div>
                <div className="w-full">
                  <FieldLabel htmlFor="nome_cliente">Nome (se for novo)</FieldLabel>
                  <Input id="nome_cliente" name="nome" />
                </div>
              </Field>
              <FieldDescription>
                Se já existir conta com esse e-mail, apenas vinculamos. Senão, criamos a conta e
                enviamos um link para o cliente definir a senha.
              </FieldDescription>
              {estadoVincular.error && <FieldError>{estadoVincular.error}</FieldError>}
              <Button type="submit" variant="outline" disabled={vinculando}>
                {vinculando ? "Vinculando..." : "Vincular cliente"}
              </Button>
            </FieldGroup>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
