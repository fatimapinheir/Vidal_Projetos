-- O avanço físico passa a ser média simples das tarefas, sem peso de duração.
--
-- Era ponderado: `sum(duracao_dias * percentual) / sum(duracao_dias)`. Uma
-- tarefa de 13 dias pesava 6,5 vezes mais que uma de 2.
--
-- O que levou à troca veio da obra. Na etapa "4.0 — Alvenaria e vedações",
-- três das quatro tarefas estavam em 100% e a tela mostrava 60% — porque a
-- única pendente, "Elevação das paredes internas", é a mais longa (6 de 15
-- dias da etapa). A conta estava certa; a leitura, não. Três de quatro lê-se
-- 75%, e número que contraria a leitura direta vira desconfiança no sistema.
--
-- O custo é conhecido: concluir tarefa curta agora move o número tanto quanto
-- concluir tarefa longa. Na CASA VIDAL ALPHA a obra sai de 22,6% para 24,6%, e
-- as etapas se mexem nos dois sentidos — "3.0 Estrutura" sobe de 25% para 36%,
-- "6.0 Reboco" cai de 42% para 37%.
--
-- A mesma régua está em `lib/avanco/percentual.ts`, para a tela de avanço e a
-- visão do cliente. Mudando uma, mudar as duas — é por isso que o arquivo de
-- TypeScript aponta para esta migração e vice-versa.
create or replace view vw_progresso_obra with (security_invoker = true) as
with orcado as (
  select ov.obra_id,
         ov.id as orcamento_versao_id,
         sum(oi.preco_total) as valor_orcado_total
    from orcamento_versoes ov
    join orcamento_itens oi on oi.orcamento_versao_id = ov.id
   where ov.status = 'ativa'::orcamento_versao_status
   group by ov.obra_id, ov.id
), fisico as (
  select t.obra_id,
         -- Média simples: cada tarefa conta uma vez, qualquer que seja a duração.
         avg(coalesce(a.percentual, 0::numeric)) as percentual_medio,
         count(*) as total_tarefas,
         count(*) filter (where coalesce(a.percentual, 0::numeric) >= 100::numeric)
           as tarefas_concluidas
    from cronograma_tarefas t
    left join vw_avanco_atual a on a.cronograma_tarefa_id = t.id
   group by t.obra_id
)
select o.id as obra_id,
       orcado.orcamento_versao_id,
       coalesce(orcado.valor_orcado_total, 0::numeric) as valor_orcado_total,
       coalesce(fisico.total_tarefas, 0::bigint)::integer as total_tarefas,
       coalesce(fisico.tarefas_concluidas, 0::bigint)::integer as tarefas_concluidas,
       coalesce(fisico.percentual_medio, 0::numeric) as percentual_fisico,
       /*
        * Segue a MESMA régua do percentual, de propósito.
        *
        * Ninguém lê esta coluna hoje — conferido no código. Mas deixá-la com a
        * ponderação antiga criaria duas medidas de avanço na mesma view, e a
        * próxima pessoa a usá-la não teria como saber qual é a válida.
        */
       coalesce(orcado.valor_orcado_total, 0::numeric)
         * coalesce(fisico.percentual_medio, 0::numeric) / 100::numeric
         as valor_executado_ponderado
  from obras o
  left join orcado on orcado.obra_id = o.id
  left join fisico on fisico.obra_id = o.id;
