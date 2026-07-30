import { redirect } from "next/navigation";
import { getProfile, type Profile } from "@/lib/auth/get-profile";
import type { UserRole } from "@/lib/types/database.types";

/**
 * Garante que o usuário logado tem o papel esperado. Usado nos layouts de
 * app/(engenheiro) e app/(cliente). Redireciona para /login se não autenticado,
 * ou para o dashboard correto se o papel não bate (evita cliente acessar telas
 * de engenheiro e vice-versa).
 */
export async function requireRole(role: UserRole): Promise<Profile> {
  const profile = await getProfile();

  if (!profile) {
    redirect("/login");
  }

  if (profile.role !== role) {
    redirect(profile.role === "engenheiro" ? "/dashboard" : "/portal/dashboard");
  }

  return profile;
}
