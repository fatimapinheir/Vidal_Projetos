-- Locação cobrada por MÊS, com mensalidade que entra em contas a pagar.
--
-- O problema: locação tinha duas cobranças, por dia e por hora, e as duas são
-- CUSTO ACUMULADO — o valor sobe enquanto o equipamento está na obra e para na
-- devolução. Isso descreve bem um andaime alugado por diária, e descreve
-- pessimamente o contrato mensal, que é o caso comum: R$ 800 por mês, vencendo
-- todo dia 10. Esse contrato não é um custo que corre, é uma série de
-- obrigações com data. E como o diário financeiro do sistema inteiro é
-- `compra_parcelas`, a mensalidade simplesmente não existia em contas a pagar:
-- o engenheiro via o custo subir no gráfico de equipamentos e não tinha onde
-- lançar o pagamento.
--
-- A solução não cria um segundo universo de parcelas. A locação mensal passa a
-- gerar uma ORDEM DE COMPRA com uma parcela por mês, e daí para frente ela é
-- uma conta a pagar como qualquer outra: vence, aparece no painel, aceita
-- comprovante, aparece no portal do cliente. Nada disso precisou ser escrito
-- de novo.
--
-- Em troca, o custo da locação mensal deixa de sair da fórmula de dias: ele é
-- o valor da ordem. `calcularCustoLocacao` devolve zero para `mes`, e
-- `lib/obras/visao-geral` soma as ordens de locação em "Equipamentos" em vez
-- de deixá-las no balde de compras — senão o mesmo dinheiro apareceria duas
-- vezes no custo total.

alter type locacao_unidade add value if not exists 'mes';

alter table locacoes_equipamento
  add column if not exists data_primeiro_vencimento date,
  add column if not exists meses_contratados int;

alter table locacoes_equipamento
  drop constraint if exists chk_meses_contratados;
alter table locacoes_equipamento
  add constraint chk_meses_contratados
    check (meses_contratados is null or meses_contratados between 1 and 120);

comment on column locacoes_equipamento.data_primeiro_vencimento is
  'Vencimento da primeira mensalidade. Os seguintes caem no mesmo dia dos meses subsequentes. Só para unidade = mes.';
comment on column locacoes_equipamento.meses_contratados is
  'Quantas mensalidades o contrato prevê. Só para unidade = mes.';

-- O vínculo entre a ordem gerada e a locação que a gerou.
--
-- `on delete set null` e não `cascade`: a ordem pode ter parcela paga com
-- comprovante anexado, e apagar a locação não pode apagar o registro de um
-- pagamento que aconteceu. A ordem fica, órfã e legível.
alter table compras
  add column if not exists locacao_id uuid references locacoes_equipamento(id) on delete set null;

create index if not exists idx_compras_locacao on compras(locacao_id)
  where locacao_id is not null;

comment on column compras.locacao_id is
  'Preenchida quando a ordem foi gerada por uma locação mensal. Essas ordens contam como Equipamentos, nao como compras.';
