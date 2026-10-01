-- Box for You — Notificações no telemóvel/iPad quando chega um pedido da loja
-- Rode este script inteiro no Supabase → SQL Editor. É idempotente e não mexe
-- em nenhum dado existente.
--
-- COMO FUNCIONA
-- 1. Em Definições → Avisos, a dona toca "Ativar neste aparelho". O browser
--    dá-nos um endereço de push desse aparelho, que fica em push_inscricoes.
-- 2. Quando a loja grava um pedido (origem 'loja'), o trigger abaixo chama
--    https://…/api/notificar (Vercel) com o texto e a lista de aparelhos.
-- 3. A Vercel assina com a chave privada e entrega aos serviços de push da
--    Apple/Google — a notificação aparece mesmo com a app fechada.
--
-- Se alguma coisa falhar no aviso, o PEDIDO NÃO É AFETADO: o erro é engolido.
--
-- DEPOIS DESTE SCRIPT, corre também supabase/push-segredo.local.sql (gerado
-- no teu computador, fora do git), que põe aqui o segredo partilhado com a
-- Vercel.

create extension if not exists pg_net;

-- Função do perfil "feira" (igual à de perfil-feira.sql), para correr sozinho.
create or replace function is_feira()
returns boolean
language sql
stable
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'feira'
$$;

-- ── Aparelhos inscritos ─────────────────────────────────────────────────────
create table if not exists push_inscricoes (
  endpoint   text primary key,
  p256dh     text not null,
  auth       text not null,
  email      text not null default '',
  aparelho   text not null default '',
  criado_em  timestamptz not null default now()
);

alter table push_inscricoes enable row level security;
drop policy if exists push_rw on push_inscricoes;
-- Só a dona (contas que não são "feira") inscreve e remove aparelhos.
create policy push_rw on push_inscricoes for all to authenticated
  using (not is_feira()) with check (not is_feira());

-- ── Configuração (endereço da Vercel + segredo) ─────────────────────────────
-- Sem policies: pela API ninguém lê nem escreve. Só o trigger (security definer).
create table if not exists push_config (
  id      int primary key default 1 check (id = 1),
  url     text not null default 'https://box-for-you.vercel.app/api/notificar',
  segredo text not null default ''
);
alter table push_config enable row level security;
insert into push_config (id) values (1) on conflict (id) do nothing;

-- ── Trigger: pedido novo da loja → aviso ────────────────────────────────────
create or replace function push_pedido_novo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cfg   push_config%rowtype;
  v_subs  jsonb;
  v_nome  text;
  v_corpo text;
  v_dia   text;
begin
  if new.origem is distinct from 'loja' then
    return new;
  end if;

  begin
    select * into v_cfg from push_config where id = 1;
    if coalesce(v_cfg.segredo, '') = '' then
      return new;
    end if;

    select coalesce(jsonb_agg(jsonb_build_object(
             'endpoint', endpoint,
             'keys', jsonb_build_object('p256dh', p256dh, 'auth', auth)
           )), '[]'::jsonb)
      into v_subs
    from push_inscricoes;
    if jsonb_array_length(v_subs) = 0 then
      return new;
    end if;

    select nome into v_nome from clientes where id = new.cliente_id;
    v_dia := case when new.entrega->>'data' ~ '^\d{4}-\d{2}-\d{2}$'
                  then to_char((new.entrega->>'data')::date, 'DD/MM') end;
    v_corpo := concat_ws(' · ',
      coalesce(nullif(btrim(v_nome), ''), 'Cliente'),
      replace(to_char(new.total_eur, 'FM999990.00'), '.', ',') || ' €',
      case new.entrega->>'tipo'
        when 'levantar' then concat_ws(' ', 'Levantar', new.entrega#>>'{local,nome}', v_dia)
        when 'entrega'  then concat_ws(' ', 'Entrega', v_dia)
      end,
      nullif(new.forma_pagamento, '')
    );

    perform net.http_post(
      url     := v_cfg.url,
      body    := jsonb_build_object(
                   'segredo', v_cfg.segredo,
                   'titulo', 'Pedido novo na loja 🍪',
                   'corpo', v_corpo,
                   'url', '/crm/',
                   'inscricoes', v_subs),
      headers := '{"Content-Type": "application/json"}'::jsonb
    );
  exception when others then
    -- o aviso nunca pode impedir um pedido
    raise warning 'push_pedido_novo: %', sqlerrm;
  end;

  return new;
end $$;

drop trigger if exists trg_push_pedido_novo on pedidos;
create trigger trg_push_pedido_novo
  after insert on pedidos
  for each row execute function push_pedido_novo();

-- ── Testar sem fazer pedido ─────────────────────────────────────────────────
-- A dona carrega em "Enviar teste" em Definições → Avisos, que chama isto.
create or replace function push_testar()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cfg  push_config%rowtype;
  v_subs jsonb;
begin
  if is_feira() then
    return jsonb_build_object('ok', false, 'motivo', 'Só a dona pode testar.');
  end if;
  select * into v_cfg from push_config where id = 1;
  if coalesce(v_cfg.segredo, '') = '' then
    return jsonb_build_object('ok', false, 'motivo', 'Falta correr o push-segredo.local.sql.');
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'endpoint', endpoint,
           'keys', jsonb_build_object('p256dh', p256dh, 'auth', auth)
         )), '[]'::jsonb)
    into v_subs
  from push_inscricoes;
  if jsonb_array_length(v_subs) = 0 then
    return jsonb_build_object('ok', false, 'motivo', 'Nenhum aparelho ativado.');
  end if;
  perform net.http_post(
    url     := v_cfg.url,
    body    := jsonb_build_object(
                 'segredo', v_cfg.segredo,
                 'titulo', 'Notificações ligadas ✅',
                 'corpo', 'É assim que vais saber de cada pedido novo da loja.',
                 'url', '/crm/',
                 'inscricoes', v_subs),
    headers := '{"Content-Type": "application/json"}'::jsonb
  );
  return jsonb_build_object('ok', true, 'aparelhos', jsonb_array_length(v_subs));
end $$;

revoke all on function push_testar() from public, anon;
grant execute on function push_testar() to authenticated;
revoke all on function push_pedido_novo() from public, anon;
