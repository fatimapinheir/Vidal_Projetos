-- ---------------------------------------------------------------------------
-- Permissão: registrar pagamento sem comprovante
--
-- Hoje o comprovante é obrigatório em três pontos, e a razão está escrita em
-- `app/actions/lancamentos.ts`: o lançamento descreve dinheiro que JÁ SAIU, e
-- "sem ele seria uma afirmação sem lastro dentro do custo da obra". Esse
-- raciocínio continua valendo — por isso a obrigatoriedade segue sendo o
-- PADRÃO, e dispensá-la passa a ser exceção nomeada, concedida a quem se
-- confia para responder pelo número sem papel.
--
-- Nada muda no esquema: `compra_parcelas.comprovante_pagamento_path` já é
-- nulo-aceitável desde a 0002. A exigência sempre viveu na aplicação, o que
-- torna esta mudança puramente de permissão.
--
-- ATENÇÃO ao que esta permissão NÃO faz: ela não vale para cliente. `pode()`
-- exige `role = 'engenheiro'`, então quem registra pagamento pelo portal
-- continua obrigado a anexar, independente de qualquer linha aqui. É o
-- desejado: o lançamento do cliente é a única escrita financeira aberta a ele,
-- e é justamente a que mais precisa de lastro.
-- ---------------------------------------------------------------------------

insert into permissoes_catalogo (acao, grupo, rotulo, descricao, ordem) values
  ('pagamento.sem_comprovante', 'Compras', 'Registrar pagamento sem comprovante',
   'Dispensa o anexo ao lançar pagamento ou marcar parcela como paga. Sem esta chave o comprovante é obrigatório — é ele que separa um custo registrado de uma afirmação sem lastro. Não vale para o portal do cliente, onde o anexo é sempre exigido.',
   75)
on conflict (acao) do nothing;

/*
 * Só o Thiago, a pedido.
 *
 * Diferente das treze permissões da 0082, esta NÃO é concedida ao Ardiles: lá
 * o objetivo era preservar o que ele já podia, e isto é capacidade NOVA — não
 * existia para ninguém até agora. Conceder a quem não pediu seria inventar
 * poder.
 *
 * O Thiago é administrador e já passaria em qualquer ação sem esta linha. Ela
 * existe para a intenção sobreviver: se um dia ele deixar de administrar, a
 * chave continua ligada, em vez de desaparecer em silêncio.
 */
insert into permissoes_usuario (usuario_id, acao)
select id, 'pagamento.sem_comprovante'
from profiles
where email = 'thiagovidal09@icloud.com'
on conflict (usuario_id, acao) do nothing;
