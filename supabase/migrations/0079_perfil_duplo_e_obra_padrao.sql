-- Um usuário, dois perfis: Ardiles é cliente de uma obra E engenheiro.
--
-- POR QUE `role` CONTINUA SENDO UMA COLUNA SÓ
--
-- O caminho óbvio seria trocar `profiles.role` por uma lista e ensinar
-- `is_engenheiro()` a procurar dentro dela. Seria reescrever a base de TODA a
-- autorização do sistema — `is_engenheiro()` aparece em mais de cem policies —
-- para resolver um problema de navegação. E deixaria uma pergunta sem resposta:
-- no portal, lendo uma tela de cliente, ele é cliente ou engenheiro? Com a
-- lista, os dois ao mesmo tempo, sempre.
--
-- Aqui `role` passa a ser o perfil ATIVO e ganha ao lado `papeis`, que é o teto
-- do que ele pode ser. Trocar de perfil é um `update` em `role`. Três
-- consequências, todas boas:
--
--   1. Nenhuma policy muda. `is_engenheiro()` continua lendo `role`, e passa a
--      responder sobre o perfil em que a pessoa está AGORA.
--   2. "Trocar de perfil" quer dizer a mesma coisa em todo lugar: menu,
--      roteamento e RLS seguem juntos. Não existe o estado em que a tela diz
--      uma coisa e o banco faz outra.
--   3. No perfil de cliente ele perde de verdade o acesso de engenheiro, o que
--      é o comportamento que a troca promete.
--
-- A TROCA SÃO DOIS PASSOS, E ESTE É O PRIMEIRO
--
-- `lib/auth/sessao.ts` lê o papel de `user_metadata` no JWT para não gastar uma
-- ida de 431 ms ao banco em toda navegação. Um `update` só aqui mudaria o
-- ACESSO na hora e deixaria o MENU parado por até uma hora, que é a validade do
-- access token — a pessoa clicaria em "ver como cliente" e continuaria vendo o
-- menu de engenheiro.
--
-- Então a tela faz dois passos, nesta ordem: esta função (que é a autoridade —
-- confere `papeis` e grava `profiles.role`) e depois
-- `auth.updateUser({ data: { role } })` no navegador, que é a API suportada
-- para mexer no metadata e devolve um token novo na hora.
--
-- Escrever em `auth.users` daqui resolveria em um passo só e foi o primeiro
-- desenho. Saiu: o schema `auth` é da plataforma, e o Supabase pode mudar o
-- formato de `raw_user_meta_data` numa atualização sem avisar ninguém — uma
-- função nossa escrevendo lá dentro quebraria calada, no login.
--
-- E se alguém chamar só o segundo passo, pelo console do navegador, sem passar
-- por aqui? Vê a moldura de engenheiro sobre telas VAZIAS, e nada mais: quem
-- decide o que se lê e grava é a RLS, e `is_engenheiro()` consulta
-- `profiles.role` no banco a cada consulta. É o mesmo estado de quem está com
-- token velho, que o sistema já tolera por desenho — ver a nota longa em
-- `lib/auth/sessao`.

alter table profiles add column papeis user_role[];

-- Quem já existe continua podendo ser só o que era.
update profiles set papeis = array[role];

alter table profiles alter column papeis set not null;
alter table profiles alter column papeis set default '{}'::user_role[];

alter table profiles add constraint profiles_papeis_nao_vazio check (cardinality(papeis) > 0);

-- O perfil ativo tem de estar entre os permitidos, senão a troca poderia
-- deixar a pessoa num perfil que ela não tem.
alter table profiles add constraint profiles_role_esta_em_papeis
  check (role = any (papeis));

comment on column profiles.papeis is
  'Os perfis que esta pessoa PODE assumir. `role` é o ativo agora, e tem de ser um destes. Trocar é por trocar_perfil() — ver 0079.';

/*
 * Usuário novo nasce com um papel só: o que veio no insert.
 *
 * O default é `{}`, que a restrição recusa — de propósito. Quem cria perfil
 * (o cadastro de cliente, o gatilho de signup) não precisa saber que `papeis`
 * existe, e sem isto todo insert passaria a quebrar.
 */
create or replace function public.trg_papeis_iniciais()
returns trigger language plpgsql as $$
begin
  if new.papeis is null or cardinality(new.papeis) = 0 then
    new.papeis := array[new.role];
  end if;
  return new;
end;
$$;

create trigger trg_profiles_papeis_iniciais
  before insert on profiles
  for each row execute function public.trg_papeis_iniciais();

-- ---------------------------------------------------------------------------
-- A obra em que o perfil de engenheiro abre
--
-- Para quem tem os dois perfis, "Dashboard" é a tela errada de chegada: ele
-- acompanha UMA obra, e o painel de todas as obras é o assunto de quem
-- gerencia a construtora. Com a obra padrão definida, entrar no perfil de
-- engenheiro cai direto na visão geral dela.
-- ---------------------------------------------------------------------------
alter table profiles add column obra_padrao_id uuid references obras(id) on delete set null;

comment on column profiles.obra_padrao_id is
  'Obra em que o perfil de engenheiro abre. Nula = cai no Dashboard. `on delete set null`: obra apagada não pode travar o login.';

-- ---------------------------------------------------------------------------
-- Trocar de perfil
-- ---------------------------------------------------------------------------
create or replace function public.trocar_perfil(p_role user_role)
returns user_role language plpgsql security definer set search_path = public as $$
declare
  v_id uuid := auth.uid();
  v_papeis user_role[];
begin
  if v_id is null then
    raise exception 'Não há sessão.';
  end if;

  select papeis into v_papeis from profiles where id = v_id;
  if v_papeis is null then
    raise exception 'Perfil não encontrado.';
  end if;

  if not (p_role = any (v_papeis)) then
    raise exception 'Você não tem o perfil %.', p_role;
  end if;

  update profiles set role = p_role where id = v_id;

  -- O token é atualizado pelo navegador, no passo seguinte. Ver o cabeçalho.
  return p_role;
end;
$$;

comment on function public.trocar_perfil(user_role) is
  'Troca o perfil ativo de quem está logado, se ele estiver em profiles.papeis. É o primeiro de dois passos: a tela chama auth.updateUser em seguida, porque o menu lê o papel do token — ver 0079.';

-- ---------------------------------------------------------------------------
-- Definir a obra padrão
--
-- `security definer` porque o cliente não tem update em `profiles` (só select
-- da própria linha, ver 0005). Daí a checagem de acesso à obra aqui dentro: a
-- obra padrão não pode ser uma obra que a pessoa não alcança.
-- ---------------------------------------------------------------------------
create or replace function public.definir_obra_padrao(p_obra_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_id uuid := auth.uid();
begin
  if v_id is null then
    raise exception 'Não há sessão.';
  end if;

  if p_obra_id is not null
     and not exists (select 1 from obras where id = p_obra_id)
  then
    raise exception 'Obra não encontrada.';
  end if;

  /*
   * Quem pode escolher a obra: engenheiro (vê todas) ou cliente vinculado a
   * ela. A checagem usa os PAPÉIS, não o perfil ativo: ele define a obra
   * padrão do perfil de engenheiro estando no perfil de cliente, e exigir que
   * ele troque antes para poder escolher seria um vai-e-volta sem motivo.
   */
  if p_obra_id is not null
     and not (
       'engenheiro' = any (select papeis from profiles where id = v_id)
       or cliente_tem_acesso_obra(p_obra_id)
     )
  then
    raise exception 'Acesso negado';
  end if;

  update profiles set obra_padrao_id = p_obra_id where id = v_id;
end;
$$;

comment on function public.definir_obra_padrao(uuid) is
  'Define (ou limpa, com null) a obra em que o perfil de engenheiro abre. Confere acesso pelos PAPÉIS, para poder ser chamada dos dois perfis.';

-- ---------------------------------------------------------------------------
-- Ardiles passa a ter os dois perfis
--
-- Ele já é cliente de uma obra (`obra_clientes`) e recebeu papel de engenheiro
-- — por isso estava trancado fora do portal, onde a obra dele vive: o layout
-- do portal exige `role = 'cliente'`.
-- ---------------------------------------------------------------------------
update profiles
   set papeis = array['engenheiro', 'cliente']::user_role[]
 where id in (
   select p.id from profiles p
    where p.role = 'engenheiro'
      and exists (select 1 from obra_clientes oc where oc.cliente_id = p.id)
 );
