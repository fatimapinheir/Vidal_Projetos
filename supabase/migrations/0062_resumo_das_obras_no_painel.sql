-- O painel inicial para de varrer o sistema inteiro para somar.
--
-- Três consultas dele traziam linha por linha, de TODAS as obras, sem limite:
-- as parcelas vencidas, as compras aprovadas/pagas e as parcelas em aberto.
-- Com dois canteiros são 150 linhas e ninguém nota. O PostgREST corta em 1000
-- SEM AVISAR — a resposta volta "com sucesso", só que incompleta —, e a partir
-- de umas quinze obras o painel deixaria de ficar lento e passaria a ficar
-- ERRADO: valor gasto a menos, contas vencidas a menos, e nada na tela
-- indicando isso. É a pior classe de defeito que este sistema pode ter.
--
-- Agregar no banco troca "traga tudo e some no servidor" por "some e traga uma
-- linha por obra". O teto deixa de ser alcançável: são tantas linhas quantas
-- obras existirem.
--
-- O GASTO aqui segue a mesma regra da visão da obra: parcela PAGA, e só. Antes
-- somava ordem com status `aprovada` ou `paga`, e isso é compromisso, não
-- caixa. Os dois números precisam concordar — o painel dizendo um total e a
-- obra dizendo outro é pior que qualquer um dos dois estar errado sozinho.
create or replace view vw_resumo_obras with (security_invoker = true) as
select
  o.id as obra_id,
  coalesce(agregado.gasto_pago, 0) as gasto_pago,
  coalesce(agregado.parcelas_vencidas, 0)::int as parcelas_vencidas,
  proxima.data_vencimento as proxima_parcela,
  coalesce(proxima.vencida, false) as proxima_vencida
from obras o
left join (
  select
    c.obra_id,
    sum(v.valor) filter (where v.status_efetivo = 'paga') as gasto_pago,
    count(*) filter (
      where v.status_efetivo = 'vencida' and v.liberada_para_pagamento
    ) as parcelas_vencidas
  from vw_compra_parcelas v
  join compras c on c.id = v.compra_id
  group by c.obra_id
) agregado on agregado.obra_id = o.id
-- A PRÓXIMA conta a vencer, uma por obra. `lateral` com `limit 1` reproduz
-- exatamente o que o servidor fazia: ordenar por vencimento e pegar a
-- primeira de cada obra.
left join lateral (
  select v.data_vencimento, v.status_efetivo = 'vencida' as vencida
  from vw_compra_parcelas v
  join compras c on c.id = v.compra_id
  where c.obra_id = o.id and v.status_efetivo <> 'paga'
  order by v.data_vencimento
  limit 1
) proxima on true;

grant select on vw_resumo_obras to authenticated;
