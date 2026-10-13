-- Diário de obra: dois campos de texto livre e o fim da umidade.
--
-- O que motivou os dois campos é a mesma lacuna, vista de dois lados: o
-- diário só mostra o que já foi LANÇADO em outra tela. Equipamento que entrou
-- na obra sem locação registrada — emprestado, do próprio pessoal, com o
-- financeiro ainda por lançar — simplesmente não existia na folha; entrega que
-- chegou sem ordem de compra cadastrada, idem. O engenheiro está em obra com o
-- celular na mão e precisa poder escrever "betoneira do Zé" sem antes abrir
-- cadastro de fornecedor.
--
-- São campos do diário, não snapshots: o texto é digitado, não derivado de
-- outra tela, então não há o que congelar no fechamento.

alter table diario_obra
  add column if not exists equipamentos_extras text,
  add column if not exists entregas_extras text;

comment on column diario_obra.equipamentos_extras is
  'Equipamentos em obra que não vêm de locacoes_equipamento. Texto livre, uma linha por item.';

comment on column diario_obra.entregas_extras is
  'Entregas recebidas que não vêm de uma ordem de compra. Texto livre, uma linha por item.';

-- A umidade sai do RDO.
--
-- Era pedida junto da temperatura e quase nunca preenchida: medir umidade
-- exige instrumento que não está no bolso de ninguém, e o campo em branco
-- imprimia "—" numa linha do documento. A temperatura fica, que essa o
-- celular informa.
--
-- A COLUNA permanece, nullable e sem uso. Apagá-la levaria junto o que já foi
-- anotado em folhas fechadas, e folha fechada é documento — não se reescreve
-- para limpar um campo que saiu de moda. Nada mais lê nem escreve nela.
comment on column diario_obra.umidade is
  'DESCONTINUADA em 2026-10. Mantida apenas pelos registros historicos; nenhuma tela le ou escreve.';
