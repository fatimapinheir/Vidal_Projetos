import { redirect } from "next/navigation";
import { getSessao } from "@/lib/auth/sessao";
import { createClient } from "@/lib/supabase/server";
import { papeisDoUsuario, destinoDoPerfil } from "@/lib/auth/papeis";
import { lerObraAtiva } from "@/lib/obra-ativa.server";

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
  const [conta, obraLembrada] = await Promise.all([
    papeisDoUsuario(supabase, sessao.id),
    // A última obra aberta é o destino de quem nunca definiu uma padrão.
    lerObraAtiva(),
  ]);

  redirect(destinoDoPerfil(sessao.role, conta?.obraPadraoId ?? null, obraLembrada));
}
