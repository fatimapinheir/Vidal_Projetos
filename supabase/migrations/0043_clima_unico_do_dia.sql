-- Clima do dia: um campo, não três.
--
-- O RDO pedia manhã, tarde e noite. Na prática o engenheiro preenchia zero:
-- dos três diários lançados, dois não têm nenhuma condição marcada — um deles
-- tem temperatura e umidade anotadas e o clima em branco, o que mostra que
-- ele chegou até ali e desistiu no campo seguinte. Três selects para uma
-- informação que o relatório imprime como UMA linha ("CONDIÇÃO") é custo sem
-- contrapartida.
--
-- A coluna nova nasce preenchida pela mesma regra que as telas já usavam para
-- resumir os três: vence a pior condição do dia. É ela que explica o ritmo da
-- obra — um dia que começou de sol e virou chuva forte é um dia de chuva
-- forte, não de sol.
alter table diario_obra add column if not exists clima diario_condicao;

update diario_obra
set clima = case
  when 'chuva_forte' in (clima_manha, clima_tarde, clima_noite) then 'chuva_forte'::diario_condicao
  when 'chuvoso'     in (clima_manha, clima_tarde, clima_noite) then 'chuvoso'::diario_condicao
  when 'nublado'     in (clima_manha, clima_tarde, clima_noite) then 'nublado'::diario_condicao
  when 'ensolarado'  in (clima_manha, clima_tarde, clima_noite) then 'ensolarado'::diario_condicao
  else null
end
where clima is null;

comment on column diario_obra.clima is
  'Condição do tempo do dia. Substitui clima_manha/tarde/noite — ver 0044.';
