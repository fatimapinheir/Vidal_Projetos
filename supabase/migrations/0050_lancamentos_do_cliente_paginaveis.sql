-- A lista de pagamentos do cliente, achatada numa view — para poder ser
-- filtrada e paginada no banco.

-- ---------------------------------------------------------------------------
-- Por que uma view, e não mais um filtro na consulta
--
-- A tela do portal lista parcelas e busca por DESCRIÇÃO ou FORNECEDOR. Hoje a
-- descrição está em `compras` e o nome do fornecedor em `fornecedores`, as duas
-- alcançadas por relação embutida — e o PostgREST não faz "ou" entre relações
-- embutidas. O jeito que restava era trazer tudo e filtrar em memória, que é
-- exatamente o que não escala: o PostgREST corta em 1000 linhas, em silêncio, e
-- uma obra com muitas parcelas passaria a esconder pagamentos sem avisar.
--
-- Achatando numa view, busca e paginação viram `or(...)` e `range(...)` do lado
-- do banco, e a lista volta a ser completa por construção.
--
-- `security_invoker` mantém a RLS de quem consulta: o cliente continua vendo só
-- as obras dele, exatamente como antes.
-- ---------------------------------------------------------------------------
create or replace view vw_lancamentos_cliente with (security_invoker = true) as
select
  p.id,
  p.compra_id,
  c.obra_id,
  p.numero_parcela,
  p.valor,
  p.data_vencimento,
  p.status,
  p.status_efetivo,
  p.liberada_para_pagamento,
  p.pagamento_enviado_em,
  p.entrega_prevista_ordem,
  p.entrega_real_ordem,
  p.pagamento_apos_recebimento,
  c.descricao,
  c.tipo_item,
  c.forma_pagamento,
  c.eh_lancamento,
  c.criado_por,
  coalesce(f.nome, '—') as fornecedor_nome
from vw_compra_parcelas p
join compras c on c.id = p.compra_id
left join fornecedores f on f.id = c.fornecedor_id;

grant select on vw_lancamentos_cliente to authenticated;

-- ---------------------------------------------------------------------------
-- O resumo por forma de pagamento, somado no banco
--
-- Ele fala da OBRA INTEIRA, não da página — "quanto vai sair em boleto" não
-- muda porque alguém foi para a página 3. Trazer todas as parcelas só para
-- somá-las no JavaScript seria reintroduzir a consulta sem limite que a
-- paginação acabou de remover.
-- ---------------------------------------------------------------------------
create or replace view vw_lancamentos_resumo_forma with (security_invoker = true) as
select
  c.obra_id,
  c.forma_pagamento,
  sum(p.valor) as total
from compra_parcelas p
join compras c on c.id = p.compra_id
group by c.obra_id, c.forma_pagamento;

grant select on vw_lancamentos_resumo_forma to authenticated;
