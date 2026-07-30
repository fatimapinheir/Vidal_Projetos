-- Fechamento por equipe (diária, em lote) e por entrega (empreitada/metragem).
-- O fechamento individual (fechamentos_periodo, um trabalhador por vez) continua
-- existindo sem mudanças — isso só adiciona duas formas novas de fechar pagamento.

create type tipo_contrato_equipe as enum ('diaria', 'empreitada');

-- Equipe: agrupamento de trabalhadores dentro de uma obra, com um responsável
-- (quem recebe o pagamento consolidado) e um tipo de contrato.
create table equipes (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references obras(id) on delete cascade,
  nome text not null,
  tipo_contrato tipo_contrato_equipe not null default 'diaria',
  responsavel_id uuid references trabalhadores(id),
  -- só usados quando tipo_contrato = 'empreitada'
  unidade_medida text,
  valor_unidade numeric(12,2),
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);
create index idx_equipes_obra on equipes(obra_id);

create table equipe_trabalhadores (
  equipe_id uuid not null references equipes(id) on delete cascade,
  trabalhador_id uuid not null references trabalhadores(id) on delete cascade,
  primary key (equipe_id, trabalhador_id)
);

-- Fechamento por equipe (diária): insere um fechamentos_periodo por membro
-- (mesma fórmula de sempre), todos marcados com o mesmo equipe_id — permite
-- agrupar na tela e pagar todo mundo de uma vez com um comprovante só.
alter table fechamentos_periodo add column equipe_id uuid references equipes(id);
create index idx_fechamentos_periodo_equipe on fechamentos_periodo(equipe_id, periodo_inicio, periodo_fim);

-- Fechamento por entrega (empreitada): quantidade entregue no período x valor
-- por unidade, pago ao responsável da equipe.
create table fechamentos_entrega (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references obras(id) on delete cascade,
  equipe_id uuid not null references equipes(id),
  periodo_inicio date not null,
  periodo_fim date not null,
  quantidade_entregue numeric(14,4) not null check (quantidade_entregue >= 0),
  unidade_medida text not null,
  valor_unidade numeric(12,2) not null,
  valor_total numeric(14,2) generated always as (quantidade_entregue * valor_unidade) stored,
  status fechamento_status not null default 'aberto',
  data_pagamento date,
  comprovante_path text,
  observacoes text,
  criado_por uuid not null references profiles(id),
  created_at timestamptz not null default now()
);
create index idx_fechamentos_entrega_obra on fechamentos_entrega(obra_id, periodo_inicio desc);

-- RLS: dado de folha de pagamento, mesmo padrão de trabalhadores/presencas/fechamentos_periodo
-- (só o engenheiro acessa, sem policy de cliente).
alter table equipes enable row level security;
create policy eng_all_equipes on equipes for all using (is_engenheiro()) with check (is_engenheiro());

alter table equipe_trabalhadores enable row level security;
create policy eng_all_equipe_trabalhadores on equipe_trabalhadores for all
  using (is_engenheiro()) with check (is_engenheiro());

alter table fechamentos_entrega enable row level security;
create policy eng_all_fechamentos_entrega on fechamentos_entrega for all
  using (is_engenheiro()) with check (is_engenheiro());
