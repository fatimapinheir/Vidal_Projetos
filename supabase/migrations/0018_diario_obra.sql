-- Diário de obra (RDO): uma folha por obra por dia.
--
-- Enquanto o dia está aberto, o efetivo, os equipamentos, as tarefas previstas e
-- as entregas de material são derivados ao vivo de presencas /
-- locacoes_equipamento / cronograma_tarefas / compra_parcelas — assim a folha
-- acompanha qualquer correção feita nessas telas.
--
-- Ao "Fechar o dia" esses três viram cópia congelada nas colunas *_snapshot, e a
-- folha passa a ser documento: corrigir uma presença antiga depois disso não
-- reescreve mais um diário já fechado. Reabrir limpa os snapshots (volta a ser
-- dinâmico) mas deixa `reaberto_em` marcado — o rastro fica.

create type diario_clima as enum ('praticavel', 'chuva', 'impraticavel');

-- Até aqui o sistema só sabia quando a entrega *deveria* chegar
-- (data_entrega_prevista). Recebimento é evento de campo, e o diário é onde ele
-- é registrado — daí a data real morar na parcela, alimentada pelo diário.
alter table compra_parcelas add column data_entrega_real date;

-- `vw_compra_parcelas` foi criada com `select cp.*`, e o Postgres expande esse
-- `*` na criação da view — ela não passa a enxergar colunas novas sozinha. Como
-- a coluna nova entra no meio da lista, `create or replace` não serve (ele só
-- deixa acrescentar coluna no fim): tem que derrubar e recriar.
--
-- Armadilha de tipo: `database.types.ts` deriva a Row da view da Row da tabela,
-- então o TypeScript continua compilando e a coluna simplesmente vem undefined
-- em runtime. Toda coluna nova em `compra_parcelas` exige recriar essa view.
drop view vw_compra_parcelas;

create view vw_compra_parcelas with (security_invoker = true) as
select cp.*,
  case when cp.status = 'pendente' and cp.data_vencimento < current_date
       then 'vencida'::parcela_status else cp.status end as status_efetivo
from compra_parcelas cp;

grant select on vw_compra_parcelas to authenticated;

create table diario_obra (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references obras(id) on delete cascade,
  data date not null,

  clima_manha diario_clima,
  clima_tarde diario_clima,
  clima_noite diario_clima,

  atividades text,
  ocorrencias text,
  visitas text,

  -- Congelados no fechamento. Null enquanto o dia está aberto.
  efetivo_snapshot jsonb,
  equipamentos_snapshot jsonb,
  tarefas_snapshot jsonb,
  entregas_snapshot jsonb,

  fechado_em timestamptz,
  fechado_por uuid references profiles(id),
  reaberto_em timestamptz,

  registrado_por uuid not null references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (obra_id, data),
  -- Fechado exige todos os snapshots; aberto não pode ter nenhum. Impede a folha
  -- de ficar meio congelada, que é o estado que geraria número errado na tela.
  constraint chk_fechado_com_snapshot check (
    num_nonnulls(efetivo_snapshot, equipamentos_snapshot, tarefas_snapshot, entregas_snapshot) =
      case when fechado_em is null then 0 else 4 end
  )
);

create index idx_diario_obra_data on diario_obra(obra_id, data desc);

create table diario_fotos (
  id uuid primary key default gen_random_uuid(),
  diario_id uuid not null references diario_obra(id) on delete cascade,
  -- Denormalizado: o path no storage começa por {obra_id}/ e a policy precisa
  -- dele sem ter que fazer join na hora do upload.
  obra_id uuid not null references obras(id) on delete cascade,
  path text not null unique,
  legenda text,
  enviado_por uuid not null references profiles(id),
  created_at timestamptz not null default now()
);

create index idx_diario_fotos_diario on diario_fotos(diario_id);

alter table diario_obra enable row level security;
alter table diario_fotos enable row level security;

create policy eng_all_diario on diario_obra
  for all using (is_engenheiro()) with check (is_engenheiro());

-- O cliente só enxerga dia fechado — rascunho e anotação em edição não vazam.
create policy cli_select_diario on diario_obra
  for select using (fechado_em is not null and cliente_tem_acesso_obra(obra_id));

create policy eng_all_diario_fotos on diario_fotos
  for all using (is_engenheiro()) with check (is_engenheiro());

create policy cli_select_diario_fotos on diario_fotos
  for select using (
    exists (
      select 1 from diario_obra d
      where d.id = diario_fotos.diario_id
        and d.fechado_em is not null
        and cliente_tem_acesso_obra(d.obra_id)
    )
  );

insert into storage.buckets (id, name, public) values ('diario-obra', 'diario-obra', false)
on conflict (id) do nothing;

create policy eng_full_diario_storage on storage.objects for all
  using (bucket_id = 'diario-obra' and is_engenheiro())
  with check (bucket_id = 'diario-obra' and is_engenheiro());

-- A foto segue a mesma regra do diário a que pertence: só sai para o cliente se
-- aquele dia estiver fechado. Checar só a obra deixaria vazar foto de rascunho.
create policy cli_select_diario_storage on storage.objects for select
  using (
    bucket_id = 'diario-obra'
    and exists (
      select 1 from diario_fotos f
      join diario_obra d on d.id = f.diario_id
      where f.path = storage.objects.name
        and d.fechado_em is not null
        and cliente_tem_acesso_obra(d.obra_id)
    )
  );
