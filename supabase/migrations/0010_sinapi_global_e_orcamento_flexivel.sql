-- Separa a base de preços SINAPI (catálogo global, igual para todas as obras)
-- do orçamento de cada obra (que passa a ser montado item a item, em rascunho,
-- até o engenheiro ativar).

-- === Catálogo SINAPI (global) ===

create table sinapi_tabelas (
  id uuid primary key default gen_random_uuid(),
  mes_referencia date not null unique,
  arquivo_original_path text not null,
  status orcamento_versao_status not null default 'ativa',
  criado_por uuid not null references profiles(id),
  created_at timestamptz not null default now()
);

-- só uma tabela SINAPI "ativa" no sistema inteiro
create unique index uniq_sinapi_ativa on sinapi_tabelas ((1)) where status = 'ativa';

create table sinapi_itens (
  id uuid primary key default gen_random_uuid(),
  sinapi_tabela_id uuid not null references sinapi_tabelas(id) on delete cascade,
  codigo text not null,
  descricao text not null,
  unidade text not null,
  preco_unitario numeric(14,4) not null default 0,
  created_at timestamptz not null default now()
);
create index idx_sinapi_itens_tabela on sinapi_itens(sinapi_tabela_id);
create index idx_sinapi_itens_codigo on sinapi_itens(codigo);
create index idx_sinapi_itens_busca on sinapi_itens using gin (to_tsvector('portuguese', descricao));

-- mapeamento de colunas é global (o layout da planilha SINAPI é o mesmo todo mês) — só 1 linha
create table sinapi_mapeamento (
  id boolean primary key default true check (id),
  linha_cabecalho int not null,
  mapa_colunas jsonb not null,
  updated_at timestamptz not null default now()
);

alter table sinapi_tabelas enable row level security;
create policy eng_all_sinapi_tabelas on sinapi_tabelas for all
  using (is_engenheiro()) with check (is_engenheiro());

alter table sinapi_itens enable row level security;
create policy eng_all_sinapi_itens on sinapi_itens for all
  using (is_engenheiro()) with check (is_engenheiro());

alter table sinapi_mapeamento enable row level security;
create policy eng_all_sinapi_mapeamento on sinapi_mapeamento for all
  using (is_engenheiro()) with check (is_engenheiro());

insert into storage.buckets (id, name, public) values ('sinapi', 'sinapi', false)
on conflict (id) do nothing;

create policy eng_full_storage_sinapi on storage.objects for all
  using (bucket_id = 'sinapi' and is_engenheiro())
  with check (bucket_id = 'sinapi' and is_engenheiro());

-- === Orçamento da obra: deixa de ter cadência mensal obrigatória e ganha o
-- fluxo rascunho -> ativa -> substituida, montado item a item ou por planilha ===

alter table orcamento_versoes alter column mes_referencia drop not null;
alter table orcamento_versoes alter column arquivo_original_path drop not null;
alter table orcamento_versoes add column titulo text;
alter table orcamento_versoes alter column status set default 'rascunho';
alter table orcamento_versoes drop constraint if exists orcamento_versoes_obra_id_mes_referencia_key;
