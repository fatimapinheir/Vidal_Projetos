-- Custo de mão de obra agregado, legível também pelo cliente.
--
-- O cliente não pode ler `fechamentos_periodo` nem `fechamentos_entrega`, e
-- não deve mesmo: ali estão nomes, diárias individuais e quem trabalhou
-- quando. Mas sem o total de mão de obra, o "custo da obra" mostrado para ele
-- sairia menor do que é — materiais e locação apenas — e ele concluiria que a
-- obra custa menos. Número errado é pior que número ausente.
--
-- A saída é entregar só o agregado. Mesmo padrão de `vw_equipe_ativa_obra`:
-- `security_invoker = false` para a view enxergar as tabelas que o cliente não
-- enxerga, com o predicado de acesso DENTRO dela.
--
-- O predicado é obrigatório. Sem ele, qualquer autenticado leria o custo de
-- mão de obra de TODAS as obras. Ao mexer nesta view, mantenha o `where`.

create view vw_custo_mao_de_obra with (security_invoker = false) as
select
  f.obra_id,
  sum(f.valor_total)                                      as total,
  sum(f.valor_total) filter (where f.status = 'pago')     as pago,
  sum(f.valor_total) filter (where f.status = 'aberto')   as aberto
from (
  -- Os dois regimes de pagamento de equipe somam no mesmo bolso.
  select obra_id, valor_total, status from fechamentos_periodo
  union all
  select obra_id, valor_total, status from fechamentos_entrega
) f
where is_engenheiro() or cliente_tem_acesso_obra(f.obra_id)
group by f.obra_id;

grant select on vw_custo_mao_de_obra to authenticated;
