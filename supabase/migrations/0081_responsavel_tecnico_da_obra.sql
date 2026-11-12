-- Quem assina o RDO passa a ser o responsável técnico DA OBRA.
--
-- Até aqui, quem assinava era quem FECHOU o dia (`diario_obra.fechado_por`),
-- com quem estivesse na tela como alternativa. Parecia razoável e está errado:
-- o responsável técnico é um fato do contrato da obra, não do expediente de
-- quem registrou o dia. Em produção isso já aconteceu — o RDO de 10/11/2026 foi
-- fechado pelo Ardiles e saiu com o nome dele no campo "RESPONSÁVEL TÉCNICO",
-- sem CREA (ele não tem) e sem assinatura.
--
-- E não era só a assinatura: a LOGO do cabeçalho também vinha do perfil de
-- quem fechava. Um dia fechado por quem não tem logo cadastrada imprimia o
-- documento sem a marca da construtora.
--
-- Com a coluna, os três — nome, CREA e assinatura — e a logo passam a sair de
-- um lugar só, que não muda conforme quem mexeu no diário.
--
-- Fica NULA quando não definida, e o RDO volta ao comportamento antigo nesse
-- caso. Obra sem responsável definido continua imprimindo o que sempre
-- imprimiu, em vez de perder a assinatura de uma vez.

alter table obras add column responsavel_tecnico_id uuid references profiles(id) on delete set null;

comment on column obras.responsavel_tecnico_id is
  'Engenheiro que responde tecnicamente pela obra. É dele o nome, o CREA, a assinatura e a logo no RDO — independente de quem registrou ou fechou o dia. Nulo volta ao comportamento antigo (quem fechou).';

create index if not exists idx_obras_responsavel_tecnico on obras(responsavel_tecnico_id);

/*
 * Backfill: quem criou a obra.
 *
 * É o palpite certo aqui — as duas obras foram criadas pelo Thiago, que é o
 * único com CREA e assinatura cadastrados, e é de fato o responsável técnico.
 * Só preenche quando o criador ainda tem o papel de engenheiro: cliente não
 * assina RDO, e uma obra criada por alguém que depois virou cliente não pode
 * herdar um responsável inválido.
 */
update obras o
   set responsavel_tecnico_id = o.criado_por
  from profiles p
 where p.id = o.criado_por
   and 'engenheiro' = any (p.papeis)
   and o.responsavel_tecnico_id is null;

/*
 * O responsável técnico tem de ser engenheiro — e isso é gatilho, não `check`.
 *
 * `check` não pode consultar outra tabela: a restrição seria avaliada só na
 * escrita da linha de `obras` e não acompanharia uma mudança em `profiles`.
 * O gatilho recusa na origem, que é onde o erro aparece com mensagem útil.
 */
create or replace function public.trg_responsavel_tecnico_engenheiro()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.responsavel_tecnico_id is not null
     and not exists (
       select 1 from profiles
        where id = new.responsavel_tecnico_id
          and 'engenheiro' = any (papeis)
     )
  then
    raise exception 'O responsável técnico precisa ter o perfil de engenheiro.';
  end if;
  return new;
end;
$$;

create trigger trg_obras_responsavel_tecnico
  before insert or update of responsavel_tecnico_id on obras
  for each row execute function public.trg_responsavel_tecnico_engenheiro();
