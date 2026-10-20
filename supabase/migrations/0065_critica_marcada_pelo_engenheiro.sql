-- Tarefa crítica passa a ser MARCADA, não calculada.
--
-- Até aqui `critica` era resultado do CPM: a cada recálculo o motor sobrescrevia
-- a coluna com `folga_dias <= 0`. Duas coisas davam errado nisso.
--
-- A primeira é que `<= 0` juntava duas situações diferentes sob o mesmo badge
-- vermelho. Folga zero é "não pode atrasar"; folga NEGATIVA é "já atrasou e o
-- fim da obra já escorregou". Em CASA VIDAL ALPHA eram 52 marcadas, das quais 12
-- só estavam atrasadas — a 1.1 Limpeza do terreno com folga de -17 dias.
--
-- A segunda é que o cálculo só diz algo quando existe rede de dependências. Em
-- CASA THAIS E RAFA, cujas 132 tarefas foram importadas de planilha sem nenhum
-- vínculo, cada tarefa flutuava com a própria âncora: deu UMA crítica, a última
-- a terminar. O indicador não informava nada naquela obra.
--
-- Quem sabe o que é crítico é o engenheiro, e ele sabe por motivos que não
-- estão no grafo: concretagem com caminhão agendado, equipe que vem de fora,
-- material de prazo longo, exigência do cliente. Agora ele marca.
--
-- A coluna não muda de forma — já é `boolean not null default false`. O que
-- muda é quem escreve nela: antes `recalcularCronograma`, agora os diálogos de
-- tarefa e a marcação em lote da tabela. As marcas existentes ficam de pé, como
-- ponto de partida para o engenheiro corrigir à mão; nada é apagado aqui.
--
-- `folga_dias` e as datas tarde CONTINUAM sendo calculadas pelo CPM: elas são
-- informação de planejamento ("Margem: 4d" no detalhe da barra) e seguem
-- derivadas das durações e dos vínculos. O que saiu do cálculo é só a
-- criticidade.
comment on column public.cronograma_tarefas.critica is
  'Marcada pelo engenheiro, não calculada. Era derivada do CPM (folga_dias <= 0) até a migração 0065 — ver o comentário dela. Escrita pelos diálogos de tarefa e pela marcação em lote da tabela do cronograma.';

comment on column public.cronograma_tarefas.folga_dias is
  'Calculada pelo CPM: dias que a tarefa pode atrasar sem empurrar o fim da obra. Negativa significa atraso já acumulado. Não controla mais a coluna critica.';
