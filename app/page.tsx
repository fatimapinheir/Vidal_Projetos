import { redirect } from "next/navigation";
import { getSessao } from "@/lib/auth/sessao";

export default async function Home() {
  const profile = await getSessao();

  if (!profile) redirect("/login");
  redirect(profile.role === "engenheiro" ? "/dashboard" : "/portal/dashboard");
}
