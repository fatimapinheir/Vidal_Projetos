import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { chavesDoProjeto } from "@/lib/auth/chaves-do-projeto";
import type { Tables } from "@/lib/types/database.types";

export type Profile = Tables<"profiles">;

/**
 * Busca o profile (com role) do usuário autenticado. `cache()` evita repetir
 * a consulta quando chamado várias vezes durante o mesmo request (layout + page).
 *
 * A sessão é verificada LOCALMENTE, por `getClaims()`. Era `getUser()`, que vai
 * à rede — e como o proxy já tinha ido à rede na mesma requisição, toda
 * navegação pagava DUAS idas e voltas ao servidor de autenticação antes de a
 * primeira consulta da página começar. Ver a nota longa em `lib/supabase/proxy`.
 *
 * O `sub` do token é o id do usuário, e é com ele que o perfil é buscado. Os
 * dados em si continuam vindo do banco a cada requisição: o token diz QUEM é,
 * o banco diz o que essa pessoa é hoje. Por isso mudar o papel de alguém
 * — cliente para engenheiro, por exemplo — vale na navegação seguinte, sem
 * esperar o token expirar.
 */
export const getProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();

  const { data: sessao } = await supabase.auth.getClaims(undefined, {
    jwks: await chavesDoProjeto(),
  });
  const usuarioId = sessao?.claims?.sub;

  if (!usuarioId) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", usuarioId)
    .single();

  return profile;
});
