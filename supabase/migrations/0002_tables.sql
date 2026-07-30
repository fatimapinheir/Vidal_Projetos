-- Perfis (estende auth.users)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role user_role not null default 'cliente',
  nome text not null,
  telefone text,
  created_at timestamptz not null default now()
);

-- Cria o profile automaticamente quando um usuário é criado no Auth
-- (o engenheiro cria clientes via admin API passando raw_user_meta_data.role/nome)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, nome, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nome', new.email),
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'cliente')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Obras
create table obras (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  endereco text,
  tipo obra_tipo not null default 'residencial',
  status obra_status not null default 'planejamento',
  data_inicio date,
  data_fim_prevista date,
  criado_por uuid not null references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Vínculo obra <-> cliente (join table: suporta mais de um cliente por obra, ex. casal)
create table obra_clientes (
  obra_id uuid not null references obras(id) on delete cascade,
  cliente_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (obra_id, cliente_id)
);
create index idx_obra_clientes_cliente on obra_clientes(cliente_id);

-- Fornecedores
create table fornecedores (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cnpj_cpf text,
  telefone text,
  email text,
  observacoes text,
  created_at timestamptz not null default now()
);

-- Trabalhadores (reutilizáveis entre obras)
create table trabalhadores (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cpf text,
  funcao text,
  valor_diaria_padrao numeric(10,2),
  telefone text,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

-- Alocação de um trabalhador em uma obra, com diária específica daquela obra
create table obra_trabalhadores (
  obra_id uuid not null references obras(id) on delete cascade,
  trabalhador_id uuid not null references trabalhadores(id) on delete cascade,
  valor_diaria numeric(10,2) not null,
  data_inicio date not null default current_date,
  data_fim date,
  ativo boolean not null default true,
  primary key (obra_id, trabalhador_id)
);

-- Presenças diárias
create table presencas (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references obras(id) on delete cascade,
  trabalhador_id uuid not null references trabalhadores(id),
  data date not null,
  status presenca_status not null default 'presente',
  observacoes text,
  registrado_por uuid not null references profiles(id),
  created_at timestamptz not null default now(),
  unique (obra_id, trabalhador_id, data)
);
create index idx_presencas_obra_data on presencas(obra_id, data);

-- Fechamento de pagamento por período (folha de diárias)
create table fechamentos_periodo (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references obras(id) on delete cascade,
  trabalhador_id uuid not null references trabalhadores(id),
  periodo_inicio date not null,
  periodo_fim date not null,
  dias_trabalhados numeric(5,1) not null default 0,
  valor_diaria numeric(10,2) not null,
  valor_total numeric(12,2) generated always as (dias_trabalhados * valor_diaria) stored,
  status fechamento_status not null default 'aberto',
  data_pagamento date,
  comprovante_path text,
  observacoes text,
  criado_por uuid not null references profiles(id),
  created_at timestamptz not null default now(),
  unique (obra_id, trabalhador_id, periodo_inicio, periodo_fim)
);

-- Soma os dias trabalhados de um trabalhador numa obra dentro de um período
create or replace function public.calcular_dias_trabalhados(
  p_obra_id uuid, p_trabalhador_id uuid, p_inicio date, p_fim date
) returns numeric language sql stable as $$
  select coalesce(sum(case status
    when 'presente' then 1
    when 'meia_diaria' then 0.5
    else 0 end), 0)
  from presencas
  where obra_id = p_obra_id and trabalhador_id = p_trabalhador_id
    and data between p_inicio and p_fim;
$$;

-- Compras de material
create table compras (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references obras(id) on delete cascade,
  fornecedor_id uuid not null references fornecedores(id),
  descricao text not null,
  valor_total numeric(12,2) not null check (valor_total >= 0),
  forma_pagamento forma_pagamento not null,
  status compra_status not null default 'cotada',
  anexo_cotacao_path text,
  data_cotacao date not null default current_date,
  aprovado_por uuid references profiles(id),
  aprovado_em timestamptz,
  motivo_recusa text,
  criado_por uuid not null references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Parcelas de uma compra (vencimento e entrega podem divergir)
create table compra_parcelas (
  id uuid primary key default gen_random_uuid(),
  compra_id uuid not null references compras(id) on delete cascade,
  numero_parcela int not null,
  valor numeric(12,2) not null check (valor >= 0),
  data_vencimento date not null,
  data_entrega_prevista date,
  data_pagamento date,
  status parcela_status not null default 'pendente',
  comprovante_pagamento_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (compra_id, numero_parcela)
);
create index idx_parcelas_vencimento on compra_parcelas(data_vencimento) where status = 'pendente';
