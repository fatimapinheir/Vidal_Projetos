-- A soma dos resultados do filtro, na lista de ordens de compra.
--
-- Precisa vir do banco, e não de somar as linhas na tela, por duas razões que
-- se somam: a lista é paginada de 25 em 25, então somar o que está na tela
-- responderia "quanto há nesta página" em vez de "quanto o filtro encontrou";
-- e trazer todas as linhas só para somá-las esbarraria no teto de 1000 do
-- PostgREST, que corta em silêncio — a soma ficaria errada sem erro nenhum,
-- exatamente a armadilha que a paginação foi criada para evitar.
--
-- `security invoker` (o padrão) de propósito: a RLS vale para quem chamou. O
-- engenheiro soma as obras dele; o cliente, se um dia a tela dele usar isto,
-- soma a obra a que tem acesso.
create or replace function public.somar_compras_da_obra(
  p_obra_id uuid,
  p_tipo text default null,
  p_busca text default null
)
returns numeric
language sql
stable
set search_path = public
as $$
  with filtro as (
    select case
      when p_busca is null or btrim(translate(p_busca, '%_\,()*', '')) = '' then null
      /*
       * Os curingas do LIKE e os caracteres com significado no PostgREST são
       * REMOVIDOS, não escapados.
       *
       * Escapar seria mais correto — procurar "50%" acharia o literal. Mas a
       * listagem monta o filtro dela pelo PostgREST, do outro lado, e as duas
       * precisam encontrar exatamente o mesmo conjunto: senão a tela mostra
       * "8 resultados" e soma um nono. Remover é a única regra que as duas
       * expressam igual sem truque. Sem isto, um "%" digitado na busca casaria
       * com tudo e a soma passaria a ser a da obra inteira.
       */
      else '%' || btrim(translate(p_busca, '%_\,()*', '')) || '%'
    end as termo
  )
  select coalesce(sum(c.valor_total), 0)
  from compras c
  left join fornecedores f on f.id = c.fornecedor_id
  cross join filtro
  where c.obra_id = p_obra_id
    and (p_tipo is null or c.tipo_item = p_tipo)
    -- As MESMAS três condições da listagem em
    -- `app/(engenheiro)/obras/[obraId]/compras/page.tsx`. Divergindo, a soma
    -- deixa de ser a dos resultados mostrados.
    and (
      filtro.termo is null
      or c.descricao ilike filtro.termo
      or f.nome ilike filtro.termo
    );
$$;

grant execute on function public.somar_compras_da_obra(uuid, text, text) to authenticated;
