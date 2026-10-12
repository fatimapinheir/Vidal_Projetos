-- Até três arquivos por compra, e exclusão de lançamento pelos dois usuários.

-- ---------------------------------------------------------------------------
-- 1. Anexos da compra
--
-- Substitui `compras.anexo_cotacao_path`, que guardava UM caminho na própria
-- linha. Três colunas lado a lado (`anexo_1`, `anexo_2`, `anexo_3`) resolveriam
-- o pedido e cobrariam o preço na primeira tela: toda leitura passaria a ter
-- três ramos, e "quantos arquivos tem" viraria contagem de nulos. Em tabela, a
-- lista é uma consulta e o limite é uma regra — e subir para quatro depois é
-- mudar o número no gatilho.
--
-- O bucket vai na linha porque os dois caminhos de arquivo têm permissões
-- diferentes no Storage (ver 0006): `cotacoes` só o engenheiro envia,
-- `comprovantes-pagamento` o cliente também. Guardar o bucket é o que permite
-- a mesma tabela servir a ordem de compra e o lançamento.
-- ---------------------------------------------------------------------------
create table if not exists compra_anexos (
  id uuid primary key default gen_random_uuid(),
  compra_id uuid not null references compras(id) on delete cascade,
  bucket text not null check (bucket in ('cotacoes', 'comprovantes-pagamento')),
  path text not null,
  nome text not null,
  criado_por uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (bucket, path)
);

create index if not exists idx_compra_anexos_compra on compra_anexos(compra_id);

comment on table compra_anexos is
  'Arquivos anexados a uma ordem de compra ou lançamento financeiro. Máximo de 3 por compra (trg_limite_anexos_compra).';

comment on column compras.anexo_cotacao_path is
  'OBSOLETO desde 0048: os anexos vivem em compra_anexos. Mantida só para não perder caminho de linha antiga.';

-- O limite é agregado ("quantos já existem nesta compra"), e check constraint
-- não alcança outras linhas. Daí gatilho — e no banco, não só no formulário:
-- o formulário é uma tela, a regra é do dado.
create or replace function public.trg_limitar_anexos_compra()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from compra_anexos where compra_id = new.compra_id) > 3 then
    raise exception 'Máximo de 3 arquivos anexados por lançamento ou ordem de compra.';
  end if;
  return null;
end;
$$;

create trigger trg_limite_anexos_compra
  after insert on compra_anexos
  for each row execute function public.trg_limitar_anexos_compra();

alter table compra_anexos enable row level security;

create policy eng_all_compra_anexos on compra_anexos for all
  using (is_engenheiro()) with check (is_engenheiro());

create policy cli_select_compra_anexos on compra_anexos for select using (
  exists (
    select 1 from compras c
    where c.id = compra_anexos.compra_id and cliente_tem_acesso_obra(c.obra_id)
  )
);

-- Mesma fronteira das policies de cliente de 0045 e 0047: só em linha marcada
-- como lançamento e em obra dele.
create policy cli_insert_anexo_lancamento on compra_anexos for insert
  with check (
    exists (
      select 1 from compras c
      where c.id = compra_anexos.compra_id
        and c.eh_lancamento
        and cliente_tem_acesso_obra(c.obra_id)
    )
  );

-- ---------------------------------------------------------------------------
-- 2. O cliente pode excluir o lançamento que ele mesmo registrou
--
-- `criado_por = auth.uid()` é o limite: lançamento que o engenheiro registrou é
-- registro do engenheiro, e sumir com ele pelo portal apagaria custo da obra
-- sem que quem o lançou soubesse. Ordem de compra continua fora — nem insert
-- nem delete.
--
-- Itens, parcelas e anexos vão junto pelo `on delete cascade` das chaves
-- estrangeiras, que é integridade referencial e não passa por RLS — por isso
-- não existe policy de delete para as filhas.
-- ---------------------------------------------------------------------------
create policy cli_delete_lancamento on compras for delete
  using (
    eh_lancamento
    and criado_por = auth.uid()
    and cliente_tem_acesso_obra(obra_id)
  );
