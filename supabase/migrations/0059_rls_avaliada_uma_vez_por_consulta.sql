-- A regra de acesso deixa de ser reavaliada linha a linha.
--
-- O SINTOMA: o sistema ficou lento, e de um jeito que não batia com o tamanho
-- dos dados. A maior tabela do banco tem 790 linhas.
--
-- A CAUSA: `pg_stat_user_tables` mostrava 1.149.674 varreduras sequenciais em
-- `profiles` — uma tabela de OITO linhas. Toda policy chamava `is_engenheiro()`
-- solta no `using`, e nessa forma o Postgres trata a função como filtro de
-- linha: executa uma vez POR LINHA VARRIDA. Como `is_engenheiro()` por dentro
-- faz `select exists (select 1 from profiles where id = auth.uid())`, carregar
-- 790 itens de orçamento disparava 790 consultas a `profiles`.
--
-- Era por isso que a lentidão crescia com o número de LINHAS e não com o
-- volume de dados, e por isso a tela de orçamento era a pior de todas.
--
-- A CORREÇÃO: envolver a chamada numa subconsulta. `(select is_engenheiro())`
-- não depende de nenhuma coluna, então o planejador a reconhece como InitPlan
-- e a executa UMA VEZ por consulta, guardando o resultado. É o mesmo predicado,
-- com o mesmo resultado para toda linha — o que muda é quantas vezes ele roda.
--
-- Medido antes de escrever isto, em transação revertida:
--
--   orcamento_itens (790 linhas)  35,0 ms -> 0,5 ms   (70x)
--   cronograma_tarefas (284)      11,2 ms -> 0,3 ms   (37x)
--   compras + fornecedor (70)      9,9 ms -> 0,6 ms   (16x)
--   busca no SINAPI               13,1 ms -> 1,2 ms   (11x)
--
-- A reescrita é feita em laço, e não em 44 `alter policy` escritos à mão, por
-- uma razão de segurança: escrever à mão exigiria transcrever o predicado
-- inteiro de cada policy, e um erro de transcrição numa regra de acesso é um
-- vazamento. O laço só INSERE a subconsulta em volta da chamada; o resto do
-- predicado é o texto que já estava lá.

do $$
declare
  p record;
  novo_qual text;
  novo_check text;
  partes text;
  total int := 0;
begin
  for p in
    select schemaname, tablename, policyname,
           qual::text as qual, with_check::text as wc
    from pg_policies
    where schemaname in ('public', 'storage')
      and (qual::text like '%is_engenheiro()%' or with_check::text like '%is_engenheiro()%')
      -- Idempotência: policy já envolvida não é tocada de novo. Sem isto, uma
      -- segunda execução aninharia `(select (select is_engenheiro()))`.
      and coalesce(qual::text, '') not like '%SELECT is_engenheiro%'
      and coalesce(with_check::text, '') not like '%SELECT is_engenheiro%'
  loop
    novo_qual  := replace(p.qual, 'is_engenheiro()', '( SELECT is_engenheiro())');
    novo_check := replace(p.wc,   'is_engenheiro()', '( SELECT is_engenheiro())');

    -- `using` existe em select/update/delete/all; `with check` em
    -- insert/update/all. Montar só o que a policy tem evita erro de sintaxe.
    partes := '';
    if novo_qual is not null then
      partes := format(' using (%s)', novo_qual);
    end if;
    if novo_check is not null then
      partes := partes || format(' with check (%s)', novo_check);
    end if;

    execute format('alter policy %I on %I.%I%s',
                   p.policyname, p.schemaname, p.tablename, partes);
    total := total + 1;
  end loop;

  raise notice 'policies reescritas: %', total;
end $$;

-- ---------------------------------------------------------------------------
-- O mesmo tratamento dentro das funções de acesso.
--
-- `auth.uid()` lê a configuração da sessão a cada chamada. Envolver em
-- subconsulta rende o mesmo InitPlan — menor que o ganho das policies, porque
-- aqui ela já roda uma vez só por chamada da função, mas é de graça.
--
-- `cliente_tem_acesso_obra` recebe o `obra_id` da linha como argumento, então
-- ela CONTINUA sendo avaliada por linha: o argumento muda. Só o `auth.uid()`
-- de dentro é hasteado. Tratar o caso do cliente de verdade exigiria reescrever
-- o predicado das policies dele para `obra_id in (select ...)`, que é mudança
-- de forma, não de embrulho — fica para quando a lentidão aparecer no portal.
create or replace function public.is_engenheiro()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles where id = (select auth.uid()) and role = 'engenheiro'
  );
$$;

create or replace function public.cliente_tem_acesso_obra(p_obra_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from obra_clientes
    where obra_id = p_obra_id and cliente_id = (select auth.uid())
  );
$$;

-- ---------------------------------------------------------------------------
-- Busca no SINAPI por trigrama.
--
-- `descricao ilike '%concreto%'` não usa índice comum — o curinga à esquerda
-- impede. O resultado estava em 498 buscas lendo 1.404.842 linhas: varredura
-- completa das 3.041 em cada tecla digitada. O índice GIN de trigrama é feito
-- exatamente para o curinga dos dois lados.
create extension if not exists pg_trgm;

create index if not exists idx_sinapi_itens_descricao_trgm
  on sinapi_itens using gin (descricao gin_trgm_ops);

create index if not exists idx_sinapi_itens_codigo_trgm
  on sinapi_itens using gin (codigo gin_trgm_ops);

-- A mesma busca existe no orçamento da obra, sobre a descrição do item.
create index if not exists idx_orcamento_itens_descricao_trgm
  on orcamento_itens using gin (descricao gin_trgm_ops);

-- E na listagem de ordens de compra, que busca por descrição e por fornecedor.
create index if not exists idx_compras_descricao_trgm
  on compras using gin (descricao gin_trgm_ops);

create index if not exists idx_fornecedores_nome_trgm
  on fornecedores using gin (nome gin_trgm_ops);

analyze profiles, sinapi_itens, orcamento_itens, compras, fornecedores;
