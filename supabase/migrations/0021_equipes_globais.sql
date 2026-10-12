-- Equipe vira cadastro global, reaproveitável entre obras.
--
-- Antes, `equipes.obra_id` era obrigatório: cada obra montava as suas do zero,
-- e a mesma turma cadastrada em três obras eram três equipes distintas, sem
-- nenhuma ligação entre elas.
--
-- Agora a equipe carrega o que é dela em qualquer lugar — nome, responsável,
-- membros — e o que se negocia obra a obra (tipo de contrato, unidade e valor
-- por unidade) passa para o vínculo. É o mesmo desenho que já existe entre
-- `trabalhadores` (global) e `obra_trabalhadores.valor_diaria` (por obra):
-- empreitada se negocia caso a caso, então o preço não pode morar na equipe.

create table obra_equipes (
  obra_id uuid not null references obras(id) on delete cascade,
  equipe_id uuid not null references equipes(id) on delete cascade,
  tipo_contrato tipo_contrato_equipe not null default 'diaria',
  -- Só usados quando tipo_contrato = 'empreitada'.
  unidade_medida text,
  valor_unidade numeric(12,2),
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (obra_id, equipe_id),
  -- Empreitada sem unidade e valor não fecha pagamento nenhum; melhor barrar
  -- na escrita do que descobrir na hora de pagar.
  constraint chk_empreitada_completa check (
    tipo_contrato <> 'empreitada' or (unidade_medida is not null and valor_unidade is not null)
  )
);

create index idx_obra_equipes_obra on obra_equipes(obra_id) where ativo;

-- Migra o que já existe: cada equipe atual vira um vínculo com a obra dela,
-- carregando as condições que estavam na própria equipe.
insert into obra_equipes (obra_id, equipe_id, tipo_contrato, unidade_medida, valor_unidade, ativo, created_at)
select obra_id, id, tipo_contrato, unidade_medida, valor_unidade, ativo, created_at
from equipes;

alter table equipes drop column obra_id;
alter table equipes drop column tipo_contrato;
alter table equipes drop column unidade_medida;
alter table equipes drop column valor_unidade;

alter table obra_equipes enable row level security;

-- Mesmo critério de `equipes`: composição de equipe e responsável são dados de
-- folha de pagamento — o cliente não acessa.
create policy eng_all_obra_equipes on obra_equipes
  for all using (is_engenheiro()) with check (is_engenheiro());
