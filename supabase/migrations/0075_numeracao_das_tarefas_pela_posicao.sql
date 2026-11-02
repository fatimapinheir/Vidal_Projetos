-- Põe os números das tarefas de acordo com a posição delas.
--
-- O número ("3.4") sempre viveu dentro do nome, digitado — veio assim do
-- template e da planilha importada. E envelheceu: conferido antes desta
-- migração, o número batia com a posição em apenas 117 das 243 tarefas.
-- Apagar uma tarefa deixava buraco na sequência, e o engenheiro via "3.1, 3.2,
-- 3.4, 3.5" sem ter como corrigir — o nome nem era editável.
--
-- Daqui para frente quem mantém é `reordenarEtapaPorData`, que já roda depois
-- de criar, editar e apagar tarefa. Esta migração acerta o que está gravado.
--
-- POR QUE O NÚMERO FICA NO NOME, e não é calculado na tela: o diário e o RDO
-- congelam o nome da tarefa num snapshot quando o dia é fechado. Número
-- calculado não entra em snapshot, e os relatórios que o cliente recebe
-- passariam a dizer "Concretagem da laje" em vez de "3.8 Concretagem da laje".
-- Ver a nota em `lib/cronograma/numeracao`.
--
-- A ordem usada é a mesma da tela: `ordem`, com `created_at` desempatando.
-- `ordem` hoje não é confiável como posição — numa das obras ela é global
-- (1..132) em vez de por etapa, e na outra tem buracos —, mas serve para
-- ORDENAR, que é o que importa aqui. A posição vem do `row_number`.
--
-- A expressão que tira o prefixo exige ao menos um ponto, igual à de
-- `semNumero`: "2 camadas de impermeabilização" não é numeração e fica
-- inteira.
do $$
declare
  v_renomeadas integer;
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
     -- Só o que de fato muda: evita reescrever 243 linhas para acertar 126.
     and p.nome_atual <> (p.etapa_ordem || '.' || p.posicao || ' ' || p.descricao);

  get diagnostics v_renomeadas = row_count;
  raise notice 'Tarefas renumeradas: %', v_renomeadas;
end $$;
