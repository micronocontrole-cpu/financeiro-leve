-- Micro no Controle — reforço de segurança do link de agendamento
-- Antes: cada telefone podia ter até 3 pedidos em aberto, mas um robô trocando de número
-- conseguia segurar todos os horários livres de um negócio. Agora há também um teto de
-- 20 pedidos esperando resposta por negócio.
-- Rodar no Supabase: SQL Editor > New query > colar tudo > Run. Pode rodar de novo.
-- Depende do 001_agenda.sql.

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
  -- limite contra robô: no máximo 20 pedidos esperando resposta no mesmo negócio
  if (select count(*) from public.horarios where negocio = n.id and status = 'pendente' and origem = 'link'
        and (expira_em is null or expira_em > now())) >= 20 then
    return json_build_object('ok', false, 'motivo', 'limite');
  end if;
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
