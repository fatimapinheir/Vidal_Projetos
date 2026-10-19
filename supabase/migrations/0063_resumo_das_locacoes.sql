-- Quanto já foi PAGO de cada locação, e quanto ela soma por contrato.
--
-- A tela de locações mostrava o acumulado — as mensalidades dos meses que já
-- começaram — e isso virou mentira quando a regra do sistema passou a ser
-- "gasto é o que saiu do caixa" (ver 0062 e a correção do custo da obra). A
-- betoneira aparecia como "R$ 300 de R$ 1.800" sem ninguém ter pago nada.
--
-- Agora o número vem das PARCELAS da ordem de compra que a mensalidade gerou:
-- pago é pago, e mês vencido sem pagamento continua valendo zero. É a mesma
-- régua do resto do sistema.
--
-- Locação por DIA e por HORA não tem ordem nem parcela — devolve zero nas duas
-- colunas, e a tela cai no valor acumulado pela fórmula de diárias. A regra de
-- negócio desse caso ainda vai ser definida com a construtora.
create or replace view vw_locacoes_resumo with (security_invoker = true) as
select
  l.id as locacao_id,
  l.obra_id,
  coalesce(sum(p.valor) filter (where p.status_efetivo = 'paga'), 0) as total_pago,
  -- A soma das parcelas é o total da ordem — e, portanto, o contrato inteiro.
  coalesce(sum(p.valor), 0) as total_contratado,
  count(p.id) filter (where p.status_efetivo = 'paga')::int as parcelas_pagas,
  count(p.id)::int as parcelas_total
from locacoes_equipamento l
left join compras c on c.locacao_id = l.id
left join vw_compra_parcelas p on p.compra_id = c.id
group by l.id, l.obra_id;

grant select on vw_locacoes_resumo to authenticated;
