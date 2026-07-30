-- Folgas do cronograma: dias (ou intervalos de dias) que não contam como dia
-- útil no cálculo do CPM, independente de fim de semana ou feriado — o
-- engenheiro cadastra qualquer data como folga e ela passa a ser pulada nos
-- cálculos de início/fim/atraso de todas as tarefas da obra.

create table cronograma_folgas (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references obras(id) on delete cascade,
  data_inicio date not null,
  data_fim date not null,
  descricao text,
  criado_por uuid not null references profiles(id),
  created_at timestamptz not null default now(),
  check (data_fim >= data_inicio)
);
create index idx_cronograma_folgas_obra on cronograma_folgas(obra_id, data_inicio);

alter table cronograma_folgas enable row level security;
create policy eng_all_cronograma_folgas on cronograma_folgas for all
  using (is_engenheiro()) with check (is_engenheiro());
create policy cli_select_cronograma_folgas on cronograma_folgas for select
  using (cliente_tem_acesso_obra(obra_id));
