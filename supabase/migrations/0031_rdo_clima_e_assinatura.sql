-- Diário de obra no formato RDO: condição climática, medições e assinatura.
--
-- 1. O clima deixa de ser praticável/chuva/impraticável e passa a descrever o
--    tempo (ensolarado, nublado, chuvoso, chuva forte), como pede o relatório.
--
--    Os quatro valores foram escolhidos para COLAPSAR no critério antigo: o
--    calendário de clima e o indicador "dias parados" continuam funcionando
--    porque chuva forte mapeia em impraticável e chuvoso em chuva. Trocar por
--    valores que não mapeassem mataria as duas telas em silêncio.
--
-- 2. Temperatura e umidade são informadas à mão. Não há serviço de clima
--    integrado, e inventar número em documento assinado não é opção.
--
-- 3. CREA e assinatura moram no profile, não no diário: são do engenheiro, e
--    repeti-los em cada dia faria uma troca de registro exigir reescrever o
--    histórico.

create type diario_condicao as enum ('ensolarado', 'nublado', 'chuvoso', 'chuva_forte');

alter table diario_obra
  alter column clima_manha type diario_condicao using (
    case clima_manha
      when 'praticavel' then 'ensolarado'
      when 'chuva' then 'chuvoso'
      when 'impraticavel' then 'chuva_forte'
    end::diario_condicao
  ),
  alter column clima_tarde type diario_condicao using (
    case clima_tarde
      when 'praticavel' then 'ensolarado'
      when 'chuva' then 'chuvoso'
      when 'impraticavel' then 'chuva_forte'
    end::diario_condicao
  ),
  alter column clima_noite type diario_condicao using (
    case clima_noite
      when 'praticavel' then 'ensolarado'
      when 'chuva' then 'chuvoso'
      when 'impraticavel' then 'chuva_forte'
    end::diario_condicao
  );

drop type diario_clima;

alter table diario_obra
  add column temperatura numeric(4,1),
  add column umidade integer,
  add constraint diario_umidade_percentual check (umidade is null or (umidade between 0 and 100));

alter table profiles
  add column crea text,
  -- Caminho no bucket `assinaturas`; a imagem em si não vai para o banco.
  add column assinatura_path text;

-- Bucket privado: assinatura é dado pessoal, servida por URL assinada.
insert into storage.buckets (id, name, public) values ('assinaturas', 'assinaturas', false)
  on conflict (id) do nothing;

-- Cada um cuida da própria assinatura. Sem política de leitura ampla: quem
-- precisa dela para montar o RDO é o servidor, que usa a chave de serviço.
create policy assinatura_propria_select on storage.objects for select
  using (bucket_id = 'assinaturas' and owner = auth.uid());
create policy assinatura_propria_insert on storage.objects for insert
  with check (bucket_id = 'assinaturas' and owner = auth.uid());
create policy assinatura_propria_update on storage.objects for update
  using (bucket_id = 'assinaturas' and owner = auth.uid());
create policy assinatura_propria_delete on storage.objects for delete
  using (bucket_id = 'assinaturas' and owner = auth.uid());
