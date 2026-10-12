-- Nota fiscal da compra, e itens no lançamento financeiro.

-- ---------------------------------------------------------------------------
-- 1. Nota fiscal
--
-- Duas colunas e nenhum booleano "tem nota": o número presente JÁ é a
-- resposta. Guardar a marcação em separado abriria o estado impossível de
-- "tem nota = sim" com número vazio, e alguma tela acabaria confiando no
-- booleano em vez do dado. O checkbox existe só no formulário, para revelar
-- os campos.
-- ---------------------------------------------------------------------------
alter table compras
  add column if not exists nota_fiscal_numero text,
  add column if not exists nota_fiscal_emissao date;

comment on column compras.nota_fiscal_numero is
  'Número da NF. Nulo quando a compra não tem nota.';

-- ---------------------------------------------------------------------------
-- 2. O cliente pode itemizar o lançamento dele
--
-- Mesma fronteira das outras duas policies de cliente (0045): só em linha
-- marcada como lançamento e em obra dele. Sem isto, o formulário aceitaria
-- itens e o insert falharia calado no meio do registro.
--
-- Consequência útil de deixar o item na mesma tabela: o gatilho
-- `trg_compra_itens_recalcula` recalcula `compras.valor_total` a partir dos
-- itens, então o lançamento itemizado soma sozinho — sem segunda conta no
-- código da aplicação.
-- ---------------------------------------------------------------------------
create policy cli_insert_item_lancamento on compra_itens for insert
  with check (
    exists (
      select 1 from compras c
      where c.id = compra_itens.compra_id
        and c.eh_lancamento
        and cliente_tem_acesso_obra(c.obra_id)
    )
  );
