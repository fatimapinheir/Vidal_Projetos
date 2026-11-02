-- Devolve o número às tarefas que o perderam numa edição que falhou.
--
-- A 0075 passou a numerar pela posição, e o formulário passou a mandar só a
-- descrição — quem põe o número é a renumeração, que roda depois do recálculo
-- do cronograma. Faltou proteger o intervalo entre as duas coisas: quando o
-- recálculo estourava, a renumeração nunca rodava e o nome ficava gravado
-- pelado.
--
-- Estourava de verdade. Na CASA VIDAL ALPHA o cronograma não fechava — ver a
-- correção em `lib/cronograma/cpm.ts` —, então QUALQUER edição caía nesse
-- caminho. Duas tarefas da etapa "3.0 — Estrutura de concreto e lajes" ficaram
-- assim: "Concretagem laje 1" e "Concretagem laje 2".
--
-- As duas causas já estão corrigidas no código: o número é recolocado no
-- momento de gravar o nome, e a renumeração passou a rodar mesmo quando o
-- cálculo falha. Esta migração acerta o que ficou gravado.
--
-- Mesma expressão e mesma ordem da 0075, para o resultado ser idêntico ao que
-- a renumeração produziria.
do $$
declare
  v_corrigidas integer;
begin
  with posicionadas as (
    select t.id,
           e.ordem as etapa_ordem,
           row_number() over (partition by t.etapa_id order by t.ordem, t.created_at) as posicao,
           regexp_replace(t.nome, '^\s*\d+(\.\d+)+\s+', '') as descricao,
           t.nome as nome_atual
      from cronograma_tarefas t
      join cronograma_etapas e on e.id = t.etapa_id
  )
  update cronograma_tarefas t
     set nome = p.etapa_ordem || '.' || p.posicao || ' ' || p.descricao
    from posicionadas p
   where p.id = t.id
     and p.nome_atual <> (p.etapa_ordem || '.' || p.posicao || ' ' || p.descricao);

  get diagnostics v_corrigidas = row_count;
  raise notice 'Tarefas com o número devolvido: %', v_corrigidas;
end $$;
