-- Devolve âncora às tarefas que ficaram sem predecessora e sem data.
--
-- `cronograma_dependencias` cascateia ao apagar a tarefa: as sucessoras dela
-- perdem a ligação, e as que não tinham data própria ficam sem nada que diga
-- quando começam. O CPM então recusa calcular a obra INTEIRA — e a mensagem
-- fala da tarefa órfã, que não é a que o engenheiro está mexendo. Na CASA
-- VIDAL ALPHA foi isto: das 136 tarefas do template sobraram 130, e
-- "Alvenaria do térreo" perdeu a predecessora numa dessas exclusões.
--
-- O código já remenda a corrente antes de excluir (ver `remendarCorrente`),
-- então isto aqui é o passivo.
--
-- Fixa a data que a tarefa JÁ MOSTRA (`data_inicio_cedo`), em vez de inventar
-- uma ligação: o cronograma na tela não se move, e quem quiser encadear
-- escolhe a predecessora no diálogo. Inventar a corrente seria adivinhar qual
-- tarefa deveria vir antes.
update cronograma_tarefas t
set restricao_inicio_nao_antes_de = t.data_inicio_cedo
where t.restricao_inicio_nao_antes_de is null
  and t.data_inicio_cedo is not null
  and not exists (
    select 1 from cronograma_dependencias d where d.tarefa_sucessora_id = t.id
  );
