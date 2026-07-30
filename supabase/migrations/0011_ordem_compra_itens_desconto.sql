-- Itens na ordem de compra (equivalente ao que já existia no planejamento),
-- com desconto individual por item e desconto total na nota. O valor_total da
-- compra deixa de ser digitado à mão e passa a ser derivado via trigger.

create type desconto_tipo as enum ('valor', 'percentual');

create table compra_itens (
  id uuid primary key default gen_random_uuid(),
  compra_id uuid not null references compras(id) on delete cascade,
  orcamento_item_id uuid references orcamento_itens(id), -- null = item avulso (fora do planejamento)
  descricao text not null,
  unidade text not null,
  quantidade numeric(14,4) not null default 1,
  preco_unitario numeric(14,4) not null default 0,
  desconto_tipo desconto_tipo,
  desconto_valor numeric(14,4) default 0,
  subtotal numeric(14,2) generated always as (quantidade * preco_unitario) stored,
  total_liquido numeric(14,2) generated always as (
    case
      when desconto_tipo = 'percentual' then
        greatest(quantidade * preco_unitario * (1 - coalesce(desconto_valor, 0) / 100), 0)
      when desconto_tipo = 'valor' then
        greatest(quantidade * preco_unitario - coalesce(desconto_valor, 0), 0)
      else quantidade * preco_unitario
    end
  ) stored,
  ordem int not null,
  created_at timestamptz not null default now()
);
create index idx_compra_itens_compra on compra_itens(compra_id);

alter table compras add column desconto_tipo desconto_tipo;
alter table compras add column desconto_valor numeric(14,4) default 0;

-- valor_total agora é derivado: soma dos itens (já líquidos de desconto individual)
-- com o desconto da nota aplicado por cima. Nunca reescreve o desconto de um item.
create or replace function public.recalcular_valor_compra(p_compra_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_subtotal numeric(14,2);
  v_desconto_tipo desconto_tipo;
  v_desconto_valor numeric(14,4);
begin
  select coalesce(sum(total_liquido), 0) into v_subtotal
  from compra_itens where compra_id = p_compra_id;

  select desconto_tipo, desconto_valor into v_desconto_tipo, v_desconto_valor
  from compras where id = p_compra_id;

  update compras set
    valor_total = case
      when v_desconto_tipo = 'percentual' then greatest(v_subtotal * (1 - coalesce(v_desconto_valor, 0) / 100), 0)
      when v_desconto_tipo = 'valor' then greatest(v_subtotal - coalesce(v_desconto_valor, 0), 0)
      else v_subtotal
    end,
    updated_at = now()
  where id = p_compra_id;
end;
$$;

create or replace function public.trg_recalcular_valor_compra_itens()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if TG_OP = 'DELETE' then
    perform recalcular_valor_compra(old.compra_id);
  else
    perform recalcular_valor_compra(new.compra_id);
    if TG_OP = 'UPDATE' and old.compra_id is distinct from new.compra_id then
      perform recalcular_valor_compra(old.compra_id);
    end if;
  end if;
  return null;
end;
$$;

create trigger trg_compra_itens_recalcula
  after insert or update or delete on compra_itens
  for each row execute function trg_recalcular_valor_compra_itens();

create or replace function public.trg_recalcular_valor_compra_desconto()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform recalcular_valor_compra(new.id);
  return null;
end;
$$;

create trigger trg_compras_desconto_recalcula
  after update of desconto_tipo, desconto_valor on compras
  for each row execute function trg_recalcular_valor_compra_desconto();

alter table compra_itens enable row level security;
create policy eng_all_compra_itens on compra_itens for all
  using (is_engenheiro()) with check (is_engenheiro());
create policy cli_select_compra_itens on compra_itens for select using (
  exists (select 1 from compras c where c.id = compra_id and cliente_tem_acesso_obra(c.obra_id))
);

-- Backfill: compras existentes viram um item único (sem desconto), preservando o valor atual
insert into compra_itens (compra_id, descricao, unidade, quantidade, preco_unitario, ordem)
select id, descricao, 'UN', 1, valor_total, 1 from compras;
