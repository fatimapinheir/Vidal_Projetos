import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { MatrizDePermissoes } from "./matriz-de-permissoes";

/**
 * Quem pode o quê (migração 0082).
 *
 * A tela é uma MATRIZ — permissões nas linhas, pessoas nas colunas — e não um
 * cartão por pessoa, porque a pergunta que se faz aqui é comparativa: "quem
 * pode aprovar compra?". Num cartão por pessoa isso exige abrir três cartões e
 * guardar na cabeça.
 *
 * Só administrador entra. A checagem é `is_admin()` no banco, e não o token:
 * `auth.updateUser` não emite token novo na hora, então quem fosse rebaixado
 * continuaria abrindo esta tela por quase uma hora.
 */
export default async function PermissoesPage() {
  await requireRole("engenheiro");
  const supabase = await createClient();

  const { data: souAdmin } = await supabase.rpc("is_admin");
  if (souAdmin !== true) redirect("/");

  /*
   * Tudo numa onda. Três consultas em fila custariam três idas a São Paulo
   * (~50ms cada) numa tela que não tem dependência entre elas.
   */
  const [{ data: usuarios }, { data: catalogo }, { data: concessoes }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, nome, email, administrador, papeis")
      .contains("papeis", ["engenheiro"])
      .order("nome"),
    supabase.from("permissoes_catalogo").select("*").order("ordem"),
    supabase.from("permissoes_usuario").select("usuario_id, acao"),
  ]);

  const { data: claims } = await supabase.auth.getClaims();
  const meuId = claims?.claims?.sub ?? "";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl">Permissões</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          O que cada engenheiro pode decidir e destruir. O trabalho do dia a dia — lançar tarefa,
          salvar RDO, montar orçamento — não passa por aqui: todo engenheiro faz.
        </p>
      </div>

      <MatrizDePermissoes
        usuarios={usuarios ?? []}
        catalogo={catalogo ?? []}
        concessoes={concessoes ?? []}
        meuId={meuId}
      />
    </div>
  );
}
