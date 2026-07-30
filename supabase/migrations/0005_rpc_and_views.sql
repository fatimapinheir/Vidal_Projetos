-- RPCs security definer para as ações do cliente (aprovar/recusar/pagar).
-- Cliente nunca tem UPDATE direto em compras/compra_parcelas — só essas funções,
-- que validam acesso e não permitem alterar valores/datas.

create or replace function public.aprovar_compra(p_compra_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_obra_id uuid;
begin
  select obra_id into v_obra_id from compras where id = p_compra_id and status = 'cotada';
  if v_obra_id is null then raise exception 'Compra não encontrada ou já processada'; end if;
  if not cliente_tem_acesso_obra(v_obra_id) and not is_engenheiro() then
    raise exception 'Acesso negado';
  end if;
  update compras set status = 'aprovada', aprovado_por = auth.uid(), aprovado_em = now(), updated_at = now()
  where id = p_compra_id;
end;
$$;

create or replace function public.recusar_compra(p_compra_id uuid, p_motivo text)
returns void language plpgsql security definer set search_path = public as $$
declare v_obra_id uuid;
begin
  select obra_id into v_obra_id from compras where id = p_compra_id and status = 'cotada';
  if v_obra_id is null then raise exception 'Compra não encontrada ou já processada'; end if;
  if not cliente_tem_acesso_obra(v_obra_id) and not is_engenheiro() then
    raise exception 'Acesso negado';
  end if;
  update compras set status = 'recusada', aprovado_por = auth.uid(), aprovado_em = now(),
    motivo_recusa = p_motivo, updated_at = now()
  where id = p_compra_id;
end;
$$;

create or replace function public.pagar_parcela(p_parcela_id uuid, p_comprovante_path text)
returns void language plpgsql security definer set search_path = public as $$
declare v_obra_id uuid;
begin
  select c.obra_id into v_obra_id from compra_parcelas cp
  join compras c on c.id = cp.compra_id
  where cp.id = p_parcela_id and c.status = 'aprovada';
  if v_obra_id is null then raise exception 'Parcela não encontrada ou compra não aprovada'; end if;
  if not cliente_tem_acesso_obra(v_obra_id) and not is_engenheiro() then
    raise exception 'Acesso negado';
  end if;
  update compra_parcelas set status = 'paga', data_pagamento = current_date,
    comprovante_pagamento_path = p_comprovante_path, updated_at = now()
  where id = p_parcela_id;
end;
$$;

grant execute on function public.aprovar_compra(uuid) to authenticated;
grant execute on function public.recusar_compra(uuid, text) to authenticated;
grant execute on function public.pagar_parcela(uuid, text) to authenticated;

-- Quando todas as parcelas de uma compra ficam pagas, a compra passa para 'paga'
create or replace function public.atualizar_status_compra()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from compra_parcelas
    where compra_id = new.compra_id and status <> 'paga'
  ) then
    update compras set status = 'paga', updated_at = now() where id = new.compra_id;
  end if;
  return new;
end;
$$;

create trigger trg_atualiza_status_compra
  after update of status on compra_parcelas
  for each row when (new.status = 'paga')
  execute function public.atualizar_status_compra();

-- View com status efetivo (marca "vencida" em tempo real, sem depender de job agendado).
-- security_invoker garante que a RLS de compra_parcelas seja aplicada com o papel de
-- quem consulta a view, e não do dono (senão o dono bypassaria a RLS da tabela base).
create view vw_compra_parcelas with (security_invoker = true) as
select cp.*,
  case when cp.status = 'pendente' and cp.data_vencimento < current_date
       then 'vencida'::parcela_status else cp.status end as status_efetivo
from compra_parcelas cp;

grant select on vw_compra_parcelas to authenticated;
