-- ---------------------------------------------------------------------------
-- Comprovante opcional: NULL de verdade, e a regra no banco
--
-- A 0083 criou a permissão `pagamento.sem_comprovante`. Esta migração arruma
-- duas consequências que a aplicação sozinha não resolve bem.
--
-- 1) STRING VAZIA NÃO É NULL. As RPCs recebem `p_comprovante_path text` e
--    gravavam o valor cru. Sem anexo, a aplicação passaria `''`, e
--    `comprovante_pagamento_path = ''` é um registro que PARECE ter
--    comprovante. Isso não é estético: as migrações 0054 e 0064 decidem a
--    mensalidade da locação com `comprovante_pagamento_path is not null`, e
--    uma string vazia entraria como "pago com comprovante". O `nullif` fecha
--    isso para qualquer chamador, agora e no futuro.
--
-- 2) A REGRA PASSA A VALER NO BANCO. A exigência do comprovante vivia só na
--    Server Action. Quem chamasse a RPC direto, com o próprio token, pulava a
--    checagem. Como a permissão existe justamente para controlar quem pode
--    dispensar o anexo, deixá-la fora do banco seria controle de fachada.
--
-- Para o CLIENTE nada muda, e isso é de propósito: `pode()` exige
-- `role = 'engenheiro'`, então quem paga pelo portal continua obrigado a
-- anexar. É a única escrita financeira aberta a ele e a que mais precisa de
-- lastro.
-- ---------------------------------------------------------------------------

create or replace function public.pagar_parcela(p_parcela_id uuid, p_comprovante_path text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_obra_id uuid;
  v_comprovante text := nullif(p_comprovante_path, '');
begin
  select c.obra_id into v_obra_id from compra_parcelas cp
  join compras c on c.id = cp.compra_id
  where cp.id = p_parcela_id and c.status = 'aprovada';
  if v_obra_id is null then raise exception 'Parcela não encontrada ou compra não aprovada'; end if;
  if not cliente_tem_acesso_obra(v_obra_id) and not is_engenheiro() then
    raise exception 'Acesso negado';
  end if;

  if v_comprovante is null and not pode('pagamento.sem_comprovante') then
    raise exception 'Anexe o comprovante de pagamento.';
  end if;

  update compra_parcelas set status = 'paga', data_pagamento = current_date,
    comprovante_pagamento_path = v_comprovante, updated_at = now()
  where id = p_parcela_id;
end;
$$;

create or replace function public.aprovar_e_pagar_parcela(
  p_compra_id uuid,
  p_parcela_id uuid,
  p_comprovante_path text
)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_obra_id uuid;
  v_comprovante text := nullif(p_comprovante_path, '');
begin
  select obra_id into v_obra_id from compras where id = p_compra_id and status = 'cotada';
  if v_obra_id is null then raise exception 'Compra não encontrada ou já processada'; end if;

  if not cliente_tem_acesso_obra(v_obra_id) and not is_engenheiro() then
    raise exception 'Acesso negado';
  end if;

  if v_comprovante is null and not pode('pagamento.sem_comprovante') then
    raise exception 'Anexe o comprovante de pagamento.';
  end if;

  -- A parcela precisa ser desta compra: sem isso, um id de parcela de outra
  -- ordem seria pago junto com a aprovação desta.
  if not exists (select 1 from compra_parcelas where id = p_parcela_id and compra_id = p_compra_id) then
    raise exception 'Parcela não pertence a essa ordem de compra';
  end if;

  update compras set status = 'aprovada', aprovado_por = auth.uid(), aprovado_em = now(), updated_at = now()
  where id = p_compra_id;

  update compra_parcelas set status = 'paga', data_pagamento = current_date,
    comprovante_pagamento_path = v_comprovante, updated_at = now()
  where id = p_parcela_id;
end;
$$;

/*
 * E o lançamento, que grava a parcela por insert e não por estas RPCs.
 *
 * `criarLancamento` insere a parcela já paga direto na tabela, então o
 * `nullif` acima não a alcança. Uma restrição na coluna resolve de uma vez,
 * para qualquer caminho: caminho de comprovante ou é nulo, ou tem conteúdo.
 * String vazia deixa de ser representável.
 */
update compra_parcelas
set comprovante_pagamento_path = null
where comprovante_pagamento_path = '';

alter table compra_parcelas
  add constraint compra_parcelas_comprovante_nao_vazio
  check (comprovante_pagamento_path is null or length(trim(comprovante_pagamento_path)) > 0);
