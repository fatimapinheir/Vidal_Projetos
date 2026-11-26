-- ---------------------------------------------------------------------------
-- Histórico de permissões
--
-- O QUE ESTAVA ERRADO: conceder gravava `concedida_em` e `concedida_por` na
-- linha; revogar era um `delete`, e sumia sem rastro. Em 26/11/2026 isso ficou
-- concreto: cinco permissões do Ardiles foram revogadas pela tela, e só deu
-- para identificar quais porque o estado anterior estava registrado fora do
-- sistema, numa conversa. A pergunta "quem tirou do Ardiles a permissão de
-- excluir obra, e quando?" o banco não sabia responder.
--
-- Numa empresa que movimenta dinheiro, essa é a pergunta que alguém faz um dia
-- — e normalmente no pior momento.
--
-- O DESENHO: tabela de estado + log append-only, as duas escritas pela mesma
-- RPC, na mesma transação. `permissoes_usuario` continua sendo a verdade do
-- agora (barata, indexada, e é o que `pode()` consulta — ela não muda nada), e
-- `permissoes_eventos` guarda o que aconteceu. Ler o último evento a cada
-- checagem custaria uma função de janela em todo clique, para responder o que
-- uma linha indexada já responde.
--
-- SEM CHAVE ESTRANGEIRA, de propósito, e isto é o oposto do reflexo normal:
--   - FK para `permissoes_catalogo` com `on delete cascade` APAGARIA O
--     HISTÓRICO ao se remover uma permissão do catálogo. Um log que o sistema
--     pode apagar sozinho não é log.
--   - FK para `profiles` faria o mesmo ao se excluir um usuário — e é
--     justamente de quem saiu que mais se quer saber o que foi concedido.
-- Por isso os ids ficam soltos, e a tela junta com `profiles` quando a pessoa
-- ainda existe.
-- ---------------------------------------------------------------------------

create table if not exists permissoes_eventos (
  id         bigint generated always as identity primary key,
  usuario_id uuid not null,
  /*
   * Ou uma ação do catálogo, ou o literal 'administrador'. Promover e rebaixar
   * administrador é a mudança de permissão mais grave que existe aqui —
   * deixá-la fora do mesmo log por não ser "uma permissão do catálogo" seria
   * registrar o pequeno e esquecer o grande.
   */
  acao       text not null,
  /** `true` concedeu, `false` revogou. */
  concedida  boolean not null,
  em         timestamptz not null default now(),
  /** Quem fez. Nulo nos eventos semeados pela migração — ver o fim do arquivo. */
  por        uuid
);

comment on table permissoes_eventos is
  'Log append-only de concessões e revogações, inclusive de administrador. Sem FK de propósito: cascade apagaria histórico. Escrito só pelas RPCs. Ver 0085.';

create index if not exists idx_permissoes_eventos_usuario on permissoes_eventos (usuario_id, em desc);
create index if not exists idx_permissoes_eventos_em on permissoes_eventos (em desc);

alter table permissoes_eventos enable row level security;

-- Mesma regra da tabela de estado: cada um vê o seu, admin vê de todos. Sem
-- policy de escrita — só as RPCs gravam, e append-only significa que nem elas
-- atualizam ou apagam.
drop policy if exists permissoes_eventos_leitura on permissoes_eventos;
create policy permissoes_eventos_leitura on permissoes_eventos
  for select to authenticated
  using (usuario_id = (select auth.uid()) or (select is_admin()));

-- ---------------------------------------------------------------------------
-- As RPCs passam a registrar
-- ---------------------------------------------------------------------------

create or replace function public.definir_permissao(
  p_usuario uuid,
  p_acao text,
  p_conceder boolean
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_eu uuid := auth.uid();
  v_mudou integer;
begin
  if v_eu is null then
    raise exception 'Não há sessão.';
  end if;

  if not exists (select 1 from profiles where id = v_eu and administrador) then
    raise exception 'Só quem administra permissões pode alterá-las.';
  end if;

  if not exists (select 1 from permissoes_catalogo where acao = p_acao) then
    raise exception 'Permissão % não existe no catálogo.', p_acao;
  end if;

  /*
   * Alvo precisa ter 'engenheiro' em papeis. `exists` com `= any(papeis)`, e
   * não `= any (subquery)`: a segunda forma compara com o conjunto de linhas e
   * estoura com "malformed array literal" — foi o bug corrigido na 0080.
   */
  if not exists (
    select 1 from profiles
    where id = p_usuario and 'engenheiro' = any (papeis)
  ) then
    raise exception 'Permissão de obra só vale para quem tem perfil de engenheiro.';
  end if;

  if p_conceder then
    insert into permissoes_usuario (usuario_id, acao, concedida_por)
    values (p_usuario, p_acao, v_eu)
    on conflict (usuario_id, acao) do nothing;
  else
    delete from permissoes_usuario where usuario_id = p_usuario and acao = p_acao;
  end if;

  get diagnostics v_mudou = row_count;

  /*
   * Só registra quando o estado MUDOU de fato.
   *
   * Ligar uma chave que já estava ligada não é um evento — é um clique que não
   * fez nada, e o `on conflict do nothing` já o absorve. Registrar daria um
   * histórico cheio de linhas idênticas que não contam nada, e quem fosse
   * auditar teria de filtrar ruído para achar a mudança real.
   */
  if v_mudou > 0 then
    insert into permissoes_eventos (usuario_id, acao, concedida, por)
    values (p_usuario, p_acao, p_conceder, v_eu);
  end if;
end;
$$;

create or replace function public.definir_administrador(
  p_usuario uuid,
  p_admin boolean
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_eu uuid := auth.uid();
  v_mudou integer;
begin
  if v_eu is null then
    raise exception 'Não há sessão.';
  end if;

  if not exists (select 1 from profiles where id = v_eu and administrador) then
    raise exception 'Só quem administra permissões pode alterá-las.';
  end if;

  -- Travas espelhadas no `excluirObra`, que já protege a conta de engenheiro e
  -- a de quem está excluindo: um clique não deve poder destruir o próprio
  -- acesso, nem deixar o sistema sem ninguém que possa consertá-lo.
  if not p_admin and p_usuario = v_eu then
    raise exception 'Você não pode retirar a sua própria administração. Peça a outro administrador.';
  end if;

  if not p_admin and (select count(*) from profiles where administrador) <= 1 then
    raise exception 'O sistema precisa de pelo menos um administrador.';
  end if;

  if p_admin and not exists (
    select 1 from profiles where id = p_usuario and 'engenheiro' = any (papeis)
  ) then
    raise exception 'Administrador precisa ter perfil de engenheiro.';
  end if;

  update profiles set administrador = p_admin
  where id = p_usuario and administrador is distinct from p_admin;

  get diagnostics v_mudou = row_count;

  if v_mudou > 0 then
    insert into permissoes_eventos (usuario_id, acao, concedida, por)
    values (p_usuario, 'administrador', p_admin, v_eu);
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Semeadura do histórico
--
-- O log nasce com um evento por permissão que existe HOJE, usando a data e o
-- autor que a própria linha guarda. Não inventa nada: o que estava com
-- `concedida_por` nulo (veio de migração) entra com autor nulo.
--
-- NÃO MEXE em `permissoes_usuario`. As permissões ajustadas na tela ficam
-- exatamente como estão — o pedido foi registrar o evento, não rearranjar o
-- estado.
--
-- O QUE ESTE LOG NÃO TEM, e é honesto dizer: as revogações anteriores a esta
-- migração são irrecuperáveis, porque eram `delete`. Inclui as cinco do
-- Ardiles de 26/11/2026. Dar a elas um horário inventado seria fabricar
-- registro de auditoria, que é pior do que não ter.
-- ---------------------------------------------------------------------------

insert into permissoes_eventos (usuario_id, acao, concedida, em, por)
select pu.usuario_id, pu.acao, true, pu.concedida_em, pu.concedida_por
from permissoes_usuario pu
where not exists (
  select 1 from permissoes_eventos e
  where e.usuario_id = pu.usuario_id and e.acao = pu.acao
);

insert into permissoes_eventos (usuario_id, acao, concedida, em, por)
select p.id, 'administrador', true, p.created_at, null
from profiles p
where p.administrador
  and not exists (
    select 1 from permissoes_eventos e
    where e.usuario_id = p.id and e.acao = 'administrador'
  );
