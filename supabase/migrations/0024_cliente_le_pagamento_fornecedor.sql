-- O cliente precisa dos dados de pagamento do fornecedor.
--
-- Em muitas obras é o próprio cliente quem paga a ordem de compra e anexa o
-- comprovante — o fluxo já existe (`pagar_parcela` aceita cliente, e a policy
-- `cli_insert_comprovantes_pagamento` permite o upload). Sem a chave pix e a
-- condição, ele não consegue pagar.
--
-- Por que não voltar as colunas para `fornecedores`: aquela tabela tem
-- `any_select_fornecedores`, que libera QUALQUER autenticado a ler QUALQUER
-- fornecedor. Os dados bancários entrariam nesse mesmo alcance irrestrito, e um
-- cliente leria a chave pix de um fornecedor que só atende obra de outro
-- cliente.
--
-- Mantendo em tabela separada, o acesso é exatamente o necessário: o cliente lê
-- o pagamento apenas de fornecedores que aparecem em compras das obras a que
-- ele tem acesso.

create policy cli_select_fornecedor_pagamento on fornecedor_pagamento
  for select using (
    exists (
      select 1 from compras c
      where c.fornecedor_id = fornecedor_pagamento.fornecedor_id
        and cliente_tem_acesso_obra(c.obra_id)
    )
  );

-- Os vendedores (`fornecedor_contatos`) seguem só do engenheiro: são o
-- relacionamento comercial dele, e não são necessários para pagar. Se um dia
-- fizer sentido o cliente falar direto com o vendedor, a policy se adiciona
-- aqui — de propósito não foi feita agora.
