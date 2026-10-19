-- A listagem de ordens de compra ganha o que precisa para ser filtrada e
-- ordenada pelo banco.
--
-- Três coisas que a tabela `compras` sozinha não dá:
--
-- 1. O NOME DO FORNECEDOR. Ele mora em outra tabela, e o PostgREST não aceita
--    tabela embutida dentro de um `or` — a busca por texto precisava descobrir
--    antes quais fornecedores casavam e procurar pelos ids deles, em duas
--    consultas. Com o nome aqui, vira uma.
--
-- 2. A SITUAÇÃO FINANCEIRA da ordem, para ordenar por "vencida primeiro". Ela
--    é derivada das parcelas, e ordenar por algo derivado exige que o banco
--    conheça o valor — senão a ordenação só valeria dentro da página carregada,
--    que é o mesmo defeito que a paginação existe para evitar.
--
-- 3. O PRÓXIMO VENCIMENTO em aberto, que é o desempate natural entre ordens na
--    mesma situação.
--
-- A gravidade repete, em SQL, a ordem de `GRAVIDADE_FINANCEIRA` em
-- `lib/compras/situacao.ts`: vencido, em dia, pagamento enviado, aguardando
-- recebimento, pago. `min()` sobre o posto devolve a pior parcela, que é
-- exatamente o que `piorDe` faz do lado do TypeScript. As duas pontas têm de
-- concordar: ordenar por "vencida" e a linha mostrar "Em dia" seria pior que
-- não ordenar.
--
-- AVISO que já custou caro três vezes neste projeto (ver 0018, 0025 e 0046):
-- `c.*` congela a lista de colunas no momento da criação. Acrescentar coluna em
-- `compras` exige derrubar e recriar esta view.
drop view if exists vw_compras_lista;

create view vw_compras_lista with (security_invoker = true) as
select
  c.*,
  f.nome as fornecedor_nome,
  -- 99 para ordem sem parcela nenhuma: ela vai para o fim de qualquer
  -- ordenação por situação, que é onde uma ordem incompleta pertence.
  coalesce(s.ordem_situacao, 99) as ordem_situacao,
  s.proximo_vencimento,
  coalesce(s.parcelas_total, 0)::int as parcelas_total,
  coalesce(s.parcelas_pagas, 0)::int as parcelas_pagas
from compras c
left join fornecedores f on f.id = c.fornecedor_id
left join (
  select
    p.compra_id,
    min(
      case
        when p.status_efetivo = 'paga' then 5
        when not p.liberada_para_pagamento then 4
        when p.pagamento_enviado_em is not null then 3
        when p.status_efetivo = 'vencida' then 1
        else 2
      end
    ) as ordem_situacao,
    min(p.data_vencimento) filter (where p.status_efetivo <> 'paga') as proximo_vencimento,
    count(*) as parcelas_total,
    count(*) filter (where p.status_efetivo = 'paga') as parcelas_pagas
  from vw_compra_parcelas p
  group by p.compra_id
) s on s.compra_id = c.id;

grant select on vw_compras_lista to authenticated;

-- ---------------------------------------------------------------------------
-- A soma dos resultados acompanha os filtros novos.
--
-- O filtro por TIPO saiu: era uma suposição minha, e o que o engenheiro
-- precisa filtrar é período de lançamento e faixa de valor. Entram os dois.
--
-- Continua sendo função, e não soma no navegador, pela mesma razão de antes: a
-- lista é paginada de 25 em 25, e somar o que está na tela responderia "quanto
-- há nesta página" em vez de "quanto o filtro encontrou".
drop function if exists public.somar_compras_da_obra(uuid, text, text);

create or replace function public.somar_compras_da_obra(
  p_obra_id uuid,
  p_busca text default null,
  p_data_de date default null,
  p_data_ate date default null,
  p_valor_de numeric default null,
  p_valor_ate numeric default null
)
returns numeric
language sql
stable
set search_path = public
as $$
  with filtro as (
    select case
      when p_busca is null or btrim(translate(p_busca, '%_\,()*', '')) = '' then null
      -- Curingas e caracteres especiais do PostgREST são REMOVIDOS, não
      -- escapados: a listagem monta o filtro dela do outro lado, e as duas
      -- precisam encontrar o mesmo conjunto. Senão a tela diz "8 resultados" e
      -- soma um nono.
      else '%' || btrim(translate(p_busca, '%_\,()*', '')) || '%'
    end as termo
  )
  select coalesce(sum(v.valor_total), 0)
  from vw_compras_lista v
  cross join filtro
  where v.obra_id = p_obra_id
    and (p_data_de is null or v.data_cotacao >= p_data_de)
    and (p_data_ate is null or v.data_cotacao <= p_data_ate)
    and (p_valor_de is null or v.valor_total >= p_valor_de)
    and (p_valor_ate is null or v.valor_total <= p_valor_ate)
    and (
      filtro.termo is null
      or v.descricao ilike filtro.termo
      or v.fornecedor_nome ilike filtro.termo
    );
$$;

grant execute on function public.somar_compras_da_obra(uuid, text, date, date, numeric, numeric)
  to authenticated;
