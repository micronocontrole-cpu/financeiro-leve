-- Micro no Controle — planos pagos e código de ativação
-- Fase 1 (até ~10 clientes): o cliente paga por Pix, o dono do projeto gera um código de
-- ativação aqui no SQL Editor e manda pelo WhatsApp. O cliente digita o código no app
-- (Mais › Meu plano) e o plano fica ativo no aparelho dele. Sem cartão, sem e-mail.
-- Rodar no Supabase: SQL Editor > New query > colar tudo > Run. Pode rodar de novo.
-- Depende do 001_agenda.sql (função tocar_atualizado).

create table if not exists public.assinaturas (
  dono          uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  plano         text not null default 'gratis' check (plano in ('gratis', 'essencial', 'divulgacao', 'acompanhamento')),
  valida_ate    date,
  fundador      boolean not null default false,
  codigo        text,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
alter table public.assinaturas enable row level security;
revoke all on public.assinaturas from anon, authenticated;
grant select on public.assinaturas to authenticated;
drop policy if exists dono_assinatura on public.assinaturas;
create policy dono_assinatura on public.assinaturas for select to authenticated
  using (dono = (select auth.uid()));
drop trigger if exists assinaturas_atualizado on public.assinaturas;
create trigger assinaturas_atualizado before update on public.assinaturas
  for each row execute function public.tocar_atualizado();

-- Códigos: só o dono do projeto cria (pelo SQL Editor). Ninguém lê pela internet.
create table if not exists public.codigos_ativacao (
  codigo    text primary key check (codigo ~ '^MNC-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$'),
  plano     text not null check (plano in ('essencial', 'divulgacao', 'acompanhamento')),
  dias      int not null default 31 check (dias between 1 and 400),
  fundador  boolean not null default false,
  cliente   text check (cliente is null or char_length(cliente) <= 120),
  usado_por uuid references auth.users(id) on delete set null,
  usado_em  timestamptz,
  criado_em timestamptz not null default now()
);
alter table public.codigos_ativacao enable row level security;
revoke all on public.codigos_ativacao from anon, authenticated;

-- O app pergunta qual é o plano deste aparelho. Plano vencido volta a ser Grátis.
create or replace function public.meu_plano() returns json
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select json_build_object(
        'plano', case when a.valida_ate is not null and a.valida_ate < current_date then 'gratis' else a.plano end,
        'valida_ate', a.valida_ate, 'fundador', a.fundador,
        'vencido', a.valida_ate is not null and a.valida_ate < current_date and a.plano <> 'gratis',
        'plano_pago', a.plano)
       from public.assinaturas a where a.dono = auth.uid()),
    json_build_object('plano', 'gratis', 'valida_ate', null, 'fundador', false, 'vencido', false, 'plano_pago', 'gratis'));
$$;
revoke all on function public.meu_plano() from public, anon;
grant execute on function public.meu_plano() to authenticated;

-- O cliente digita o código; cada código vale uma vez. Os dias somam ao que ainda resta.
create or replace function public.ativar_codigo(p_codigo text) returns json
language plpgsql volatile security definer set search_path = public as $$
declare c public.codigos_ativacao; v_cod text; v_ate date; v_base date;
begin
  if auth.uid() is null then return json_build_object('ok', false, 'motivo', 'sessao'); end if;
  v_cod := upper(regexp_replace(coalesce(p_codigo, ''), '\s', '', 'g'));
  if v_cod !~ '^MNC-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$' then return json_build_object('ok', false, 'motivo', 'formato'); end if;
  select * into c from public.codigos_ativacao where codigo = v_cod for update;
  if not found then return json_build_object('ok', false, 'motivo', 'invalido'); end if;
  if c.usado_por is not null then
    if c.usado_por = auth.uid() then return json_build_object('ok', false, 'motivo', 'ja_usado_aqui'); end if;
    return json_build_object('ok', false, 'motivo', 'usado');
  end if;
  select greatest(coalesce(a.valida_ate, current_date), current_date) into v_base
    from public.assinaturas a where a.dono = auth.uid();
  v_ate := coalesce(v_base, current_date) + c.dias;
  insert into public.assinaturas (dono, plano, valida_ate, fundador, codigo)
    values (auth.uid(), c.plano, v_ate, c.fundador, c.codigo)
  on conflict (dono) do update set plano = excluded.plano, valida_ate = excluded.valida_ate,
    fundador = public.assinaturas.fundador or excluded.fundador, codigo = excluded.codigo;
  update public.codigos_ativacao set usado_por = auth.uid(), usado_em = now() where codigo = c.codigo;
  return json_build_object('ok', true, 'plano', c.plano, 'valida_ate', v_ate, 'fundador', c.fundador);
end $$;
revoke all on function public.ativar_codigo(text) from public, anon;
grant execute on function public.ativar_codigo(text) to authenticated;

-- Para o dono do projeto (só pelo SQL Editor): cria um código.
-- Exemplo: select public.novo_codigo('essencial', 31, true, 'Lanchonete do João');
create or replace function public.novo_codigo(p_plano text, p_dias int default 31, p_fundador boolean default false, p_cliente text default null)
returns text language plpgsql volatile security definer set search_path = public, extensions as $$
declare h text; v_cod text;
begin
  loop
    h := upper(encode(extensions.gen_random_bytes(6), 'hex'));
    v_cod := 'MNC-' || substr(h, 1, 4) || '-' || substr(h, 5, 4) || '-' || substr(h, 9, 4);
    exit when not exists (select 1 from public.codigos_ativacao where codigo = v_cod);
  end loop;
  insert into public.codigos_ativacao (codigo, plano, dias, fundador, cliente) values (v_cod, p_plano, p_dias, p_fundador, p_cliente);
  return v_cod;
end $$;
revoke all on function public.novo_codigo(text, int, boolean, text) from public, anon, authenticated;
