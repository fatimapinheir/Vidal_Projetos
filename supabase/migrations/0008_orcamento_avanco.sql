-- Fase 2: orçamento (SINAPI/Caixa) versionado por mês + avanço físico da obra

create type orcamento_versao_status as enum ('ativa', 'substituida');

-- Mapeamento de colunas da planilha salvo por obra, reaproveitado nos uploads seguintes
create table orcamento_mapeamentos (
  obra_id uuid primary key references obras(id) on delete cascade,
  linha_cabecalho int not null,
  mapa_colunas jsonb not null,
  updated_at timestamptz not null default now()
);

create table orcamento_versoes (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references obras(id) on delete cascade,
  mes_referencia date not null,
  arquivo_original_path text not null,
  status orcamento_versao_status not null default 'ativa',
  observacoes text,
  criado_por uuid not null references profiles(id),
  created_at timestamptz not null default now(),
  unique (obra_id, mes_referencia)
);

-- Garante só uma versão "ativa" por obra
create unique index uniq_orcamento_ativa on orcamento_versoes(obra_id) where status = 'ativa';

create table orcamento_itens (
  id uuid primary key default gen_random_uuid(),
  orcamento_versao_id uuid not null references orcamento_versoes(id) on delete cascade,
  ordem int not null,
  codigo_sinapi text,
  descricao text not null,
  unidade text not null,
  quantidade numeric(14,4) not null default 0,
  preco_unitario numeric(14,4) not null default 0,
  preco_total numeric(14,2) generated always as (quantidade * preco_unitario) stored,
  etapa text,
  created_at timestamptz not null default now()
);
create index idx_orcamento_itens_versao on orcamento_itens(orcamento_versao_id);

create table avanco_registros (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references obras(id) on delete cascade,
  orcamento_item_id uuid not null references orcamento_itens(id) on delete cascade,
  data_medicao date not null default current_date,
  quantidade_executada_acumulada numeric(14,4) not null,
  observacoes text,
  registrado_por uuid not null references profiles(id),
  created_at timestamptz not null default now()
);
create index idx_avanco_item_data on avanco_registros(orcamento_item_id, data_medicao desc);

-- Última medição de cada item (quantidade acumulada, não incremento)
create view vw_avanco_atual with (security_invoker = true) as
select distinct on (a.orcamento_item_id)
  a.orcamento_item_id, a.obra_id, a.data_medicao, a.quantidade_executada_acumulada
from avanco_registros a
order by a.orcamento_item_id, a.data_medicao desc, a.created_at desc;

-- % físico da obra (versão ativa), ponderado pelo valor financeiro de cada item
create view vw_progresso_obra with (security_invoker = true) as
select
  ov.obra_id,
  ov.id as orcamento_versao_id,
  sum(oi.preco_total) as valor_orcado_total,
  sum(least(coalesce(va.quantidade_executada_acumulada, 0) / nullif(oi.quantidade, 0), 1) * oi.preco_total)
    as valor_executado_ponderado,
  case when sum(oi.preco_total) > 0 then
    sum(least(coalesce(va.quantidade_executada_acumulada, 0) / nullif(oi.quantidade, 0), 1) * oi.preco_total)
      / sum(oi.preco_total) * 100
  else 0 end as percentual_fisico
from orcamento_versoes ov
join orcamento_itens oi on oi.orcamento_versao_id = ov.id
left join vw_avanco_atual va on va.orcamento_item_id = oi.id
where ov.status = 'ativa'
group by ov.obra_id, ov.id;

grant select on vw_avanco_atual, vw_progresso_obra to authenticated;

-- RLS
alter table orcamento_mapeamentos enable row level security;
create policy eng_all_orcamento_mapeamentos on orcamento_mapeamentos for all
  using (is_engenheiro()) with check (is_engenheiro());

alter table orcamento_versoes enable row level security;
create policy eng_all_orcamento_versoes on orcamento_versoes for all
  using (is_engenheiro()) with check (is_engenheiro());
create policy cli_select_orcamento_versoes on orcamento_versoes for select
  using (cliente_tem_acesso_obra(obra_id) and status = 'ativa');

alter table orcamento_itens enable row level security;
create policy eng_all_orcamento_itens on orcamento_itens for all
  using (is_engenheiro()) with check (is_engenheiro());
create policy cli_select_orcamento_itens on orcamento_itens for select using (
  exists (
    select 1 from orcamento_versoes v
    where v.id = orcamento_versao_id and v.status = 'ativa' and cliente_tem_acesso_obra(v.obra_id)
  )
);

alter table avanco_registros enable row level security;
create policy eng_all_avanco on avanco_registros for all
  using (is_engenheiro()) with check (is_engenheiro());
create policy cli_select_avanco on avanco_registros for select
  using (cliente_tem_acesso_obra(obra_id));

-- Storage: planilha original, só o engenheiro acessa
insert into storage.buckets (id, name, public) values ('orcamentos', 'orcamentos', false)
on conflict (id) do nothing;

create policy eng_full_storage_orcamentos on storage.objects for all
  using (bucket_id = 'orcamentos' and is_engenheiro())
  with check (bucket_id = 'orcamentos' and is_engenheiro());
