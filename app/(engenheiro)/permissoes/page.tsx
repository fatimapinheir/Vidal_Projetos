import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { MatrizDePermissoes } from "./matriz-de-permissoes";
import { HistoricoDePermissoes, type EventoPermissao } from "./historico-de-permissoes";

/** Quantos eventos a tela mostra. O log guarda tudo; aqui só o recente cabe. */
const EVENTOS_NA_TELA = 30;

/**
 * Quem pode o quê (migração 0082), e o histórico de quem mudou (0085).
 *
 * No desktop é uma MATRIZ — permissões nas linhas, pessoas nas colunas — porque
 * a pergunta que se faz aqui é comparativa: "quem pode aprovar compra?". No
 * celular a matriz vira uma pessoa por vez; ver o comentário em
 * `matriz-de-permissoes.tsx`.
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
   * Tudo numa onda. Em fila, cada consulta custaria uma ida a São Paulo
   * (~50ms) numa tela que não tem dependência entre elas.
   */
  const [{ data: usuarios }, { data: catalogo }, { data: concessoes }, { data: eventos }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id, nome, email, administrador, papeis")
        .contains("papeis", ["engenheiro"])
        .order("nome"),
      supabase.from("permissoes_catalogo").select("*").order("ordem"),
      supabase.from("permissoes_usuario").select("usuario_id, acao"),
      supabase
        .from("permissoes_eventos")
        .select("id, acao, concedida, em, usuario_id, por")
        .order("em", { ascending: false })
        .order("id", { ascending: false })
        .limit(EVENTOS_NA_TELA),
    ]);

  const { data: claims } = await supabase.auth.getClaims();
  const meuId = claims?.claims?.sub ?? "";

  /*
   * Os nomes vêm de um mapa montado aqui, e não de um join no PostgREST.
   *
   * `permissoes_eventos` não tem chave estrangeira para `profiles` — de
   * propósito, para um `delete` de usuário não apagar o histórico dele (0085).
   * Sem FK o PostgREST não sabe fazer o join embutido, então a junção acontece
   * em memória. O custo é zero: os perfis já foram buscados acima.
   */
  const nomePorId = new Map((usuarios ?? []).map((u) => [u.id, u.nome]));
  const rotulos = Object.fromEntries((catalogo ?? []).map((c) => [c.acao, c.rotulo]));

  const historico: EventoPermissao[] = (eventos ?? []).map((e) => ({
    id: e.id,
    acao: e.acao,
    concedida: e.concedida,
    em: e.em,
    // Quem não está no mapa é alguém sem perfil de engenheiro hoje — ou que
    // saiu do sistema. O histórico continua valendo; só o nome se perdeu.
    alvo: nomePorId.get(e.usuario_id) ?? "usuário removido",
    por: e.por ? (nomePorId.get(e.por) ?? "usuário removido") : null,
  }));

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

      <section className="rounded-lg border p-4">
        <h2 className="font-heading text-lg">Histórico de alterações</h2>
        <p className="mt-1 mb-3 text-sm text-muted-foreground">
          Toda liberação e toda retirada ficam registradas, com quem fez e quando. Mudanças
          anteriores a 26/11/2026 não aparecem: até então, retirar uma permissão não deixava
          registro.
        </p>
        <HistoricoDePermissoes eventos={historico} rotulos={rotulos} />
      </section>
    </div>
  );
}
