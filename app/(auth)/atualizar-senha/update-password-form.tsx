"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldGroup, FieldLabel, FieldError } from "@/components/ui/field";
import { createClient } from "@/lib/supabase/client";

export function UpdatePasswordForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    const password = String(formData.get("password") ?? "");
    const confirmacao = String(formData.get("confirmacao") ?? "");

    if (password.length < 8) {
      setError("A senha precisa ter pelo menos 8 caracteres.");
      return;
    }
    if (password !== confirmacao) {
      setError("As senhas não coincidem.");
      return;
    }

    startTransition(async () => {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });

      if (updateError) {
        setError("Não foi possível atualizar a senha. Peça um novo link ao engenheiro.");
        return;
      }

      window.location.assign("/");
    });
  }

  return (
    <form action={handleSubmit}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="password">Nova senha</FieldLabel>
          <Input id="password" name="password" type="password" required minLength={8} />
        </Field>
        <Field>
          <FieldLabel htmlFor="confirmacao">Confirme a senha</FieldLabel>
          <Input id="confirmacao" name="confirmacao" type="password" required minLength={8} />
        </Field>
        {error && <FieldError>{error}</FieldError>}
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Salvando..." : "Salvar senha"}
        </Button>
      </FieldGroup>
    </form>
  );
}
