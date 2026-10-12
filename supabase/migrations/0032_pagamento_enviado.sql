-- "Pagamento enviado": o passo que faltava entre liberar e pagar.
--
-- Nas ordens com pagamento condicionado ao recebimento, o dinheiro não sai
-- junto com a confirmação da mercadoria: o engenheiro recebe, lança o
-- pagamento e só depois ele é efetivado. Sem registrar esse meio, a parcela
-- fica indistinguível de uma que ninguém tocou — e a dúvida "já mandei esse
-- pagamento?" só se resolvia fora do sistema.
--
-- Data em vez de booleano porque responde o sim/não (null = não) e ainda diz
-- quando, que é o que se olha quando o fornecedor cobra de novo. Mesma forma de
-- `data_entrega_real` e `data_pagamento`, ao lado.
alter table compra_parcelas
  add column pagamento_enviado_em date,
  add column pagamento_enviado_por uuid references profiles(id);

-- AVISO que já custou caro duas vezes (ver 0018 e 0025): `vw_compra_parcelas`
-- é `select cp.*`, e o Postgres expande isso na CRIAÇÃO da view. As colunas
-- acima não apareceriam nela — chegariam `undefined` em runtime, sem o
-- TypeScript reclamar. Por isso a view é recriada aqui, idêntica à 0025 a não
-- ser pelo `cp.*`, que agora pega as duas colunas novas.
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
