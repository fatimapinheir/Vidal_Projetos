"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldError,
  FieldDescription,
} from "@/components/ui/field";
import { atualizarPerfil } from "@/app/actions/perfil";

export function PerfilForm({
  inicial,
}: {
  inicial: { nome: string; telefone: string; crea: string; email: string };
}) {
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const router = useRouter();

  async function salvar(formData: FormData) {
    setSalvando(true);
    setErro(null);
    const r = await atualizarPerfil({ error: null }, formData);
    setSalvando(false);
    if (!r.success) {
      setErro(r.error ?? "Não foi possível salvar.");
      return;
    }
    toast.success("Cadastro atualizado.");
    router.refresh();
  }

  return (
    <form action={salvar}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="nome">Nome</FieldLabel>
          <Input id="nome" name="nome" defaultValue={inicial.nome} required />
        </Field>

        <Field orientation="responsive">
          <div className="w-full">
            <FieldLabel htmlFor="crea">CREA / CAU</FieldLabel>
            <Input id="crea" name="crea" defaultValue={inicial.crea} placeholder="123456/D" />
            <FieldDescription>Aparece abaixo da sua assinatura no relatório.</FieldDescription>
          </div>
          <div className="w-full">
            <FieldLabel htmlFor="telefone">Telefone</FieldLabel>
            <Input id="telefone" name="telefone" defaultValue={inicial.telefone} />
          </div>
        </Field>

        <Field>
          <FieldLabel htmlFor="email-leitura">E-mail</FieldLabel>
          {/* Só leitura: o e-mail é a credencial de login, e trocá-lo mexe na
              conta de autenticação, não só no perfil. */}
          <Input id="email-leitura" defaultValue={inicial.email} readOnly className="bg-muted" />
          <FieldDescription>
            É o seu login. Para trocar, fale comigo — mexe na conta de acesso.
          </FieldDescription>
        </Field>

        {erro && <FieldError>{erro}</FieldError>}
        <div>
          <Button type="submit" disabled={salvando}>
            {salvando ? "Salvando..." : "Salvar cadastro"}
          </Button>
        </div>
      </FieldGroup>
    </form>
  );
}
