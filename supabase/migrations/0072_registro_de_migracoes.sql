-- Registro do que já foi aplicado neste banco.
--
-- O aplicador rodava o arquivo e pronto: não gravava em lugar nenhum que havia
-- rodado. Hoje não há como responder "a 0067 já foi aplicada nesta base?" senão
-- inspecionando o schema e deduzindo — e deduzir errado significa rodar duas
-- vezes (e algumas migrações deste projeto não são idempotentes) ou não rodar e
-- descobrir pelo erro em produção.
--
-- Com dev e produção no MESMO banco isso passou até aqui, porque há uma base só
-- e uma pessoa aplicando. É exatamente o arranjo que vai mudar: no dia em que
-- houver um banco de homologação, ou um segundo desenvolvedor, é onde se perde
-- a tarde.
--
-- O `checksum` existe para pegar o caso mais traiçoeiro: alguém edita um arquivo
-- de migração que JÁ foi aplicado. O banco segue com o conteúdo antigo, o
-- repositório mostra o novo, e as duas coisas divergem sem nenhum erro. O
-- aplicador compara e avisa.
create table if not exists schema_migracoes (
  nome text primary key,
  checksum text not null,
  aplicada_em timestamptz not null default now()
);

comment on table schema_migracoes is
  'O que o aplicador (scripts/aplicar-migracao.mjs) já rodou neste banco. `checksum` é o sha256 do arquivo no momento da aplicação — serve para detectar migração editada depois de aplicada.';

-- Sem RLS de propósito, e sem exposição: a tabela não entra na API.
--
-- `anon` e `authenticated` são os papéis que o PostgREST usa; revogar o acesso
-- deles tira a tabela da API REST por completo, que é o que se quer — isto é
-- ferramenta de quem aplica migração, não dado de aplicação. Como nenhum dos
-- dois papéis alcança a tabela, não há política de RLS a escrever.
revoke all on schema_migracoes from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Semeia com o que já está aplicado.
--
-- Todas as 71 migrações anteriores foram aplicadas nesta base — é o estado de
-- fato, e o schema prova (as tabelas, views e funções delas existem). O
-- checksum fica como 'anterior-ao-registro': não dá para calcular aqui dentro o
-- sha256 de um arquivo do repositório, e inventar um valor faria a primeira
-- conferência acusar divergência em todas elas.
--
-- O aplicador trata esse valor como "não sei o checksum" e não reclama; da
-- 0072 em diante o checksum é real.
insert into schema_migracoes (nome, checksum, aplicada_em)
select nome, 'anterior-ao-registro', now()
  from unnest(array[
    '0001','0002','0003','0004','0005','0006','0007','0008','0009','0010',
    '0011','0012','0013','0014','0015','0016','0017','0018','0019','0020',
    '0021','0022','0023','0024','0025','0026','0027','0028','0029','0030',
    '0031','0032','0033','0034','0035','0036','0037','0038','0039','0040',
    '0041','0042','0043','0044','0045','0046','0047','0048','0049','0050',
    '0051','0052','0053','0054','0055','0056','0057','0058','0059','0060',
    '0061','0062','0063','0064','0065','0066','0067','0068','0069','0070',
    '0071'
  ]) as nome
on conflict (nome) do nothing;
