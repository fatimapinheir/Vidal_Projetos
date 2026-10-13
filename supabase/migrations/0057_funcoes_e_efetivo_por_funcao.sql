-- O efetivo do dia contado por FUNÇÃO, e um cadastro de funções para sustentá-lo.
--
-- O diário listava o efetivo por nome, vindo das presenças lançadas. Isso
-- responde "quem", e a pergunta que se faz numa obra é "quantos de cada
-- função" — numa frente com dois pedreiros e seis ajudantes de duas equipes,
-- ninguém reconhece os nomes, e o RDO sempre imprimiu a contagem por função.
--
-- Pior: a contagem por nome só existia para quem estava CADASTRADO e alocado.
-- O caso comum é o contrário — a equipe do Jocélio chega com três pessoas e só
-- o Jocélio está no cadastro. O efetivo do dia não é a lista de funcionários
-- da empresa; é quem pisou na obra naquele dia.
--
-- Então o diário ganha uma contagem própria, digitada: função e quantidade.
-- Ela NÃO substitui as presenças individuais — essas continuam alimentando o
-- fechamento de folha, que é cálculo por pessoa e por diária. São duas
-- perguntas diferentes sobre o mesmo dia, e por ora convivem; o encontro das
-- duas no fechamento fica para depois.

-- ---------------------------------------------------------------------------
-- 1. Cadastro de funções
--
-- A função era texto livre em `trabalhadores.funcao`, e o resultado está no
-- banco: "Ajudante" e "Ajudante ", "Mestre de Obra" e "Mestre de obras",
-- "pedreuri". Cada variação vira uma linha separada no RDO. Com cadastro, a
-- função passa a ser escolhida; criar uma nova continua a um clique, mas é um
-- ato consciente em vez de um erro de digitação.
create table if not exists funcoes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

-- Índice sobre `lower(btrim(...))`: é ele que impede "Pedreiro" e "pedreiro "
-- de voltarem a existir lado a lado.
create unique index if not exists idx_funcoes_nome_unico
  on funcoes (lower(btrim(nome)));

-- Semeia com o que já existe, limpo e sem repetição. `distinct on` com a mesma
-- expressão do índice — senão o insert tropeçaria nas próprias duplicatas.
insert into funcoes (nome)
select distinct on (lower(btrim(funcao))) btrim(funcao)
from trabalhadores
where funcao is not null and btrim(funcao) <> ''
order by lower(btrim(funcao)), btrim(funcao)
on conflict do nothing;

alter table funcoes enable row level security;

create policy eng_all_funcoes on funcoes
  for all using (is_engenheiro()) with check (is_engenheiro());

-- O cliente lê: o nome da função aparece no RDO que ele abre no portal.
create policy cli_select_funcoes on funcoes for select
  using (auth.uid() is not null);

-- ---------------------------------------------------------------------------
-- 2. O efetivo do dia, por função
create table if not exists diario_efetivo_funcoes (
  id uuid primary key default gen_random_uuid(),
  diario_id uuid not null references diario_obra(id) on delete cascade,
  funcao_id uuid not null references funcoes(id),
  quantidade int not null check (quantidade > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Uma linha por função no dia: duas linhas de "Pedreiro" seriam duas
  -- respostas para a mesma pergunta.
  unique (diario_id, funcao_id)
);

create index if not exists idx_efetivo_funcoes_diario on diario_efetivo_funcoes(diario_id);

alter table diario_efetivo_funcoes enable row level security;

create policy eng_all_efetivo_funcoes on diario_efetivo_funcoes
  for all using (is_engenheiro()) with check (is_engenheiro());

-- Mesma regra do diário: o cliente só enxerga dia FECHADO, e só da obra dele.
-- Sem a cláusula de `fechado_em`, o efetivo de um rascunho vazaria para o
-- portal antes de o engenheiro enviar a folha.
create policy cli_select_efetivo_funcoes on diario_efetivo_funcoes for select
  using (
    exists (
      select 1 from diario_obra d
      where d.id = diario_efetivo_funcoes.diario_id
        and d.fechado_em is not null
        and cliente_tem_acesso_obra(d.obra_id)
    )
  );

comment on table diario_efetivo_funcoes is
  'Quantas pessoas de cada funcao estiveram na obra no dia. Digitado no diario, independe de cadastro de colaborador.';
