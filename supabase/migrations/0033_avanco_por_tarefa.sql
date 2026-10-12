-- Avanço físico medido na tarefa do cronograma, em percentual.
--
-- Antes o avanço era por item do orçamento, em quantidade acumulada ("120 de
-- 200 m² de alvenaria"). Duas coisas quebravam nisso:
--
-- 1. O orçamento e o cronograma são EAPs deliberadamente diferentes nesta obra
--    — 12 etapas de orçamento contra 17 de cronograma, com nomes distintos.
--    Quem acompanha a obra acompanha tarefa, não insumo, e tinha de traduzir de
--    cabeça entre as duas listas.
-- 2. Quantidade acumulada obriga a saber o quanto foi feito em m², kg ou verba
--    para dizer o óbvio: "limpeza do terreno está em 30%".
--
-- Agora é o engenheiro que diz o percentual da tarefa, e pronto.
--
-- A tabela está vazia em produção (verificado antes de escrever isto), então as
-- colunas antigas saem em vez de conviverem com as novas — coluna morta aqui
-- significaria dois caminhos para a mesma medição.
drop view vw_progresso_obra;
drop view vw_avanco_atual;

alter table avanco_registros
  drop column orcamento_item_id,
  drop column quantidade_executada_acumulada,
  add column cronograma_tarefa_id uuid not null references cronograma_tarefas(id) on delete cascade,
  add column percentual numeric(5,2) not null check (percentual >= 0 and percentual <= 100);

create index idx_avanco_tarefa_data on avanco_registros(cronograma_tarefa_id, data_medicao desc);

-- Última medição de cada tarefa. Mantém o histórico na tabela e expõe só o
-- estado atual: correção no mesmo dia vale a mais recente pelo created_at.
create view vw_avanco_atual with (security_invoker = true) as
select distinct on (a.cronograma_tarefa_id)
  a.cronograma_tarefa_id, a.obra_id, a.data_medicao, a.percentual
from avanco_registros a
order by a.cronograma_tarefa_id, a.data_medicao desc, a.created_at desc;

-- Progresso da obra: o dinheiro vem do orçamento, o avanço vem do cronograma.
--
-- O % físico é ponderado por duração da tarefa, não média simples: "limpar
-- terreno" (2 dias) não pode pesar o mesmo que "alvenaria" (30 dias), senão
-- concluir as tarefas curtas infla o progresso.
--
-- Parte de `obras` com left join nas duas pontas, de propósito: a view antiga
-- exigia orçamento ativo e não devolvia linha nenhuma sem ele, então uma obra
-- com cronograma e sem orçamento aparecia com 0% em vez do avanço real.
create view vw_progresso_obra with (security_invoker = true) as
with orcado as (
  select ov.obra_id, ov.id as orcamento_versao_id, sum(oi.preco_total) as valor_orcado_total
  from orcamento_versoes ov
  join orcamento_itens oi on oi.orcamento_versao_id = ov.id
  where ov.status = 'ativa'
  group by ov.obra_id, ov.id
),
fisico as (
  select
    t.obra_id,
    sum(t.duracao_dias) as dias_planejados,
    sum(t.duracao_dias * coalesce(a.percentual, 0) / 100.0) as dias_executados,
    count(*) as total_tarefas,
    count(*) filter (where coalesce(a.percentual, 0) >= 100) as tarefas_concluidas
  from cronograma_tarefas t
  left join vw_avanco_atual a on a.cronograma_tarefa_id = t.id
  group by t.obra_id
)
select
  o.id as obra_id,
  orcado.orcamento_versao_id,
  coalesce(orcado.valor_orcado_total, 0) as valor_orcado_total,
  coalesce(fisico.total_tarefas, 0)::int as total_tarefas,
  coalesce(fisico.tarefas_concluidas, 0)::int as tarefas_concluidas,
  case
    when coalesce(fisico.dias_planejados, 0) > 0
      then fisico.dias_executados / fisico.dias_planejados * 100
    else 0
  end as percentual_fisico,
  -- Quanto do orçamento o avanço físico representa. Não é o gasto real (esse
  -- sai das compras, da folha e das locações) — é a régua contra a qual
  -- comparar o gasto.
  coalesce(orcado.valor_orcado_total, 0)
    * case
        when coalesce(fisico.dias_planejados, 0) > 0
          then fisico.dias_executados / fisico.dias_planejados
        else 0
      end as valor_executado_ponderado
from obras o
left join orcado on orcado.obra_id = o.id
left join fisico on fisico.obra_id = o.id;

grant select on vw_avanco_atual, vw_progresso_obra to authenticated;

-- Ordem de compra vinculada a uma etapa do orçamento.
--
-- Texto, e não FK: a etapa do orçamento é uma string em
-- `orcamento_versoes.etapas` e em `orcamento_itens.etapa` — é assim que item e
-- etapa já se ligam desde a 0030. Guardar o nome mantém o vínculo legível
-- mesmo depois de uma versão nova do orçamento mexer na lista.
alter table compras
  add column orcamento_etapa text;

create index idx_compras_orcamento_etapa on compras(obra_id, orcamento_etapa)
  where orcamento_etapa is not null;
