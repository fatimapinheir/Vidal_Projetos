-- Como o colaborador é pago.
--
-- São duas perguntas diferentes, e o cadastro passa a responder as duas:
--
--   regime_pagamento — em que condição ele trabalha: por diária (conta dias ×
--                      valor) ou por pacote de serviço (valor fechado pelo
--                      serviço, sem contagem de dias).
--   forma_pagamento  — por onde o dinheiro sai: pix, transferência, dinheiro...
--                      Reaproveita o enum já usado nas ordens de compra, porque
--                      é exatamente o mesmo conceito.
--   dados_pagamento  — a chave pix, a conta, o que for necessário para pagar.
--
-- `dados_pagamento` é dado pessoal sensível (chave pix costuma ser CPF ou
-- telefone). A tabela `trabalhadores` já é restrita ao engenheiro pela RLS —
-- o cliente não a acessa —, então o campo herda essa proteção. Não mova esta
-- coluna para nenhuma view ou tabela que o cliente enxergue.

create type regime_pagamento as enum ('diaria', 'pacote_servico');

alter table trabalhadores
  add column regime_pagamento regime_pagamento not null default 'diaria',
  add column forma_pagamento forma_pagamento,
  add column dados_pagamento text;
