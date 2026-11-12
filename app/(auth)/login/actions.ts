"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { destinoDoPerfil } from "@/lib/auth/papeis";
import { lerObraAtiva } from "@/lib/obra-ativa.server";

export type LoginState = { error: string | null };

export async function login(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Informe email e senha." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "Email ou senha inválidos." };
  }

  /*
   * O papel vem do BANCO, e não do token que acabou de ser emitido.
   *
   * Aqui é o único lugar em que isso não é desperdício: a consulta já existia
   * para decidir o destino, e `obra_padrao_id` entra nela sem custo nenhum.
   * Com obra padrão definida, quem tem os dois perfis entra direto na visão
   * geral dela em vez de passar pelo Dashboard de todas as obras.
   */
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, obra_padrao_id")
    .eq("id", data.user.id)
    .single();

  /*
   * A última obra aberta vem do cookie, que sobrevive ao logout: quem entra de
   * novo na mesma máquina volta para onde estava, sem precisar ter definido
   * obra padrão. `lerObraAtiva` confere que a obra ainda existe e passa pela
   * RLS, então um cookie velho ou de outra pessoa simplesmente não conta.
   */
  const obraLembrada = await lerObraAtiva();

  redirect(
    profile
      ? destinoDoPerfil(profile.role, profile.obra_padrao_id, obraLembrada)
      : "/portal/dashboard"
  );
}
