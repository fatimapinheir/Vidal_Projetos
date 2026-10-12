-- Remove as colunas de entrega da parcela, substituídas pelas da ordem.
--
-- Separada da 0045 de propósito: aquela é aditiva e já rodou, copiando a
-- entrega das parcelas para a ordem. Esta é destrutiva. Rodar as duas juntas
-- apagaria a origem dos dados no mesmo passo que os copia, sem janela para
-- conferir a cópia.
--
-- Antes de rodar, confira que a cópia está certa:
--
--   select c.descricao, c.data_entrega_prevista, c.data_entrega_real,
--          min(p.data_entrega_prevista) as parcela_prevista,
--          max(p.data_entrega_real) as parcela_real
--     from compras c join compra_parcelas p on p.compra_id = c.id
--    group by 1,2,3;
--
-- A VIEW PRECISA SAIR E VOLTAR.
--
-- `vw_compra_parcelas` é `select cp.*`, e o Postgres expande isso na criação:
-- a view guarda a lista de colunas de então, inclusive as duas que vão sair.
-- É por isso que o `drop column` sozinho falha com "other objects depend on
-- it" — e por isso ela é recriada no fim, com a MESMA definição da 0045. Com
-- as colunas já removidas, o `cp.*` passa a expandir sem elas.
drop view vw_compra_parcelas;

alter table compra_parcelas
  drop column if exists data_entrega_prevista,
  drop column if exists data_entrega_real;

create view vw_compra_parcelas with (security_invoker = true) as
select
  cp.*,
  c.pagamento_apos_recebimento,
  -- A entrega é da ordem: ou a compra não depende de recebimento, ou a ordem
  -- inteira já foi confirmada como recebida.
  (not c.pagamento_apos_recebimento or c.data_entrega_real is not null)
    as liberada_para_pagamento,
  c.data_entrega_prevista as entrega_prevista_ordem,
  c.data_entrega_real as entrega_real_ordem,
  case
    when cp.status = 'paga' then 'paga'::parcela_status
    -- Aguardando mercadoria não vence: a data passar é problema do fornecedor.
    when c.pagamento_apos_recebimento and c.data_entrega_real is null
      then 'pendente'::parcela_status
    when cp.status = 'pendente' and cp.data_vencimento < current_date
      then 'vencida'::parcela_status
    else cp.status
  end as status_efetivo
from compra_parcelas cp
join compras c on c.id = cp.compra_id;

grant select on vw_compra_parcelas to authenticated;
