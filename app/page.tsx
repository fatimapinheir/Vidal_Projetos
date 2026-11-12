import { redirect } from "next/navigation";
import { getSessao } from "@/lib/auth/sessao";
import { createClient } from "@/lib/supabase/server";
import { papeisDoUsuario, destinoDoPerfil } from "@/lib/auth/papeis";

export default async function Home() {
  const sessao = await getSessao();
  if (!sessao) redirect("/login");

  /*
   * A ida ao banco aqui é aceitável e em nenhum outro lugar seria: esta rota
   * não renderiza nada, só decide o destino, e roda uma vez por entrada no
   * sistema — não em toda navegação, que é o caso que `getSessao` existe para
   * tornar barato.
   */
  const supabase = await createClient();
  const conta = await papeisDoUsuario(supabase, sessao.id);

  redirect(destinoDoPerfil(sessao.role, conta?.obraPadraoId ?? null));
}
