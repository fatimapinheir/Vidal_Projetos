import "server-only";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { COOKIE_OBRA_ATIVA } from "./obra-ativa";

/**
 * Última obra aberta, para a lateral já apontar para ela.
 *
 * Fica em cookie e não em localStorage porque quem precisa do valor é o
 * servidor: é ele que monta os links da barra lateral. Lido no cliente, o
 * primeiro render viria sem obra e os links piscariam depois.
 *
 * Confere se a obra ainda existe antes de devolver. Sem isso, apagar a obra
 * lembrada envenenaria o menu inteiro de uma vez: as dez seções apontariam
 * para uma obra morta, e cada clique cairia em 404. Custa uma busca por chave
 * primária por navegação — barato perto de deixar o usuário preso.
 *
 * Não é controle de acesso: a consulta passa pela RLS, então uma obra de outro
 * engenheiro simplesmente não volta, e o cookie é descartado como inválido.
 */
export async function lerObraAtiva(): Promise<string | null> {
  const valor = (await cookies()).get(COOKIE_OBRA_ATIVA)?.value;
  // Só aceita formato de UUID: o cookie é editável pelo usuário e o valor vai
  // direto para dentro de uma URL.
  if (!valor || !/^[0-9a-f-]{36}$/i.test(valor)) return null;

  const supabase = await createClient();
  const { data } = await supabase.from("obras").select("id").eq("id", valor).maybeSingle();
  return data?.id ?? null;
}
