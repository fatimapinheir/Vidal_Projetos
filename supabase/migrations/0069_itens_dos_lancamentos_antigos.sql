-- Dá um item a cada lançamento que não tem nenhum.
--
-- Com item obrigatório no lançamento, os 64 que existem sem item ficariam
-- intocáveis: abrir qualquer um para corrigir uma data travaria na validação.
-- A pedido, eles são ajustados.
--
-- Um item por lançamento, com a descrição e o valor que já estão gravados:
-- quantidade 1, unidade UN, preço unitário igual ao valor total. A categoria de
-- custo vem da ordem (50 material, 8 mão de obra, 3 serviço, 3 sem categoria).
-- É o mesmo caminho que a 0011 usou quando `valor_total` virou derivado.
--
-- SEM VÍNCULO COM O CATÁLOGO, de propósito. A descrição desses lançamentos é
-- prosa, com quantidade e preço dentro do texto:
--
--   "3 telhas de 4 metros a 30 o metro / 30 parafusos a 4 reais"
--   "barrote, chapa, tabua de pinus, chapa madeirite."
--   "1 carrada de 6m3 areia , 1 carrada 6m3 brita"
--
-- Transformar isso em entrada de catálogo sujaria o cadastro no primeiro dia —
-- e o catálogo existe justamente para acabar com essa prosa. Ele nasce vazio e
-- é o engenheiro que o preenche, limpo.
--
-- O VALOR NÃO MUDA. `trg_compra_itens_recalcula` vai recalcular
-- `compras.valor_total` a partir do item inserido, e com quantidade 1, preço
-- igual ao total e nenhum desconto o resultado é o mesmo número. Conferido
-- antes: dos 64, nenhum tem desconto na nota, nenhum tem valor zero ou
-- negativo, todos têm exatamente uma parcela e em todos a parcela já bate com
-- o valor total. Por isso nenhuma parcela precisa ser mexida aqui.
do $$
declare
  v_n integer;
  v_divergentes integer;
begin
  insert into compra_itens
    (compra_id, descricao, unidade, quantidade, preco_unitario, categoria_custo, ordem)
  select c.id, btrim(c.descricao), 'UN', 1, c.valor_total, c.tipo_item, 1
    from compras c
   where c.eh_lancamento
     and not exists (select 1 from compra_itens i where i.compra_id = c.id);

  get diagnostics v_n = row_count;
  raise notice 'Lançamentos que ganharam item: %', v_n;

  -- Confere o que a migração prometeu: o total de cada compra continua igual à
  -- soma das parcelas dela. Divergindo, desfaz tudo em vez de deixar dinheiro
  -- desencontrado no banco.
  select count(*) into v_divergentes
    from compras c
    join (select compra_id, sum(valor) soma from compra_parcelas group by compra_id) p
      on p.compra_id = c.id
   where abs(c.valor_total - p.soma) > 0.01;

  if v_divergentes > 0 then
    raise exception 'O valor de % compra(s) deixou de bater com as parcelas — nada foi gravado.', v_divergentes;
  end if;
end $$;
