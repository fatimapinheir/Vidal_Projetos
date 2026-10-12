-- Remove as três colunas de clima por período, substituídas por `clima`.
--
-- Separada da 0043 de propósito: aquela é aditiva e já rodou, esta é
-- destrutiva. Rodar as duas juntas significaria apagar a origem dos dados no
-- mesmo passo que os copia, sem janela para conferir a cópia.
--
-- Antes de rodar, confira que a cópia está certa:
--
--   select data, clima_manha, clima_tarde, clima_noite, clima from diario_obra;
--
-- `clima` deve trazer a pior condição entre as três. Nenhuma view ou índice
-- depende das colunas antigas — verificado em information_schema.views e
-- pg_indexes.
alter table diario_obra
  drop column if exists clima_manha,
  drop column if exists clima_tarde,
  drop column if exists clima_noite;
