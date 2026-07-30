-- EAP (Estrutura Analítica do Projeto) / Cronograma com caminho crítico (CPM).
-- Etapa -> Tarefa (2 níveis). O CPM roda sobre as tarefas (folhas), usando as
-- dependências entre elas (4 tipos clássicos + lag). Baseline é gravada uma
-- única vez (primeiro cálculo bem-sucedido) e nunca mais alterada, para que o
-- atraso de cada tarefa (data atual x baseline) fique sempre rastreável.

create type dependencia_tipo as enum (
  'termino_inicio',
  'inicio_inicio',
  'termino_termino',
  'inicio_termino'
);

create table cronograma_etapas (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references obras(id) on delete cascade,
  nome text not null,
  ordem int not null,
  created_at timestamptz not null default now()
);
create index idx_cronograma_etapas_obra on cronograma_etapas(obra_id);

create table cronograma_tarefas (
  id uuid primary key default gen_random_uuid(),
  etapa_id uuid not null references cronograma_etapas(id) on delete cascade,
  obra_id uuid not null references obras(id) on delete cascade,
  nome text not null,
  duracao_dias int not null default 1 check (duracao_dias > 0),
  orcamento_item_id uuid references orcamento_itens(id),
  restricao_inicio_nao_antes_de date,

  baseline_inicio date,
  baseline_fim date,

  data_inicio_cedo date,
  data_fim_cedo date,
  data_inicio_tarde date,
  data_fim_tarde date,
  folga_dias int,
  critica boolean not null default false,

  data_inicio_real date,
  data_fim_real date,

  ordem int not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_cronograma_tarefas_etapa on cronograma_tarefas(etapa_id);
create index idx_cronograma_tarefas_obra on cronograma_tarefas(obra_id);

create table cronograma_dependencias (
  id uuid primary key default gen_random_uuid(),
  tarefa_predecessora_id uuid not null references cronograma_tarefas(id) on delete cascade,
  tarefa_sucessora_id uuid not null references cronograma_tarefas(id) on delete cascade,
  tipo dependencia_tipo not null default 'termino_inicio',
  lag_dias int not null default 0,
  unique (tarefa_predecessora_id, tarefa_sucessora_id),
  check (tarefa_predecessora_id <> tarefa_sucessora_id)
);
create index idx_cronograma_dependencias_predecessora on cronograma_dependencias(tarefa_predecessora_id);
create index idx_cronograma_dependencias_sucessora on cronograma_dependencias(tarefa_sucessora_id);

-- RLS: mesmo padrão do orçamento — engenheiro edita tudo, cliente só consulta
-- (vai alimentar o dashboard do cliente futuramente).
alter table cronograma_etapas enable row level security;
create policy eng_all_cronograma_etapas on cronograma_etapas for all
  using (is_engenheiro()) with check (is_engenheiro());
create policy cli_select_cronograma_etapas on cronograma_etapas for select
  using (cliente_tem_acesso_obra(obra_id));

alter table cronograma_tarefas enable row level security;
create policy eng_all_cronograma_tarefas on cronograma_tarefas for all
  using (is_engenheiro()) with check (is_engenheiro());
create policy cli_select_cronograma_tarefas on cronograma_tarefas for select
  using (cliente_tem_acesso_obra(obra_id));

alter table cronograma_dependencias enable row level security;
create policy eng_all_cronograma_dependencias on cronograma_dependencias for all
  using (is_engenheiro()) with check (is_engenheiro());
create policy cli_select_cronograma_dependencias on cronograma_dependencias for select
  using (
    exists (
      select 1 from cronograma_tarefas t
      where t.id = tarefa_predecessora_id and cliente_tem_acesso_obra(t.obra_id)
    )
  );
