-- ---------------------------------------------------------------------------
-- Permissões por usuário
--
-- O PROBLEMA: hoje "engenheiro" é o teto do sistema. Ardiles e Thiago podem
-- exatamente o mesmo, e isso inclui excluir uma obra inteira em cascata,
-- aprovar ordem de compra e convidar quem acessa o sistema. Entra um terceiro
-- engenheiro hoje, e ele nasceria com esses mesmos poderes.
--
-- O QUE NÃO FOI FEITO, e por quê: não existe papel 'admin' no enum user_role.
-- 44 das 79 políticas de RLS dizem `is_engenheiro()`, que é `role =
-- 'engenheiro'`. Trocar o role de alguém para 'admin' faria essas 44 políticas
-- pararem de valer para ele — e RLS não dá erro, devolve ZERO LINHAS. A pessoa
-- veria o sistema inteiro vazio, sem mensagem nenhuma.
--
-- Além disso, admin não é um perfil. Os dois perfis do Ardiles são dois
-- TRABALHOS (cliente da construtora e engenheiro), com telas e menus
-- diferentes, e o seletor do menu oferece troca entre eles. Permissão não é
-- uma cadeira onde se senta, é uma chave que se carrega: ninguém quer "entrar
-- no modo administrador" para aprovar uma compra e sair depois.
--
-- O DESENHO: duas coisas ortogonais ao papel.
--   `profiles.administrador`  -> quem pode DECIDIR quem pode o quê
--   `permissoes_usuario`      -> o que cada um pode, por ação
--
-- `administrador` fica fora do catálogo de permissões de propósito. Se ela
-- fosse uma permissão como as outras, seria circular: quem não a tem não pode
-- se dar, e quem a tem pode tirar de todos.
-- ---------------------------------------------------------------------------

alter table profiles
  add column if not exists administrador boolean not null default false;

comment on column profiles.administrador is
  'Pode conceder e revogar permissões dos outros. Ortogonal a role: responde "decide quem pode", não "qual cadeira ocupa". Ver 0082.';

-- ---------------------------------------------------------------------------
-- O catálogo: as permissões que EXISTEM.
--
-- É tabela, e não enum nem check, porque a tela de gerenciamento a lê para
-- montar a lista — e acrescentar uma permissão passa a ser um insert, não uma
-- migração de tipo.
--
-- O catálogo cobre DECISÕES E DESTRUIÇÕES, não trabalho rotineiro. São 121
-- ações de servidor no sistema; gatear as 121 daria uma tela ilegível e
-- atrapalharia quem só quer lançar uma tarefa no cronograma. O que entra aqui
-- é o que é irreversível, move dinheiro, ou decide quem entra no sistema.
-- ---------------------------------------------------------------------------
create table if not exists permissoes_catalogo (
  acao       text primary key,
  grupo      text not null,
  rotulo     text not null,
  descricao  text not null,
  ordem      integer not null
);

comment on table permissoes_catalogo is
  'As permissões que existem no sistema. Lido pela tela de gerenciamento. Ver 0082.';

insert into permissoes_catalogo (acao, grupo, rotulo, descricao, ordem) values
  ('obra.criar',        'Obras',     'Criar obra',
   'Cadastrar uma obra nova no sistema.', 10),
  ('obra.excluir',      'Obras',     'Excluir obra',
   'Apaga a obra e TUDO que pende dela: cronograma, orçamento, compras, RDOs e arquivos. Não tem desfazer.', 20),
  ('orcamento.ativar',  'Orçamento', 'Tornar um orçamento oficial',
   'Promove uma versão de rascunho a orçamento vigente da obra — é o número que o cliente passa a ver.', 30),
  ('cotacao.decidir',   'Cotações',  'Escolher ou recusar proposta',
   'Decide qual proposta da cotação vence, ou recusa a cotação inteira.', 40),
  ('cotacao.excluir',   'Cotações',  'Excluir cotação ou proposta',
   'Apaga a cotação ou uma proposta dela, com os anexos.', 50),
  ('compra.aprovar',    'Compras',   'Aprovar ou recusar ordem de compra',
   'Libera ou barra a ordem de compra.', 60),
  ('compra.pagar',      'Compras',   'Registrar pagamento de compra',
   'Marca parcela ou compra como paga. É registro de dinheiro que saiu.', 70),
  ('compra.excluir',    'Compras',   'Excluir ordem de compra',
   'Apaga a ordem de compra e seus anexos.', 80),
  ('fechamento.pagar',  'RH',        'Marcar fechamento como pago',
   'Fecha o pagamento de colaborador, equipe diária ou entrega.', 90),
  ('diario.reabrir',    'Diário',    'Reabrir dia já fechado',
   'Destrava um RDO fechado para edição. O RDO é o registro oficial do dia, assinado pelo responsável técnico.', 100),
  ('diario.excluir',    'Diário',    'Excluir RDO',
   'Apaga o diário do dia, com as fotos e as presenças confirmadas nele.', 110),
  ('cliente.gerenciar', 'Acessos',   'Convidar e vincular clientes',
   'Cria acesso de cliente e decide quais obras cada um vê.', 120),
  ('sinapi.publicar',   'Cadastros', 'Publicar nova tabela SINAPI',
   'Troca a tabela de preços de referência sobre a qual todos os orçamentos se apoiam.', 130)
on conflict (acao) do nothing;

-- ---------------------------------------------------------------------------
-- As concessões. Linha presente = pode. Ausente = não pode.
--
-- Negar por omissão, e não uma coluna booleana, porque quem entra no sistema
-- deve nascer SEM poder de decisão — era exatamente o risco do engenheiro que
-- entra hoje.
-- ---------------------------------------------------------------------------
create table if not exists permissoes_usuario (
  usuario_id    uuid not null references profiles(id) on delete cascade,
  acao          text not null references permissoes_catalogo(acao) on delete cascade,
  concedida_em  timestamptz not null default now(),
  concedida_por uuid references profiles(id) on delete set null,
  primary key (usuario_id, acao)
);

comment on table permissoes_usuario is
  'Quem pode o quê. Presença da linha concede; ausência nega. Escrita só pela RPC definir_permissao. Ver 0082.';

create index if not exists idx_permissoes_usuario_usuario on permissoes_usuario (usuario_id);

-- ---------------------------------------------------------------------------
-- Os dois portões
-- ---------------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles
    where id = (select auth.uid()) and administrador
  );
$$;

/*
 * `pode(acao)` é o portão único. Lê o banco AO VIVO, de propósito.
 *
 * O `requireRole` lê o papel do TOKEN, porque roda em toda navegação e uma ida
 * ao banco por tela custaria caro — e o comentário dele diz, com razão, que
 * aquilo é roteamento e não autorização. Aqui é o contrário: `pode` roda em
 * clique raro (aprovar uma compra, excluir uma obra), então pagar uma ida ao
 * banco é irrelevante e a leitura ao vivo é o que importa.
 *
 * Isso fecha um furo real: `auth.updateUser` NÃO emite token novo na hora
 * (aprendido na 0079 do jeito difícil). Se este portão lesse o token, alguém
 * que perdesse uma permissão continuaria com ela até o token expirar, cerca de
 * uma hora. Lendo o banco, a revogação vale no clique seguinte.
 *
 * `role = 'engenheiro'` na cláusula não é redundante: impede que uma permissão
 * concedida por engano a um cliente o deixe aprovar compra, o que furaria todo
 * o modelo de RLS do portal. Tem efeito bom de lado: quando o Ardiles troca
 * para o perfil de cliente, ele deixa de poder decidir — o que está certo, ele
 * está fazendo outro trabalho naquele momento.
 *
 * `administrador` passa em tudo sem precisar de linha. Mantém o catálogo
 * limpo e torna impossível um admin se trancar para fora por descuido.
 *
 * `(select auth.uid())` e não `auth.uid()`: faz o Postgres avaliar uma vez por
 * consulta (InitPlan) em vez de por linha. Mesma razão da 0059.
 */
create or replace function public.pode(p_acao text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles p
    where p.id = (select auth.uid())
      and p.role = 'engenheiro'
      and (
        p.administrador
        or exists (
          select 1 from permissoes_usuario pu
          where pu.usuario_id = p.id and pu.acao = p_acao
        )
      )
  );
$$;

comment on function public.pode(text) is
  'Portão único de permissão. Lê o banco ao vivo (não o token), então revogação vale imediatamente. Admin passa em tudo. Cliente nunca passa. Ver 0082.';

-- ---------------------------------------------------------------------------
-- RLS das tabelas novas
-- ---------------------------------------------------------------------------
alter table permissoes_catalogo enable row level security;
alter table permissoes_usuario  enable row level security;

-- O catálogo é a lista do que existe; não há nada sigiloso nele e a tela
-- precisa lê-lo. Escrita não tem policy: só migração mexe.
drop policy if exists permissoes_catalogo_leitura on permissoes_catalogo;
create policy permissoes_catalogo_leitura on permissoes_catalogo
  for select to authenticated using (true);

-- Cada um vê as suas; admin vê de todos. Sem policy de escrita de propósito:
-- gravar passa obrigatoriamente pelas RPCs abaixo, que têm as travas.
drop policy if exists permissoes_usuario_leitura on permissoes_usuario;
create policy permissoes_usuario_leitura on permissoes_usuario
  for select to authenticated
  using (usuario_id = (select auth.uid()) or (select is_admin()));

-- ---------------------------------------------------------------------------
-- Conceder e revogar
-- ---------------------------------------------------------------------------
create or replace function public.definir_permissao(
  p_usuario uuid,
  p_acao text,
  p_conceder boolean
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_eu uuid := auth.uid();
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
   * Alvo precisa ter 'engenheiro' em papeis. Conceder "aprovar compra" a quem
   * só é cliente não teria efeito (a `pode` exige role de engenheiro), e
   * deixaria na tela uma marcação que mente sobre o que a pessoa pode.
   *
   * `exists` com `= any(papeis)`, não `= any (subquery)`: a segunda forma
   * compara com o conjunto de linhas e estoura com "malformed array literal"
   * — foi o bug corrigido na 0080.
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
end;
$$;

create or replace function public.definir_administrador(
  p_usuario uuid,
  p_admin boolean
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_eu uuid := auth.uid();
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

  update profiles set administrador = p_admin where id = p_usuario;
end;
$$;

-- ---------------------------------------------------------------------------
-- Estado inicial
--
-- Thiago e Fátima administram. Ardiles preserva tudo que já podia: no dia da
-- virada nada muda para ele, e a retirada passa a ser decisão consciente na
-- tela, não efeito colateral do deploy.
--
-- Identificados por e-mail, não por UUID, para a migração ser legível e não
-- depender de id copiado à mão.
-- ---------------------------------------------------------------------------
update profiles set administrador = true
where email in ('thiagovidal09@icloud.com', 'fatimapinheir@gmail.com');

/*
 * Fátima é `role = 'cliente'` — a conta serve para ver o portal pelo lado do
 * cliente. Para administrar permissões ela precisa alcançar a tela, que vive
 * em `app/(engenheiro)`, então ganha os dois papéis como o Ardiles. O `role`
 * continua 'cliente': ela troca no menu quando for administrar, e o portal
 * continua sendo o que ela vê por padrão.
 */
update profiles
set papeis = array['cliente', 'engenheiro']::user_role[]
where email = 'fatimapinheir@gmail.com'
  and not ('engenheiro' = any (papeis));

insert into permissoes_usuario (usuario_id, acao)
select p.id, c.acao
from profiles p cross join permissoes_catalogo c
where p.email = 'ardilesvidal@hotmail.com'
on conflict (usuario_id, acao) do nothing;
