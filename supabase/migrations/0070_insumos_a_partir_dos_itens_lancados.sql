-- O catálogo nasce com o que já foi digitado à mão, e todo item passa a virar cadastro.
--
-- Na 0067 eu decidi que o catálogo nasceria vazio, "da mão do engenheiro, limpo".
-- Errei a dose: misturei duas coisas diferentes sob a mesma justificativa.
--
-- Ela valia para os 64 itens do backfill da 0069, cuja descrição é prosa
-- ("barrote, chapa, tabua de pinus, chapa madeirite"), e para os 6 gerados pela
-- locação mensal, que o sistema cria sozinho. Não valia para os 27 que alguém
-- digitou item por item: "Barrote de Pinus 5x5", "Cimento Apodi", "Tijolo
-- Vermelho Tavares", "Tubo PVC soldável 25mm". São nomes limpos, específicos e
-- com a unidade certa — jogá-los fora e pedir para digitar de novo é a
-- repetição que o catálogo existe para acabar.
--
-- Conferido antes: nenhuma das 27 descrições se repete, e nenhuma tem conflito
-- de unidade ou de categoria entre as linhas onde aparece. A importação entra
-- sem decisão linha por linha.
--
-- Duas coisas ficam como estão, porque corrigi-las aqui seria inventar dado que
-- ninguém afirmou — e a tela de insumos resolve as duas em dois cliques:
--
--   * "Entrega" e "Taxa de Entrega" são a mesma coisa escrita de dois jeitos;
--   * "Ensaio SPT" e "Entrega" entraram como material e são serviço. A categoria
--     foi HERDADA da ordem pela 0068, não escolhida para o item.

-- ---------------------------------------------------------------------------
-- 1. Os insumos, a partir dos itens digitados
do $$
declare
  v_criados integer;
  v_vinculados integer;
  v_sem_categoria integer;
begin
  /*
   * Quem entra: item de compra que NÃO é de locação e NÃO é do backfill.
   *
   * O backfill se reconhece por ser a cópia literal da descrição da compra com
   * quantidade 1 — foi exatamente assim que a 0069 o gravou.
   */
  create temporary table candidatos on commit drop as
  select distinct on (lower(btrim(i.descricao)))
         btrim(i.descricao) descricao,
         i.unidade,
         i.categoria_custo
    from compra_itens i
    join compras co on co.id = i.compra_id
   where co.locacao_id is null
     and not (i.descricao = btrim(co.descricao) and i.quantidade = 1)
   order by lower(btrim(i.descricao)), i.descricao;

  select count(*) into v_sem_categoria from candidatos where categoria_custo is null;
  if v_sem_categoria > 0 then
    -- `insumos.categoria_custo` é NOT NULL: insumo sem categoria de custo não
    -- classifica gasto nenhum. Fica de fora e é dito em voz alta, em vez de
    -- entrar com um palpite.
    raise notice 'Itens sem categoria de custo, deixados fora do catálogo: %', v_sem_categoria;
  end if;

  insert into insumos (descricao, categoria_custo, unidade)
  select descricao, categoria_custo, unidade
    from candidatos
   where categoria_custo is not null
  -- O índice único é sobre lower(btrim(descricao)): se a migração rodar duas
  -- vezes, a segunda não duplica nada.
  on conflict do nothing;

  get diagnostics v_criados = row_count;
  raise notice 'Insumos criados a partir dos itens já lançados: %', v_criados;

  -- ---------------------------------------------------------------------------
  -- 2. O histórico passa a apontar para o catálogo
  --
  -- `descricao` e `unidade` continuam gravadas no item — são a cópia do que foi
  -- comprado, e não mudam se o insumo for renomeado. O vínculo só acrescenta a
  -- pergunta "quais compras usaram este insumo", que antes não tinha resposta.
  -- A condição sobre `compras` vai num EXISTS, e não num join do FROM: o
  -- Postgres não deixa a tabela sendo atualizada ser referenciada dentro da
  -- condição de join do FROM ("invalid reference to FROM-clause entry").
  update compra_itens i
     set insumo_id = ins.id
    from insumos ins
   where lower(btrim(i.descricao)) = lower(btrim(ins.descricao))
     and i.insumo_id is null
     and exists (
       select 1
         from compras co
        where co.id = i.compra_id
          and co.locacao_id is null
          and not (i.descricao = btrim(co.descricao) and i.quantidade = 1)
     );

  get diagnostics v_vinculados = row_count;
  raise notice 'Itens de compra vinculados ao catálogo: %', v_vinculados;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Quem pode cadastrar insumo
--
-- Passa a ser qualquer pessoa autenticada, e não só o engenheiro.
--
-- Isso reverte a decisão de que o cliente não cadastraria, e o motivo é que ela
-- deixou de ser possível. O item virou OBRIGATÓRIO no lançamento (0069 e a ação
-- `criarLancamento`), o cliente registra despesa da obra dele pelo portal, e a
-- saída que ele tinha — o "item avulso", que descrevia o gasto sem criar
-- cadastro — deixou de existir: agora todo item digitado vira insumo. Sem esta
-- policy ele não conseguiria lançar nada.
--
-- O risco é o mesmo que o projeto já aceita em `categorias_financeiras`, que o
-- cliente também cria pelo portal: a tabela é uma lista de rótulos, sem valor e
-- sem vínculo com obra. E o índice único sobre lower(btrim(descricao)) impede a
-- pior consequência — "barrote" e "Barrote" lado a lado.
create policy cli_insert_insumos on insumos for insert
  with check (auth.uid() is not null);

comment on policy cli_insert_insumos on insumos is
  'Cliente também cadastra: o item é obrigatório no lançamento do portal e não há mais item sem cadastro. Ver a 0070.';
