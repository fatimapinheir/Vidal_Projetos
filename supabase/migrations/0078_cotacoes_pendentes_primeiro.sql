-- A lista de cotações precisa abrir pelo que está travado.
--
-- A 0077 ordenava por `status`, e eu documentei isso como "ordena
-- alfabeticamente numa sequência que, por sorte do vocabulário, serve".
-- Está errado: o Postgres ordena enum pela ordem de DEFINIÇÃO do tipo, não
-- pelo texto. A ordem real é rascunho, aguardando_cliente, decidida,
-- recusada — então a lista abria pelos rascunhos e empurrava para baixo
-- justamente as cotações que esperam decisão há dias.
--
-- A correção é uma coluna de posto, como `ordem_situacao` em
-- `vw_compras_lista` (0060): o PostgREST não ordena por expressão, e ordenar
-- no TypeScript só valeria dentro da página carregada — o mesmo defeito que a
-- paginação existe para evitar.
--
-- `create or replace` em vez de `drop`/`create`: acrescentar coluna no FIM da
-- lista é permitido, e assim a view não deixa de existir por um instante.
create or replace view vw_cotacoes_lista with (security_invoker = true) as
select
  c.*,
  coalesce(p.propostas, 0)::int as propostas,
  p.menor_valor,
  p.maior_valor,
  e.fornecedor_nome as fornecedor_escolhido,
  e.valor_total as valor_escolhido,
  e.compra_id,
  -- Esperando decisão primeiro; rascunho depois, porque é trabalho em
  -- andamento de quem está olhando a tela; decidida e recusada no fim, que é
  -- onde histórico pertence.
  case c.status
    when 'aguardando_cliente' then 1
    when 'rascunho' then 2
    when 'decidida' then 3
    when 'recusada' then 4
  end as ordem_situacao
from cotacoes c
left join (
  select cotacao_id, count(*) as propostas, min(valor_total) as menor_valor, max(valor_total) as maior_valor
  from cotacao_propostas
  group by cotacao_id
) p on p.cotacao_id = c.id
left join (
  select pr.cotacao_id, pr.valor_total, pr.compra_id, f.nome as fornecedor_nome
  from cotacao_propostas pr
  left join fornecedores f on f.id = pr.fornecedor_id
  where pr.status = 'escolhida'
) e on e.cotacao_id = c.id;

comment on view vw_cotacoes_lista is
  'Cotações com a contagem de propostas, a faixa de valores e o posto de situação (pendente primeiro). NÃO deve alimentar dashboard: valor de proposta não é gasto da obra.';
