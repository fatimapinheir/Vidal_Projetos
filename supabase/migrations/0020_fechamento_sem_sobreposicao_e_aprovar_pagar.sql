-- Duas correções de revisão que precisam viver no banco, não só na aplicação.

-- 1) Fechamento de período não pode se sobrepor a outro do mesmo trabalhador
--    na mesma obra.
--
--    A constraint antiga era `unique (obra_id, trabalhador_id, periodo_inicio,
--    periodo_fim)`, que só barra período IDÊNTICO. Fechar 01–15 e depois 01–30
--    passava, e os dias 01–15 entravam na conta duas vezes — o trabalhador
--    recebia em dobro por eles. A checagem na aplicação agora testa
--    sobreposição, mas ela é sujeita a corrida entre dois envios simultâneos;
--    esta constraint é a garantia real.
create extension if not exists btree_gist;

alter table fechamentos_periodo
  drop constraint if exists fechamentos_periodo_obra_id_trabalhador_id_periodo_inicio_key;

alter table fechamentos_periodo
  add constraint fechamentos_periodo_sem_sobreposicao
  exclude using gist (
    obra_id with =,
    trabalhador_id with =,
    daterange(periodo_inicio, periodo_fim, '[]') with &&
  );

-- 2) Aprovar e pagar numa transação só.
--
--    O botão "Pagar agora" chamava aprovar_compra e depois pagar_parcela em
--    duas idas separadas. Falhando a segunda, a compra ficava aprovada e o
--    cliente perdia a chance de recusar (recusar_compra exige status
--    'cotada'). Aqui as duas mudanças caem juntas ou nenhuma cai.
create or replace function public.aprovar_e_pagar_parcela(
  p_compra_id uuid,
  p_parcela_id uuid,
  p_comprovante_path text
)
returns void language plpgsql security definer set search_path = public as $$
declare v_obra_id uuid;
begin
  select obra_id into v_obra_id from compras where id = p_compra_id and status = 'cotada';
  if v_obra_id is null then raise exception 'Compra não encontrada ou já processada'; end if;

  if not cliente_tem_acesso_obra(v_obra_id) and not is_engenheiro() then
    raise exception 'Acesso negado';
  end if;

  -- A parcela precisa ser desta compra: sem isso, um id de parcela de outra
  -- ordem seria pago junto com a aprovação desta.
  if not exists (select 1 from compra_parcelas where id = p_parcela_id and compra_id = p_compra_id) then
    raise exception 'Parcela não pertence a essa ordem de compra';
  end if;

  update compras set status = 'aprovada', aprovado_por = auth.uid(), aprovado_em = now(), updated_at = now()
  where id = p_compra_id;

  update compra_parcelas set status = 'paga', data_pagamento = current_date,
    comprovante_pagamento_path = p_comprovante_path, updated_at = now()
  where id = p_parcela_id;
end;
$$;

grant execute on function public.aprovar_e_pagar_parcela(uuid, uuid, text) to authenticated;
