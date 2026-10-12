-- Pagamento condicionado ao recebimento da mercadoria.
--
-- Em boa parte das compras o pagamento só acontece depois que o material chega.
-- Até lá a parcela não deve aparecer como pendente de pagamento — nem cobrar o
-- cliente, nem contar como vencida se a data passar, porque o atraso é do
-- fornecedor, não dele.

alter table compras
  add column pagamento_apos_recebimento boolean not null default false;

-- A view é onde a regra vive.
--
-- Poderia ser um filtro em cada tela, mas são quatro lugares que listam
-- parcelas pendentes (portal do cliente, visão da obra, dashboard do
-- engenheiro, detalhe da compra) e bastaria um esquecer o filtro para o
-- cliente ser cobrado por mercadoria que não chegou. Na view, todos herdam.
--
-- Lembrete que já custou caro uma vez: `select cp.*` é expandido na CRIAÇÃO da
-- view. Toda coluna nova em `compra_parcelas` exige recriar isto aqui, senão
-- ela chega `undefined` em runtime sem o TypeScript reclamar.
drop view vw_compra_parcelas;

create view vw_compra_parcelas with (security_invoker = true) as
select
  cp.*,
  c.pagamento_apos_recebimento,
  -- Liberada para pagamento: ou a compra não depende de recebimento, ou a
  -- mercadoria já foi confirmada como recebida.
  (not c.pagamento_apos_recebimento or cp.data_entrega_real is not null)
    as liberada_para_pagamento,
  case
    when cp.status = 'paga' then 'paga'::parcela_status
    -- Aguardando mercadoria não vence: a data passar é problema do fornecedor.
    when c.pagamento_apos_recebimento and cp.data_entrega_real is null
      then 'pendente'::parcela_status
    when cp.status = 'pendente' and cp.data_vencimento < current_date
      then 'vencida'::parcela_status
    else cp.status
  end as status_efetivo
from compra_parcelas cp
join compras c on c.id = cp.compra_id;

grant select on vw_compra_parcelas to authenticated;
