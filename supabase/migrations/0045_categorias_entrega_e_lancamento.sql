-- Três mudanças no registro financeiro da obra, numa migração só porque a
-- view `vw_compra_parcelas` precisa ser recriada uma vez e serve às três.

-- ---------------------------------------------------------------------------
-- 1. Categoria financeira
--
-- O cadastro responde "que tipo de pagamento é este": IPTU, Água, Projetos,
-- Mão de obra. É lista do usuário, não enum — cada obra tem uma despesa que
-- ninguém previu, e trocar de enum a cada uma custaria migração.
--
-- `tipo_item` na categoria, e não na ordem: eram duas perguntas para a mesma
-- coisa ("Tipo: Material" + "Categoria: Materiais aplicados à obra"). Agora o
-- engenheiro responde uma, e o sistema deduz a outra — a coluna
-- `compras.tipo_item` continua existindo e alimentando a tabela do cliente e o
-- comparativo orçado × comprado, só que preenchida a partir daqui.
-- ---------------------------------------------------------------------------
create table if not exists categorias_financeiras (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  tipo_item text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  constraint categorias_tipo_item_check
    check (tipo_item is null or tipo_item in ('material', 'servico', 'mao_de_obra'))
);

alter table categorias_financeiras enable row level security;

create policy eng_all_categorias on categorias_financeiras for all
  using (is_engenheiro()) with check (is_engenheiro());

-- O cliente lê para poder escolher ao lançar um pagamento dele, e para a
-- listagem mostrar o nome em vez do id.
create policy cli_select_categorias on categorias_financeiras for select
  using (true);

insert into categorias_financeiras (nome, tipo_item) values
  ('Materiais aplicados à obra', 'material'),
  ('Serviços aplicados à obra',  'servico'),
  ('Mão de obra',                'mao_de_obra'),
  ('Projetos',                   'servico'),
  ('IPTU',                       null),
  ('Água',                       null),
  ('Energia elétrica',           null),
  ('Taxas e licenças',           null),
  ('Equipamentos e locações',    null)
on conflict (nome) do nothing;

alter table compras
  add column if not exists categoria_id uuid references categorias_financeiras(id);

create index if not exists idx_compras_categoria on compras(categoria_id);

-- ---------------------------------------------------------------------------
-- 2. Entrega passa da parcela para a ORDEM
--
-- A entrega era campo de cada parcela, e o formulário pedia a data em todas —
-- três parcelas da mesma compra de cimento perguntavam três vezes quando o
-- cimento chega. A mercadoria chega uma vez.
--
-- Consequência direta: com "pagar só após o recebimento", NENHUMA parcela é
-- liberada enquanto o engenheiro não confirmar o recebimento da ordem. Antes a
-- liberação era parcela a parcela, e bastava confirmar a primeira para a
-- segunda continuar travada sem motivo visível.
-- ---------------------------------------------------------------------------
alter table compras
  add column if not exists data_entrega_prevista date,
  add column if not exists data_entrega_real date,
  add column if not exists recebimento_confirmado_por uuid references profiles(id),
  add column if not exists recebimento_confirmado_em timestamptz;

-- A ordem herda a entrega das parcelas: a previsão mais próxima e, para o
-- recebimento, a confirmação mais recente que houver.
update compras c set
  data_entrega_prevista = sub.prevista,
  data_entrega_real = sub.real
from (
  select compra_id,
         min(data_entrega_prevista) as prevista,
         max(data_entrega_real) as real
  from compra_parcelas
  group by compra_id
) sub
where sub.compra_id = c.id
  and c.data_entrega_prevista is null
  and c.data_entrega_real is null;

-- ---------------------------------------------------------------------------
-- 3. Lançamento financeiro
--
-- Mesma tabela da ordem de compra, com uma marca. É despesa já paga, sem
-- cotação, sem aprovação, sem entrega e sem parcelamento — e o cliente também
-- pode registrar, o que a ordem de compra não permite.
--
-- Tabela separada seria o caminho fácil e erraria no lugar caro: listagem,
-- totais, rosca de categorias e comparativo com o orçamento teriam de somar
-- duas origens, e a primeira tela que esquecesse uma delas mostraria um total
-- menor do que a obra gastou.
-- ---------------------------------------------------------------------------
alter table compras
  add column if not exists eh_lancamento boolean not null default false;

create index if not exists idx_compras_eh_lancamento on compras(obra_id, eh_lancamento);

-- O cliente registra lançamento só na obra dele, e só lançamento: a cláusula
-- `eh_lancamento` é o que o impede de criar ordem de compra por este caminho.
create policy cli_insert_lancamento on compras for insert
  with check (eh_lancamento and cliente_tem_acesso_obra(obra_id));

create policy cli_insert_parcela_lancamento on compra_parcelas for insert
  with check (
    exists (
      select 1 from compras c
      where c.id = compra_parcelas.compra_id
        and c.eh_lancamento
        and cliente_tem_acesso_obra(c.obra_id)
    )
  );

-- ---------------------------------------------------------------------------
-- A view, recriada uma vez para as três mudanças
--
-- AVISO que já custou caro três vezes (ver 0018, 0025 e 0032): a view é
-- `select cp.*`, e o Postgres expande isso na CRIAÇÃO. Coluna nova em
-- `compra_parcelas` não aparece sozinha — chega `undefined` em runtime, sem o
-- TypeScript reclamar.
-- ---------------------------------------------------------------------------
drop view vw_compra_parcelas;

create view vw_compra_parcelas with (security_invoker = true) as
select
  cp.*,
  c.pagamento_apos_recebimento,
  -- A entrega agora é da ordem: ou a compra não depende de recebimento, ou a
  -- ordem inteira já foi confirmada como recebida.
  (not c.pagamento_apos_recebimento or c.data_entrega_real is not null)
    as liberada_para_pagamento,
  c.data_entrega_prevista as entrega_prevista_ordem,
  c.data_entrega_real as entrega_real_ordem,
  case
    when cp.status = 'paga' then 'paga'::parcela_status
    -- Aguardando mercadoria não vence: a data passar é problema do fornecedor.
    when c.pagamento_apos_recebimento and c.data_entrega_real is null
      then 'pendente'::parcela_status
    when cp.status = 'pendente' and cp.data_vencimento < current_date
      then 'vencida'::parcela_status
    else cp.status
  end as status_efetivo
from compra_parcelas cp
join compras c on c.id = cp.compra_id;

grant select on vw_compra_parcelas to authenticated;
