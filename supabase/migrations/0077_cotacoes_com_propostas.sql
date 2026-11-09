-- Cotação: várias propostas de preço para a MESMA necessidade, uma é
-- escolhida, e só ela vira ordem de compra.
--
-- POR QUE TABELAS PRÓPRIAS, E NÃO `compras` COM UM `cotacao_id`
--
-- Reaproveitar `compras` era o caminho curto: itens, parcelas, anexos e a tela
-- de detalhe já existem e funcionariam de graça. O preço apareceria em outro
-- lugar. `compras` é a tabela mais lida do sistema — gasto comprometido, rosca
-- de categorias, lançamentos do portal, `vw_compras_lista`,
-- `somar_compras_da_obra`, visão geral — e colocar ali linhas que NÃO são
-- compras faz cada uma dessas leituras depender de um filtro
-- `status <> 'proposta'`. Esquecer um filtro não dá erro: dá número errado na
-- tela do cliente.
--
-- Em tabela própria, uma proposta em análise é estruturalmente incapaz de
-- contar como dinheiro gasto. Era o requisito literal: "valores cotados não
-- devem aparecer nos dashboards".
--
-- POR QUE CADA PROPOSTA TEM SEUS PRÓPRIOS ITENS
--
-- A alternativa era a cotação declarar a lista de insumos e cada proposta só
-- preencher preços — um quadro comparativo item a item. Não é o que acontece
-- na rua: um fornecedor não tem a marca, outro cota o pacote fechado, o
-- terceiro cota 8 dos 10 itens. Forçar a mesma lista nos três registraria uma
-- cotação que não existiu, e custaria uma grade de 30 campos para digitar.
--
-- O espelhamento de `compra_itens` e `compra_parcelas` é deliberado: coluna por
-- coluna, para a conversão em `escolher_proposta` ser um `insert ... select`
-- sem tradução no meio. Acrescentar coluna lá pede a mesma coluna aqui.

create type cotacao_status as enum ('rascunho', 'aguardando_cliente', 'decidida', 'recusada');
create type proposta_status as enum ('em_analise', 'escolhida', 'nao_escolhida');

-- ---------------------------------------------------------------------------
-- 1. A cotação: a necessidade, uma vez
-- ---------------------------------------------------------------------------
create table cotacoes (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references obras(id) on delete cascade,
  descricao text not null,
  -- Mesma coluna-texto de `compras.orcamento_etapa`, validada contra a versão
  -- ativa na hora de gravar. É o que permite a ordem gerada já nascer ligada
  -- à etapa, sem o engenheiro reclassificar depois.
  orcamento_etapa text,
  prazo_decisao date,
  observacoes text,
  status cotacao_status not null default 'rascunho',
  decidida_por uuid references profiles(id),
  decidida_em timestamptz,
  motivo_recusa text,
  criado_por uuid not null references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_cotacoes_obra on cotacoes(obra_id);
-- O aviso "há cotação pendente" é contagem por obra e status: é o único
-- número desta feature que entra em dashboard.
create index idx_cotacoes_pendentes on cotacoes(obra_id) where status = 'aguardando_cliente';

comment on table cotacoes is
  'Uma necessidade de compra com várias propostas de preço. Só a proposta escolhida vira ordem de compra (escolher_proposta). Valores daqui NÃO entram em nenhum total da obra.';

-- ---------------------------------------------------------------------------
-- 2. A proposta: um fornecedor, um preço, suas condições
-- ---------------------------------------------------------------------------
create table cotacao_propostas (
  id uuid primary key default gen_random_uuid(),
  cotacao_id uuid not null references cotacoes(id) on delete cascade,
  fornecedor_id uuid not null references fornecedores(id),
  -- Condições e observações desta proposta. A descrição do QUE se compra é da
  -- cotação — repetida aqui, as três propostas poderiam descrever coisas
  -- diferentes e a comparação perderia o sentido.
  observacoes text,
  valor_total numeric(12,2) not null default 0 check (valor_total >= 0),
  forma_pagamento forma_pagamento not null,
  data_proposta date not null default current_date,
  data_entrega_prevista date,
  desconto_tipo desconto_tipo,
  desconto_valor numeric(14,4) default 0,
  categoria_id uuid references categorias_financeiras(id),
  status proposta_status not null default 'em_analise',
  -- A ordem de compra que esta proposta gerou. Só a escolhida tem.
  compra_id uuid references compras(id) on delete set null,
  criado_por uuid not null references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_cotacao_propostas_cotacao on cotacao_propostas(cotacao_id);

-- Uma cotação decidida tem UMA escolhida. O índice parcial é o que impede
-- duas: `escolher_proposta` roda em transação, mas dois cliques simultâneos
-- em propostas diferentes passariam pela checagem de status antes de qualquer
-- um dos dois gravar.
create unique index idx_cotacao_uma_escolhida on cotacao_propostas(cotacao_id)
  where status = 'escolhida';

comment on table cotacao_propostas is
  'Proposta de preço de um fornecedor para uma cotação. Espelha compras/compra_itens/compra_parcelas de propósito: a escolhida é copiada para lá sem tradução.';

-- ---------------------------------------------------------------------------
-- 3. Itens e parcelas da proposta — espelho de compra_itens / compra_parcelas
-- ---------------------------------------------------------------------------
create table cotacao_proposta_itens (
  id uuid primary key default gen_random_uuid(),
  proposta_id uuid not null references cotacao_propostas(id) on delete cascade,
  orcamento_item_id uuid references orcamento_itens(id),
  insumo_id uuid references insumos(id) on delete set null,
  -- Cópia do catálogo, não referência: mesma razão de `compra_itens` (0067).
  descricao text not null,
  unidade text not null,
  categoria_custo text check (categoria_custo in ('material', 'servico', 'mao_de_obra')),
  quantidade numeric(14,4) not null default 1,
  preco_unitario numeric(14,4) not null default 0,
  desconto_tipo desconto_tipo,
  desconto_valor numeric(14,4) default 0,
  subtotal numeric(14,2) generated always as (quantidade * preco_unitario) stored,
  total_liquido numeric(14,2) generated always as (
    case
      when desconto_tipo = 'percentual' then
        greatest(quantidade * preco_unitario * (1 - coalesce(desconto_valor, 0) / 100), 0)
      when desconto_tipo = 'valor' then
        greatest(quantidade * preco_unitario - coalesce(desconto_valor, 0), 0)
      else quantidade * preco_unitario
    end
  ) stored,
  ordem int not null,
  created_at timestamptz not null default now()
);

create index idx_cotacao_proposta_itens_proposta on cotacao_proposta_itens(proposta_id);

create table cotacao_proposta_parcelas (
  id uuid primary key default gen_random_uuid(),
  proposta_id uuid not null references cotacao_propostas(id) on delete cascade,
  numero_parcela int not null,
  valor numeric(12,2) not null check (valor >= 0),
  data_vencimento date not null,
  created_at timestamptz not null default now(),
  unique (proposta_id, numero_parcela)
);

create index idx_cotacao_proposta_parcelas_proposta on cotacao_proposta_parcelas(proposta_id);

comment on table cotacao_proposta_parcelas is
  'Plano de pagamento proposto pelo fornecedor. Sem data_pagamento nem comprovante: proposta não se paga — quem paga é a ordem gerada.';

-- ---------------------------------------------------------------------------
-- 4. Anexos da proposta — o PDF que o fornecedor mandou
--
-- Tabela separada de `compra_anexos`, e o arquivo NÃO é copiado na conversão:
-- um caminho no Storage com dois donos acabaria apagado pela exclusão de um
-- deles enquanto o outro ainda aponta para ele. A ordem gerada guarda
-- `cotacao_proposta_id` e o documento fica a um clique.
-- ---------------------------------------------------------------------------
create table cotacao_proposta_anexos (
  id uuid primary key default gen_random_uuid(),
  proposta_id uuid not null references cotacao_propostas(id) on delete cascade,
  bucket text not null check (bucket in ('cotacoes')),
  path text not null,
  nome text not null,
  criado_por uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (bucket, path)
);

create index idx_cotacao_proposta_anexos_proposta on cotacao_proposta_anexos(proposta_id);

-- Mesmo teto de 3 das compras, e pela mesma razão: a regra é do dado, não do
-- formulário.
create or replace function public.trg_limitar_anexos_proposta()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from cotacao_proposta_anexos where proposta_id = new.proposta_id) > 3 then
    raise exception 'Máximo de 3 arquivos anexados por proposta.';
  end if;
  return null;
end;
$$;

create trigger trg_limite_anexos_proposta
  after insert on cotacao_proposta_anexos
  for each row execute function public.trg_limitar_anexos_proposta();

-- ---------------------------------------------------------------------------
-- 5. A ordem de compra aponta de volta para a proposta que a originou
-- ---------------------------------------------------------------------------
alter table compras add column cotacao_proposta_id uuid references cotacao_propostas(id) on delete set null;

comment on column compras.cotacao_proposta_id is
  'Proposta de cotação que gerou esta ordem. Null na ordem criada direto. É por aqui que a ordem alcança o anexo do fornecedor, que continua morando na proposta.';

-- ---------------------------------------------------------------------------
-- 6. valor_total da proposta é derivado, igual ao da compra
-- ---------------------------------------------------------------------------
create or replace function public.recalcular_valor_proposta(p_proposta_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_subtotal numeric(14,2);
  v_desconto_tipo desconto_tipo;
  v_desconto_valor numeric(14,4);
begin
  select coalesce(sum(total_liquido), 0) into v_subtotal
  from cotacao_proposta_itens where proposta_id = p_proposta_id;

  select desconto_tipo, desconto_valor into v_desconto_tipo, v_desconto_valor
  from cotacao_propostas where id = p_proposta_id;

  update cotacao_propostas set
    valor_total = case
      when v_desconto_tipo = 'percentual' then greatest(v_subtotal * (1 - coalesce(v_desconto_valor, 0) / 100), 0)
      when v_desconto_tipo = 'valor' then greatest(v_subtotal - coalesce(v_desconto_valor, 0), 0)
      else v_subtotal
    end,
    updated_at = now()
  where id = p_proposta_id;
end;
$$;

create or replace function public.trg_recalcular_valor_proposta_itens()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if TG_OP = 'DELETE' then
    perform recalcular_valor_proposta(old.proposta_id);
  else
    perform recalcular_valor_proposta(new.proposta_id);
    if TG_OP = 'UPDATE' and old.proposta_id is distinct from new.proposta_id then
      perform recalcular_valor_proposta(old.proposta_id);
    end if;
  end if;
  return null;
end;
$$;

create trigger trg_cotacao_proposta_itens_recalcula
  after insert or update or delete on cotacao_proposta_itens
  for each row execute function trg_recalcular_valor_proposta_itens();

create or replace function public.trg_recalcular_valor_proposta_desconto()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform recalcular_valor_proposta(new.id);
  return null;
end;
$$;

create trigger trg_cotacao_propostas_desconto_recalcula
  after update of desconto_tipo, desconto_valor on cotacao_propostas
  for each row execute function trg_recalcular_valor_proposta_desconto();

-- ---------------------------------------------------------------------------
-- 7. RLS
--
-- O engenheiro faz tudo. O cliente LÊ, e só a partir do momento em que a
-- cotação foi enviada a ele: enquanto é rascunho o engenheiro ainda está
-- montando as propostas, e meia comparação é pior que nenhuma. Decidir e
-- recusar não passam por policy — passam pelas funções da seção 9, que é onde
-- a regra de quem pode decidir fica num lugar só.
-- ---------------------------------------------------------------------------
alter table cotacoes enable row level security;
alter table cotacao_propostas enable row level security;
alter table cotacao_proposta_itens enable row level security;
alter table cotacao_proposta_parcelas enable row level security;
alter table cotacao_proposta_anexos enable row level security;

create policy eng_all_cotacoes on cotacoes
  for all using ((select is_engenheiro())) with check ((select is_engenheiro()));

create policy cli_select_cotacoes on cotacoes for select using (
  status <> 'rascunho' and cliente_tem_acesso_obra(obra_id)
);

create policy eng_all_cotacao_propostas on cotacao_propostas
  for all using ((select is_engenheiro())) with check ((select is_engenheiro()));

create policy cli_select_cotacao_propostas on cotacao_propostas for select using (
  exists (
    select 1 from cotacoes c
    where c.id = cotacao_propostas.cotacao_id
      and c.status <> 'rascunho'
      and cliente_tem_acesso_obra(c.obra_id)
  )
);

create policy eng_all_cotacao_proposta_itens on cotacao_proposta_itens
  for all using ((select is_engenheiro())) with check ((select is_engenheiro()));

create policy cli_select_cotacao_proposta_itens on cotacao_proposta_itens for select using (
  exists (
    select 1 from cotacao_propostas p
    join cotacoes c on c.id = p.cotacao_id
    where p.id = cotacao_proposta_itens.proposta_id
      and c.status <> 'rascunho'
      and cliente_tem_acesso_obra(c.obra_id)
  )
);

create policy eng_all_cotacao_proposta_parcelas on cotacao_proposta_parcelas
  for all using ((select is_engenheiro())) with check ((select is_engenheiro()));

create policy cli_select_cotacao_proposta_parcelas on cotacao_proposta_parcelas for select using (
  exists (
    select 1 from cotacao_propostas p
    join cotacoes c on c.id = p.cotacao_id
    where p.id = cotacao_proposta_parcelas.proposta_id
      and c.status <> 'rascunho'
      and cliente_tem_acesso_obra(c.obra_id)
  )
);

create policy eng_all_cotacao_proposta_anexos on cotacao_proposta_anexos
  for all using ((select is_engenheiro())) with check ((select is_engenheiro()));

create policy cli_select_cotacao_proposta_anexos on cotacao_proposta_anexos for select using (
  exists (
    select 1 from cotacao_propostas p
    join cotacoes c on c.id = p.cotacao_id
    where p.id = cotacao_proposta_anexos.proposta_id
      and c.status <> 'rascunho'
      and cliente_tem_acesso_obra(c.obra_id)
  )
);

-- ---------------------------------------------------------------------------
-- 8. A lista
--
-- `c.*` congela as colunas no momento da criação — o aviso que já custou caro
-- quatro vezes neste projeto (0018, 0025, 0046, 0060). Acrescentar coluna em
-- `cotacoes` exige derrubar e recriar esta view.
-- ---------------------------------------------------------------------------
create view vw_cotacoes_lista with (security_invoker = true) as
select
  c.*,
  coalesce(p.propostas, 0)::int as propostas,
  p.menor_valor,
  p.maior_valor,
  e.fornecedor_nome as fornecedor_escolhido,
  e.valor_total as valor_escolhido,
  e.compra_id
from cotacoes c
left join (
  select cotacao_id, count(*) as propostas, min(valor_total) as menor_valor, max(valor_total) as maior_valor
  from cotacao_propostas
  group by cotacao_id
) p on p.cotacao_id = c.id
left join (
  select pr.cotacao_id, pr.valor_total, pr.compra_id, f.nome as fornecedor_nome
  from cotacao_propostas pr
  left join fornecedores f on f.id = pr.fornecedor_id
  where pr.status = 'escolhida'
) e on e.cotacao_id = c.id;

comment on view vw_cotacoes_lista is
  'Cotações com a contagem de propostas e a faixa de valores, para a tela de cotações. NÃO deve alimentar dashboard: valor de proposta não é gasto da obra.';

-- ---------------------------------------------------------------------------
-- 9. Decidir
--
-- `escolher_proposta` faz quatro inserções e três atualizações. Como Server
-- Action seriam sete idas ao banco sem transação em volta: uma falha no meio
-- deixaria a cotação decidida sem ordem de compra, ou a ordem criada com as
-- propostas ainda todas em análise. Aqui é tudo ou nada.
--
-- `security definer` porque a função escreve em `compras`, `compra_itens` e
-- `compra_parcelas` — tabelas em que o cliente não tem insert, e nem deve ter.
-- Daí a checagem de acesso explícita: sem ela, a função seria a porta aberta
-- que as policies fecham.
-- ---------------------------------------------------------------------------
create or replace function public.escolher_proposta(p_proposta_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_proposta cotacao_propostas;
  v_cotacao cotacoes;
  v_compra_id uuid;
begin
  select * into v_proposta from cotacao_propostas where id = p_proposta_id;
  if v_proposta.id is null then
    raise exception 'Proposta não encontrada.';
  end if;

  select * into v_cotacao from cotacoes where id = v_proposta.cotacao_id;

  if v_cotacao.status not in ('rascunho', 'aguardando_cliente') then
    raise exception 'Esta cotação já foi decidida.';
  end if;

  -- O engenheiro decide a qualquer momento, inclusive em rascunho: há compra
  -- que não precisa passar pelo cliente. O cliente decide só o que lhe foi
  -- enviado.
  if not (
    (select is_engenheiro())
    or (v_cotacao.status = 'aguardando_cliente' and cliente_tem_acesso_obra(v_cotacao.obra_id))
  ) then
    raise exception 'Acesso negado';
  end if;

  if not exists (select 1 from cotacao_proposta_itens where proposta_id = p_proposta_id) then
    raise exception 'Esta proposta não tem itens: não há o que virar ordem de compra.';
  end if;

  -- valor_total entra 0 e o gatilho dos itens o recalcula, igual ao caminho
  -- normal de criação da ordem. Nasce 'aprovada' porque escolher JÁ É aprovar:
  -- quem escolheu está em `aprovado_por`.
  insert into compras (
    obra_id, fornecedor_id, descricao, valor_total, forma_pagamento, status,
    data_cotacao, aprovado_por, aprovado_em, criado_por,
    desconto_tipo, desconto_valor, orcamento_etapa, categoria_id,
    data_entrega_prevista, requer_aprovacao_cliente, cotacao_proposta_id
  )
  values (
    v_cotacao.obra_id, v_proposta.fornecedor_id, v_cotacao.descricao, 0,
    v_proposta.forma_pagamento, 'aprovada',
    v_proposta.data_proposta, auth.uid(), now(), v_cotacao.criado_por,
    v_proposta.desconto_tipo, v_proposta.desconto_valor, v_cotacao.orcamento_etapa,
    v_proposta.categoria_id, v_proposta.data_entrega_prevista, false, p_proposta_id
  )
  returning id into v_compra_id;

  insert into compra_itens (
    compra_id, orcamento_item_id, insumo_id, descricao, unidade, categoria_custo,
    quantidade, preco_unitario, desconto_tipo, desconto_valor, ordem
  )
  select
    v_compra_id, orcamento_item_id, insumo_id, descricao, unidade, categoria_custo,
    quantidade, preco_unitario, desconto_tipo, desconto_valor, ordem
  from cotacao_proposta_itens
  where proposta_id = p_proposta_id;

  insert into compra_parcelas (compra_id, numero_parcela, valor, data_vencimento)
  select v_compra_id, numero_parcela, valor, data_vencimento
  from cotacao_proposta_parcelas
  where proposta_id = p_proposta_id;

  -- As recusadas NÃO são apagadas: são o registro de que houve concorrência, e
  -- é justamente o que se quer poder mostrar depois.
  update cotacao_propostas
    set status = 'nao_escolhida', updated_at = now()
    where cotacao_id = v_cotacao.id and id <> p_proposta_id;

  update cotacao_propostas
    set status = 'escolhida', compra_id = v_compra_id, updated_at = now()
    where id = p_proposta_id;

  update cotacoes
    set status = 'decidida', decidida_por = auth.uid(), decidida_em = now(), updated_at = now()
    where id = v_cotacao.id;

  return v_compra_id;
end;
$$;

comment on function public.escolher_proposta(uuid) is
  'Transforma a proposta escolhida em ordem de compra aprovada e marca as demais como não escolhidas. Atômica de propósito: sete escritas que não podem acontecer pela metade.';

create or replace function public.recusar_cotacao(p_cotacao_id uuid, p_motivo text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_cotacao cotacoes;
begin
  select * into v_cotacao from cotacoes where id = p_cotacao_id;
  if v_cotacao.id is null then
    raise exception 'Cotação não encontrada.';
  end if;

  if v_cotacao.status not in ('rascunho', 'aguardando_cliente') then
    raise exception 'Esta cotação já foi decidida.';
  end if;

  if not (
    (select is_engenheiro())
    or (v_cotacao.status = 'aguardando_cliente' and cliente_tem_acesso_obra(v_cotacao.obra_id))
  ) then
    raise exception 'Acesso negado';
  end if;

  if coalesce(btrim(p_motivo), '') = '' then
    raise exception 'Informe o motivo da recusa.';
  end if;

  update cotacoes set
    status = 'recusada',
    motivo_recusa = btrim(p_motivo),
    decidida_por = auth.uid(),
    decidida_em = now(),
    updated_at = now()
  where id = p_cotacao_id;

  update cotacao_propostas
    set status = 'nao_escolhida', updated_at = now()
    where cotacao_id = p_cotacao_id;
end;
$$;

comment on function public.recusar_cotacao(uuid, text) is
  'Recusa todas as propostas de uma cotação, com motivo. Nada é apagado: a cotação recusada continua consultável.';
