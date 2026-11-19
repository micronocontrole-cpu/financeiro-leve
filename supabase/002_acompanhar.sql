-- Micro no Controle — Acompanhe seu pedido/serviço
-- O negócio cria um acompanhamento e manda o link; o cliente abre e vê em que etapa está
-- (recebido, em preparo, saiu, pronto...). Responde à reclamação nº 1 das avaliações:
-- esperar sem notícia.
-- Rodar no Supabase: SQL Editor > New query > colar tudo > Run. Pode rodar de novo sem problema.
-- Depende do 001_agenda.sql (tabela negocios, função meu_negocio e tocar_atualizado).

create table if not exists public.acompanhamentos (
  id            uuid primary key default gen_random_uuid(),
  negocio       uuid not null references public.negocios(id) on delete cascade,
  token         text not null unique default encode(extensions.gen_random_bytes(9), 'hex'),
  cliente_nome  text check (cliente_nome is null or char_length(cliente_nome) <= 60),
  titulo        text not null check (char_length(titulo) between 1 and 80),
  etapas        text[] not null check (array_length(etapas, 1) between 2 and 8),
  etapa         int not null default 0,
  previsao      timestamptz,
  recado        text check (recado is null or char_length(recado) <= 200),
  local_id      text,
  encerrado     boolean not null default false,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint etapa_valida check (etapa >= 0 and etapa < array_length(etapas, 1))
);
create index if not exists acompanhamentos_negocio on public.acompanhamentos (negocio, atualizado_em desc);

alter table public.acompanhamentos enable row level security;
revoke all on public.acompanhamentos from anon;
grant select, insert, update, delete on public.acompanhamentos to authenticated;

drop policy if exists dono_acompanhamentos on public.acompanhamentos;
create policy dono_acompanhamentos on public.acompanhamentos for all to authenticated
  using (negocio = (select public.meu_negocio())) with check (negocio = (select public.meu_negocio()));

drop trigger if exists acompanhamentos_atualizado on public.acompanhamentos;
create trigger acompanhamentos_atualizado before update on public.acompanhamentos
  for each row execute function public.tocar_atualizado();

-- O cliente vê o próprio acompanhamento pelo token do link.
-- Só o primeiro nome do cliente sai daqui; o link para de funcionar 30 dias depois da última mudança.
create or replace function public.ver_acompanhamento(p_token text) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
           'negocio', n.nome, 'whatsapp', n.whatsapp,
           'titulo', a.titulo, 'cliente', split_part(coalesce(a.cliente_nome, ''), ' ', 1),
           'etapas', a.etapas, 'etapa', a.etapa, 'previsao', a.previsao, 'recado', a.recado,
           'encerrado', a.encerrado, 'atualizado', a.atualizado_em)
    from public.acompanhamentos a join public.negocios n on n.id = a.negocio
   where a.token = p_token and char_length(p_token) between 12 and 40
     and a.atualizado_em > now() - interval '30 days'
$$;
revoke all on function public.ver_acompanhamento(text) from public;
grant execute on function public.ver_acompanhamento(text) to anon, authenticated;
