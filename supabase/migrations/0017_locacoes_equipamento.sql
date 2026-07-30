-- Locação de equipamentos por obra (betoneira, andaime, compactador...).
--
-- O custo de uma locação não é um valor fechado: ele corre enquanto o
-- equipamento está na obra e para quando é devolvido. Por isso não existe
-- coluna de valor total — ela nasceria desatualizada no dia seguinte. O total é
-- derivado em `lib/locacoes/calculo.ts`:
--
--   por dia  → quantidade × valor_unitario × dias corridos de data_inicio até
--              data_devolucao (ou até hoje, se ainda estiver em uso), inclusivo.
--   por hora → quantidade × valor_unitario × horas_utilizadas, informadas pelo
--              engenheiro; a devolução congela esse número.

create type locacao_unidade as enum ('dia', 'hora');

create table locacoes_equipamento (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references obras(id) on delete cascade,
  fornecedor_id uuid not null references fornecedores(id),
  equipamento text not null,
  quantidade int not null default 1 check (quantidade > 0),
  unidade locacao_unidade not null default 'dia',
  valor_unitario numeric(12,2) not null check (valor_unitario >= 0),
  data_inicio date not null,
  horas_utilizadas numeric(12,2) not null default 0 check (horas_utilizadas >= 0),
  -- "Devolvido" é data_devolucao preenchida — sem flag booleana separada, pra
  -- não existir o estado inconsistente de marcado como devolvido e sem data.
  data_devolucao date,
  observacoes text,
  criado_por uuid not null references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_devolucao_apos_inicio check (data_devolucao is null or data_devolucao >= data_inicio)
);

create index idx_locacoes_obra on locacoes_equipamento(obra_id);

alter table locacoes_equipamento enable row level security;

create policy eng_all_locacoes on locacoes_equipamento
  for all using (is_engenheiro()) with check (is_engenheiro());

create policy cli_select_locacoes on locacoes_equipamento
  for select using (cliente_tem_acesso_obra(obra_id));
