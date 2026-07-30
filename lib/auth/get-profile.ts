import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/types/database.types";

export type Profile = Tables<"profiles">;

/**
 * Busca o profile (com role) do usuário autenticado. `cache()` evita repetir
 * a consulta quando chamado várias vezes durante o mesmo request (layout + page).
 */
export const getProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return profile;
});
