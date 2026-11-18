-- =====================================================================
-- Micro no Controle · Agenda online (link para o cliente marcar)
-- Cole tudo no SQL Editor do Supabase e toque em "Run". Pode rodar de novo
-- sem problema (só cria o que ainda não existe e atualiza as funções).
--
-- Segurança:
--  • Cada negócio só enxerga e mexe nos próprios dados (RLS).
--  • O cliente que marca pelo link NÃO acessa as tabelas: ele só usa três
--    funções públicas (ver a página, ver horários livres, pedir horário).
--  • A trava contra dois no mesmo horário fica no próprio banco
--    (constraint "sem_conflito"): mesmo dois pedidos no mesmo segundo,
--    só um entra.
-- =====================================================================

create extension if not exists btree_gist with schema extensions;
create extension if not exists pgcrypto with schema extensions;

-- ---------- tabelas ----------
create table if not exists public.negocios (
  id              uuid primary key default gen_random_uuid(),
  dono            uuid not null unique default auth.uid() references auth.users(id) on delete cascade,
  slug            text not null unique check (slug ~ '^[a-z0-9]([a-z0-9-]{1,38})[a-z0-9]$'),
  nome            text not null check (char_length(nome) between 2 and 80),
  whatsapp        text check (whatsapp is null or char_length(whatsapp) <= 20),
  fuso            text not null default 'America/Sao_Paulo',
  aceitar_auto    boolean not null default false,  -- true = horário livre já entra confirmado
  antecedencia    int not null default 60  check (antecedencia between 0 and 10080),  -- minutos
  dias_a_frente   int not null default 30  check (dias_a_frente between 1 and 120),
  passo           int not null default 15  check (passo in (5, 10, 15, 20, 30, 60)),  -- grade de horários
  espera_resposta int not null default 120 check (espera_resposta between 10 and 1440), -- minutos que o pedido segura o horário
  ativo           boolean not null default true,
  criado_em       timestamptz not null default now()
);

create table if not exists public.servicos (
  id       uuid primary key default gen_random_uuid(),
  negocio  uuid not null references public.negocios(id) on delete cascade,
  nome     text not null check (char_length(nome) between 1 and 60),
  minutos  int  not null check (minutos between 5 and 600),
  preco    numeric(10,2) check (preco is null or preco >= 0),
  ativo    boolean not null default true,
  ordem    int not null default 0
);
create index if not exists servicos_negocio on public.servicos(negocio);

create table if not exists public.expediente (
  id          uuid primary key default gen_random_uuid(),
  negocio     uuid not null references public.negocios(id) on delete cascade,
  dia_semana  smallint not null check (dia_semana between 0 and 6),  -- 0 = domingo
  inicio      time not null,
  fim         time not null,
  check (fim > inicio)
);
create index if not exists expediente_negocio on public.expediente(negocio);

create table if not exists public.horarios (
  id            uuid primary key default gen_random_uuid(),
  negocio       uuid not null references public.negocios(id) on delete cascade,
  periodo       tstzrange not null check (not isempty(periodo) and lower(periodo) is not null and upper(periodo) is not null),
  status        text not null check (status in ('pendente','confirmado','bloqueio','atendido','recusado','cancelado','expirado','faltou')),
  ocupa         boolean generated always as (status in ('pendente','confirmado','bloqueio','atendido')) stored,
  servico       uuid references public.servicos(id) on delete set null,
  servico_nome  text check (servico_nome is null or char_length(servico_nome) <= 60),
  preco         numeric(10,2),
  cliente_nome  text check (cliente_nome is null or char_length(cliente_nome) <= 80),
  cliente_fone  text check (cliente_fone is null or char_length(cliente_fone) <= 20),
  obs           text check (obs is null or char_length(obs) <= 300),
  origem        text not null default 'app' check (origem in ('app','link')),
  expira_em     timestamptz,
  token         text,               -- o cliente usa para acompanhar o pedido
  local_id      text,               -- id do lançamento no celular (sincronização)
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint sem_conflito exclude using gist (negocio with =, periodo with &&) where (ocupa)
);
create index if not exists horarios_negocio_periodo on public.horarios using gist (negocio, periodo);
create unique index if not exists horarios_local_id on public.horarios(negocio, local_id) where local_id is not null;

-- ---------- segurança (RLS) ----------
alter table public.negocios   enable row level security;
alter table public.servicos   enable row level security;
alter table public.expediente enable row level security;
alter table public.horarios   enable row level security;

revoke all on public.negocios, public.servicos, public.expediente, public.horarios from anon;
grant select, insert, update, delete on public.negocios, public.servicos, public.expediente, public.horarios to authenticated;

create or replace function public.meu_negocio() returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.negocios where dono = auth.uid()
$$;
revoke all on function public.meu_negocio() from public, anon;
grant execute on function public.meu_negocio() to authenticated;

drop policy if exists dono_negocio on public.negocios;
create policy dono_negocio on public.negocios for all to authenticated
  using (dono = (select auth.uid())) with check (dono = (select auth.uid()));

drop policy if exists dono_servicos on public.servicos;
create policy dono_servicos on public.servicos for all to authenticated
  using (negocio = (select public.meu_negocio())) with check (negocio = (select public.meu_negocio()));

drop policy if exists dono_expediente on public.expediente;
create policy dono_expediente on public.expediente for all to authenticated
  using (negocio = (select public.meu_negocio())) with check (negocio = (select public.meu_negocio()));

drop policy if exists dono_horarios on public.horarios;
create policy dono_horarios on public.horarios for all to authenticated
  using (negocio = (select public.meu_negocio())) with check (negocio = (select public.meu_negocio()));

create or replace function public.tocar_atualizado() returns trigger language plpgsql as $$
begin new.atualizado_em := now(); return new; end $$;
drop trigger if exists horarios_atualizado on public.horarios;
create trigger horarios_atualizado before update on public.horarios for each row execute function public.tocar_atualizado();

-- ---------- funções internas ----------
-- Pedidos sem resposta deixam de segurar o horário depois do prazo
create or replace function public._expirar(p_negocio uuid) returns void
language sql security definer set search_path = public as $$
  update public.horarios set status = 'expirado'
   where negocio = p_negocio and status = 'pendente' and expira_em is not null and expira_em < now();
$$;
revoke all on function public._expirar(uuid) from public, anon, authenticated;

-- Antes de gravar um horário, libera os pedidos vencidos daquele negócio
create or replace function public._antes_horario() returns trigger
language plpgsql security definer set search_path = public as $$
begin perform public._expirar(new.negocio); return new; end $$;
revoke all on function public._antes_horario() from public, anon, authenticated;
drop trigger if exists horarios_expirar on public.horarios;
create trigger horarios_expirar before insert on public.horarios for each row execute function public._antes_horario();

-- Horários livres de um dia para um serviço (lista de inícios)
create or replace function public._livres(p_negocio uuid, p_dia date, p_minutos int) returns setof timestamptz
language sql stable security definer set search_path = public as $$
  with n as (select * from public.negocios where id = p_negocio),
  cand as (
    select (gs.t at time zone n.fuso) as ini
      from n
      join public.expediente e on e.negocio = n.id and e.dia_semana = extract(dow from p_dia)::int
      cross join lateral generate_series(p_dia + e.inicio, p_dia + e.fim - make_interval(mins => p_minutos), make_interval(mins => n.passo)) as gs(t)
  )
  select c.ini from cand c, n
   where c.ini >= now() + make_interval(mins => n.antecedencia)
     and c.ini <  now() + make_interval(days => n.dias_a_frente + 1)
     and not exists (
       select 1 from public.horarios h
        where h.negocio = p_negocio and h.ocupa
          and not (h.status = 'pendente' and h.expira_em is not null and h.expira_em < now())
          and h.periodo && tstzrange(c.ini, c.ini + make_interval(mins => p_minutos), '[)'))
   order by 1
$$;
revoke all on function public._livres(uuid, date, int) from public, anon, authenticated;

-- ---------- funções públicas (usadas pela página do cliente) ----------
-- 1) Dados da página: nome do negócio e serviços
create or replace function public.pagina_publica(p_slug text) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'nome', n.nome, 'slug', n.slug, 'dias_a_frente', n.dias_a_frente, 'aceitar_auto', n.aceitar_auto,
    'tem_whatsapp', n.whatsapp is not null and n.whatsapp <> '',
    'servicos', coalesce((select json_agg(json_build_object('id', s.id, 'nome', s.nome, 'minutos', s.minutos, 'preco', s.preco) order by s.ordem, s.nome)
                            from public.servicos s where s.negocio = n.id and s.ativo), '[]'::json),
    'dias_semana', coalesce((select json_agg(distinct e.dia_semana) from public.expediente e where e.negocio = n.id), '[]'::json))
  from public.negocios n where n.slug = lower(p_slug) and n.ativo
$$;

-- 2) Horários livres de um dia
create or replace function public.horarios_livres(p_slug text, p_dia date, p_servico uuid) returns setof timestamptz
language plpgsql stable security definer set search_path = public as $$
declare n public.negocios; s public.servicos;
begin
  select * into n from public.negocios where slug = lower(p_slug) and ativo;
  if not found then return; end if;
  select * into s from public.servicos where id = p_servico and negocio = n.id and ativo;
  if not found then return; end if;
  return query select * from public._livres(n.id, p_dia, s.minutos);
end $$;

-- 3) Pedir horário. Devolve {ok, id, token, status} ou {ok:false, motivo, sugestoes}
create or replace function public.pedir_horario(p_slug text, p_servico uuid, p_inicio timestamptz, p_nome text, p_fone text, p_obs text default null)
returns json language plpgsql volatile security definer set search_path = public, extensions as $$
declare n public.negocios; s public.servicos; v_id uuid; v_token text; v_status text; v_fone text; v_dia date; v_sug json;
begin
  select * into n from public.negocios where slug = lower(p_slug) and ativo;
  if not found then return json_build_object('ok', false, 'motivo', 'pagina'); end if;
  select * into s from public.servicos where id = p_servico and negocio = n.id and ativo;
  if not found then return json_build_object('ok', false, 'motivo', 'servico'); end if;
  p_nome := btrim(coalesce(p_nome, '')); v_fone := regexp_replace(coalesce(p_fone, ''), '\D', '', 'g');
  if char_length(p_nome) < 2 or char_length(p_nome) > 80 then return json_build_object('ok', false, 'motivo', 'nome'); end if;
  if char_length(v_fone) < 10 or char_length(v_fone) > 13 then return json_build_object('ok', false, 'motivo', 'fone'); end if;
  -- limite contra abuso: no máximo 3 pedidos em aberto por telefone
  if (select count(*) from public.horarios where negocio = n.id and cliente_fone = v_fone and status = 'pendente'
        and (expira_em is null or expira_em > now())) >= 3 then
    return json_build_object('ok', false, 'motivo', 'limite');
  end if;
  perform public._expirar(n.id);
  v_dia := (p_inicio at time zone n.fuso)::date;
  if not exists (select 1 from public._livres(n.id, v_dia, s.minutos) x where x = p_inicio) then
    select coalesce(json_agg(x order by x), '[]'::json) into v_sug from (
      select x from public._livres(n.id, v_dia, s.minutos) x order by abs(extract(epoch from x - p_inicio)) limit 3) q;
    return json_build_object('ok', false, 'motivo', 'ocupado', 'sugestoes', v_sug);
  end if;
  v_status := case when n.aceitar_auto then 'confirmado' else 'pendente' end;
  v_token := encode(extensions.gen_random_bytes(12), 'hex');
  begin
    insert into public.horarios (negocio, periodo, status, servico, servico_nome, preco, cliente_nome, cliente_fone, obs, origem, expira_em, token)
    values (n.id, tstzrange(p_inicio, p_inicio + make_interval(mins => s.minutos), '[)'), v_status, s.id, s.nome, s.preco, p_nome, v_fone,
            nullif(left(btrim(coalesce(p_obs, '')), 300), ''), 'link',
            case when v_status = 'pendente' then now() + make_interval(mins => n.espera_resposta) end, v_token)
    returning id into v_id;
  exception when exclusion_violation then
    select coalesce(json_agg(x order by x), '[]'::json) into v_sug from (
      select x from public._livres(n.id, v_dia, s.minutos) x order by abs(extract(epoch from x - p_inicio)) limit 3) q;
    return json_build_object('ok', false, 'motivo', 'ocupado', 'sugestoes', v_sug);
  end;
  return json_build_object('ok', true, 'id', v_id, 'token', v_token, 'status', v_status);
end $$;

-- 4) O cliente acompanha o próprio pedido (precisa do token que recebeu)
create or replace function public.status_pedido(p_id uuid, p_token text) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object('status', case when h.status = 'pendente' and h.expira_em < now() then 'expirado' else h.status end,
                           'inicio', lower(h.periodo), 'servico', h.servico_nome, 'negocio', n.nome,
                           'whatsapp', case when h.status in ('confirmado','recusado','expirado') or h.expira_em < now() then n.whatsapp end)
    from public.horarios h join public.negocios n on n.id = h.negocio
   where h.id = p_id and h.token = p_token
$$;

-- 5) O cliente cancela o próprio pedido
create or replace function public.cancelar_pedido(p_id uuid, p_token text) returns boolean
language sql volatile security definer set search_path = public as $$
  update public.horarios set status = 'cancelado'
   where id = p_id and token = p_token and status in ('pendente','confirmado') and lower(periodo) > now()
  returning true
$$;

revoke all on function public.pagina_publica(text), public.horarios_livres(text, date, uuid),
  public.pedir_horario(text, uuid, timestamptz, text, text, text), public.status_pedido(uuid, text), public.cancelar_pedido(uuid, text) from public;
grant execute on function public.pagina_publica(text), public.horarios_livres(text, date, uuid),
  public.pedir_horario(text, uuid, timestamptz, text, text, text), public.status_pedido(uuid, text), public.cancelar_pedido(uuid, text) to anon, authenticated;

-- ---------- tempo real: o app do negócio recebe o pedido na hora ----------
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'horarios') then
    alter publication supabase_realtime add table public.horarios;
  end if;
end $$;
