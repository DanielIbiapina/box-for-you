-- ============================================================================
-- Box for You — Loja pública (crumblab.pt/)
-- Rode este script inteiro no Supabase → SQL Editor. Idempotente.
--
-- Princípio: o visitante NUNCA fala com as tabelas. O RLS continua a permitir
-- apenas utilizadores autenticados (a app da dona). A loja usa duas funções
-- SECURITY DEFINER que expõem só o necessário:
--
--   loja_cardapio()          → sabores ativos, preços das caixas e stock
--   loja_criar_pedido(jsonb) → valida, RECALCULA o total no servidor, cria o
--                              cliente + pedido e dá baixa no stock
--
-- Recalcular no servidor é o ponto central: o preço que o browser envia é
-- ignorado, portanto ninguém compra uma caixa por €0,01 mexendo no devtools.
-- ============================================================================

-- Marca a origem do pedido para a dona distinguir loja de venda manual.
alter table pedidos add column if not exists origem text not null default 'app';

-- ────────────────────────────────────────────────────────────────────────────
-- 0) Telemóvel normalizado
-- ────────────────────────────────────────────────────────────────────────────
-- Só dígitos e, se houver indicativo, apenas os últimos 9 — assim o mesmo
-- cliente é reconhecido escreva ele "912 345 678" ou "+351912345678".
create or replace function loja_tel_norm(t text)
returns text
language sql
immutable
set search_path = public
as $$
  select case when length(d) >= 9 then right(d, 9) else d end
  from (select regexp_replace(coalesce(t, ''), '\D', '', 'g') as d) s
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- 1) Cardápio público
-- ────────────────────────────────────────────────────────────────────────────
create or replace function loja_cardapio()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_cfg      configuracao%rowtype;
  v_cookies  jsonb;
  v_n_ativos int;
  v_min50    numeric;
  v_mini     numeric;
begin
  select * into v_cfg from configuracao where id = 'main';

  select coalesce(jsonb_agg(x order by nome), '[]'::jsonb), count(*)
    into v_cookies, v_n_ativos
  from (
    select
      c.nome,
      jsonb_build_object(
        'id',     c.id,
        'nome',   c.nome,
        'short',  c.short,
        'emoji',  c.emoji,
        'price',  c.price,
        'image',  c.image,
        'stock',  floor(coalesce(e.qty, 0))::int
      ) as x
    from cookies_catalogo c
    left join estoque e on e.tipo = 'cookie' and e.cookie_id = c.id
    where c.ativo_no_cardapio
  ) s;

  -- Tasting Box leva 1 cookie de 50g de CADA sabor ativo → o stock é o mínimo.
  select coalesce(min(coalesce(e.qty, 0)), 0) into v_min50
  from cookies_catalogo c
  left join estoque e on e.tipo = 'cookie50' and e.cookie_id = c.id
  where c.ativo_no_cardapio;

  select coalesce(qty, 0) into v_mini
  from estoque where tipo = 'cookie' and cookie_id = 'mini-box';

  return jsonb_build_object(
    'negocio', jsonb_build_object(
      'nome',  coalesce(v_cfg.nome_negocio, 'Box for You'),
      'moeda', coalesce(v_cfg.moeda, '€')
    ),
    'cookies', v_cookies,
    'box', jsonb_build_object(
      'size',  coalesce((v_cfg.box_config->>'size')::int, 4),
      'price', coalesce((v_cfg.box_config->>'price')::numeric, 12)
    ),
    'miniBox', jsonb_build_object(
      'price', coalesce((v_cfg.mini_box_config->>'price')::numeric, 7),
      'stock', floor(coalesce(v_mini, 0))::int
    ),
    'tastingBox', jsonb_build_object(
      'price',   coalesce((v_cfg.tasting_box_config->>'price')::numeric, 16),
      'sabores', v_n_ativos,
      'stock',   case when v_n_ativos = 0 then 0 else floor(coalesce(v_min50, 0))::int end
    )
  );
end $$;

-- ────────────────────────────────────────────────────────────────────────────
-- 2) Criar pedido a partir da loja
-- ────────────────────────────────────────────────────────────────────────────
-- Entrada:
-- {
--   "cliente":   { "nome": "...", "telefone": "...", "instagram": "", "email": "" },
--   "itens":     [ { "id": "nutella|mini-box|tasting-box", "qty": 2 } ],
--   "caixas":    [ { "nutella": 2, "pistache": 2 } ],        -- cada objeto = 1 Box
--   "pagamento": "MB WAY | Multibanco | Dinheiro",
--   "entrega":   "2026-09-12",                                -- opcional
--   "notas":     "..."                                        -- opcional
-- }
-- Saída: { ok: true, pedidoId, referencia, total } | { ok: false, motivo, campo }
create or replace function loja_criar_pedido(p jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_cfg        configuracao%rowtype;
  v_box_size   int;
  v_box_price  numeric;
  v_mini_price numeric;
  v_tast_price numeric;

  v_nome   text := btrim(coalesce(p#>>'{cliente,nome}', ''));
  v_tel    text := btrim(coalesce(p#>>'{cliente,telefone}', ''));
  v_insta  text := btrim(coalesce(p#>>'{cliente,instagram}', ''));
  v_email  text := btrim(coalesce(p#>>'{cliente,email}', ''));
  v_pag    text := btrim(coalesce(p->>'pagamento', ''));
  v_notas  text := btrim(coalesce(p->>'notas', ''));
  v_entrega text := nullif(btrim(coalesce(p->>'entrega', '')), '');

  v_itens  jsonb := coalesce(p->'itens',  '[]'::jsonb);
  v_caixas jsonb := coalesce(p->'caixas', '[]'::jsonb);

  v_need     jsonb := '{}'::jsonb;   -- { cookieId: qty } no balde 'cookie'
  v_tasting  int   := 0;
  v_linhas   jsonb := '[]'::jsonb;
  v_box      jsonb := null;
  v_total    numeric := 0;
  v_unidades int := 0;

  v_cookie   record;
  v_item     record;
  v_caixa    jsonb;
  v_par      record;
  v_soma     int;
  v_i        int;
  v_have     numeric;
  v_faltou   text;
  v_resumo   text;

  v_cliente_id text;
  v_pedido_id  text;
begin
  -- ── validação do contacto ────────────────────────────────────────────────
  if length(v_nome) < 2 then
    return jsonb_build_object('ok', false, 'campo', 'nome', 'motivo', 'Diz-nos o teu nome.');
  end if;
  if length(regexp_replace(v_tel, '\D', '', 'g')) < 6 then
    return jsonb_build_object('ok', false, 'campo', 'telefone', 'motivo', 'Precisamos de um telemóvel para confirmar o pedido.');
  end if;
  if v_pag not in ('MB WAY', 'Multibanco', 'Dinheiro') then
    return jsonb_build_object('ok', false, 'campo', 'pagamento', 'motivo', 'Escolhe uma forma de pagamento.');
  end if;
  if v_entrega is not null and v_entrega !~ '^\d{4}-\d{2}-\d{2}$' then
    return jsonb_build_object('ok', false, 'campo', 'entrega', 'motivo', 'Data de entrega inválida.');
  end if;

  select * into v_cfg from configuracao where id = 'main';
  v_box_size   := coalesce((v_cfg.box_config->>'size')::int, 4);
  v_box_price  := coalesce((v_cfg.box_config->>'price')::numeric, 12);
  v_mini_price := coalesce((v_cfg.mini_box_config->>'price')::numeric, 7);
  v_tast_price := coalesce((v_cfg.tasting_box_config->>'price')::numeric, 16);

  -- ── itens avulsos ────────────────────────────────────────────────────────
  for v_item in
    select e->>'id' as id, floor(coalesce((e->>'qty')::numeric, 0))::int as qty
    from jsonb_array_elements(v_itens) e
  loop
    if v_item.qty <= 0 then continue; end if;
    if v_item.qty > 50 then
      return jsonb_build_object('ok', false, 'motivo', 'Quantidade máxima de 50 por item. Para encomendas grandes, fala connosco.');
    end if;
    v_unidades := v_unidades + v_item.qty;

    if v_item.id = 'tasting-box' then
      v_tasting := v_tasting + v_item.qty;
      v_total   := v_total + v_item.qty * v_tast_price;
      v_linhas  := v_linhas || jsonb_build_object(
        'cookieId', 'tasting-box', 'qty', v_item.qty,
        'preco', v_tast_price, 'customLabel', 'Tasting Box'
      );

    elsif v_item.id = 'mini-box' then
      v_total  := v_total + v_item.qty * v_mini_price;
      v_need   := jsonb_set(v_need, array['mini-box'],
                    to_jsonb(coalesce((v_need->>'mini-box')::int, 0) + v_item.qty));
      v_linhas := v_linhas || jsonb_build_object(
        'cookieId', 'mini-box', 'qty', v_item.qty,
        'preco', v_mini_price, 'customLabel', 'Mini Box'
      );

    else
      select * into v_cookie from cookies_catalogo
       where id = v_item.id and ativo_no_cardapio;
      if not found then
        return jsonb_build_object('ok', false, 'motivo', 'Um dos sabores já não está disponível. Atualiza a página.');
      end if;
      v_total  := v_total + v_item.qty * v_cookie.price;
      v_need   := jsonb_set(v_need, array[v_item.id],
                    to_jsonb(coalesce((v_need->>v_item.id)::int, 0) + v_item.qty));
      v_linhas := v_linhas || jsonb_build_object(
        'cookieId', v_item.id, 'qty', v_item.qty, 'preco', v_cookie.price
      );
    end if;
  end loop;

  -- ── caixas de N sabores ──────────────────────────────────────────────────
  v_i := 0;
  for v_caixa in select value from jsonb_array_elements(v_caixas)
  loop
    v_soma := 0;
    v_resumo := '';
    for v_par in select key as id, floor(coalesce(value::numeric, 0))::int as qty
                 from jsonb_each_text(v_caixa) t(key, value)
    loop
      if v_par.qty <= 0 then continue; end if;
      select * into v_cookie from cookies_catalogo
       where id = v_par.id and ativo_no_cardapio;
      if not found then
        return jsonb_build_object('ok', false, 'motivo', 'Um dos sabores da caixa já não está disponível. Atualiza a página.');
      end if;
      v_soma   := v_soma + v_par.qty;
      v_resumo := v_resumo || case when v_resumo = '' then '' else ', ' end
                            || v_par.qty || '× ' || coalesce(nullif(v_cookie.short, ''), v_cookie.nome);
      v_need   := jsonb_set(v_need, array[v_par.id],
                    to_jsonb(coalesce((v_need->>v_par.id)::int, 0) + v_par.qty));
    end loop;

    if v_soma <> v_box_size then
      return jsonb_build_object('ok', false, 'motivo',
        format('Cada caixa leva exatamente %s cookies.', v_box_size));
    end if;

    v_unidades := v_unidades + v_soma;
    v_total := v_total + v_box_price;
    v_i := v_i + 1;

    if v_i = 1 then
      -- A primeira caixa vai na coluna nativa `box` (a app mostra-a a sério).
      v_box := jsonb_build_object('counts', v_caixa, 'priceEur', v_box_price);
    else
      -- As seguintes viram linha com etiqueta legível.
      v_linhas := v_linhas || jsonb_build_object(
        'cookieId', 'box-' || v_i, 'qty', 1, 'preco', v_box_price,
        'customLabel', format('Box %s · %s', v_box_size, v_resumo)
      );
    end if;
  end loop;

  if jsonb_array_length(v_linhas) = 0 and v_box is null then
    return jsonb_build_object('ok', false, 'motivo', 'O carrinho está vazio.');
  end if;
  if v_unidades > 200 then
    return jsonb_build_object('ok', false, 'motivo', 'Pedido demasiado grande para a loja — fala connosco diretamente.');
  end if;

  -- ── stock: tranca as linhas antes de ler, para dois clientes em simultâneo
  --    não venderem o mesmo último cookie ─────────────────────────────────────
  perform 1 from estoque
   where (tipo = 'cookie'   and cookie_id in (select k from jsonb_object_keys(v_need) k))
      or (tipo = 'cookie50' and v_tasting > 0)
   for update;

  for v_par in select key as id, value::int as qty from jsonb_each_text(v_need) t(key, value)
  loop
    select coalesce(qty, 0) into v_have
      from estoque where tipo = 'cookie' and cookie_id = v_par.id;
    v_have := coalesce(v_have, 0);
    if v_have < v_par.qty then
      select coalesce(nullif(short, ''), nome) into v_faltou
        from cookies_catalogo where id = v_par.id;
      return jsonb_build_object(
        'ok', false, 'esgotado', true,
        'motivo', format('Só temos %s de %s neste momento. Ajusta o carrinho.',
                         floor(v_have)::int, coalesce(v_faltou, v_par.id))
      );
    end if;
  end loop;

  if v_tasting > 0 then
    select coalesce(min(coalesce(e.qty, 0)), 0) into v_have
      from cookies_catalogo c
      left join estoque e on e.tipo = 'cookie50' and e.cookie_id = c.id
     where c.ativo_no_cardapio;
    if coalesce(v_have, 0) < v_tasting then
      return jsonb_build_object('ok', false, 'esgotado', true,
        'motivo', format('Só temos %s Tasting Box neste momento.', floor(coalesce(v_have, 0))::int));
    end if;
  end if;

  -- ── cliente: reaproveita pelo telemóvel (só dígitos) ──────────────────────
  select id into v_cliente_id
    from clientes
   where loja_tel_norm(telefone) = loja_tel_norm(v_tel)
     and loja_tel_norm(telefone) <> ''
   order by criado_em asc
   limit 1;

  if v_cliente_id is null then
    insert into clientes (nome, telefone, instagram, email, notas)
    values (left(v_nome, 80), left(v_tel, 40), left(v_insta, 60), left(v_email, 120), 'Cliente da loja online')
    returning id into v_cliente_id;
  else
    -- trava simples de abuso: 5 pedidos pendentes da loja em 24h chega
    if (select count(*) from pedidos
         where cliente_id = v_cliente_id and origem = 'loja'
           and status = 'pendente' and criado_em > now() - interval '24 hours') >= 5 then
      return jsonb_build_object('ok', false, 'motivo',
        'Já tens pedidos por confirmar. Falamos contigo em breve!');
    end if;
    update clientes set
      instagram = case when instagram = '' then left(v_insta, 60) else instagram end,
      email     = case when email = ''     then left(v_email, 120) else email end
     where id = v_cliente_id;
  end if;

  -- ── pedido ───────────────────────────────────────────────────────────────
  insert into pedidos (cliente_id, linhas, box, total_eur, desconto, data_pedido,
                       forma_pagamento, status, notas, origem)
  values (
    v_cliente_id, v_linhas, v_box, v_total, 0,
    current_date, v_pag, 'pendente',
    btrim(concat_ws(' · ',
      'Pedido da loja online',
      case when v_entrega is not null then 'quer para ' || to_char(v_entrega::date, 'DD/MM') end,
      nullif(left(v_notas, 400), '')
    )),
    'loja'
  )
  returning id into v_pedido_id;

  -- ── baixa de stock (mesma regra da app: baixa ao criar o pedido) ──────────
  insert into estoque (tipo, cookie_id, qty)
  select 'cookie', t.key, greatest(0, coalesce(e.qty, 0) - t.value::int)
    from jsonb_each_text(v_need) t(key, value)
    left join estoque e on e.tipo = 'cookie' and e.cookie_id = t.key
  on conflict (tipo, cookie_id) do update set qty = excluded.qty;

  if v_tasting > 0 then
    insert into estoque (tipo, cookie_id, qty)
    select 'cookie50', c.id, greatest(0, coalesce(e.qty, 0) - v_tasting)
      from cookies_catalogo c
      left join estoque e on e.tipo = 'cookie50' and e.cookie_id = c.id
     where c.ativo_no_cardapio
    on conflict (tipo, cookie_id) do update set qty = excluded.qty;
  end if;

  return jsonb_build_object(
    'ok', true,
    'pedidoId', v_pedido_id,
    'referencia', upper(right(replace(v_pedido_id, '-', ''), 5)),
    'total', v_total
  );
end $$;

-- ────────────────────────────────────────────────────────────────────────────
-- 3) Permissões: o visitante anónimo só pode chamar estas duas funções
-- ────────────────────────────────────────────────────────────────────────────
revoke all on function loja_tel_norm(text)       from public, anon, authenticated;
revoke all on function loja_cardapio()           from public, anon, authenticated;
revoke all on function loja_criar_pedido(jsonb)  from public, anon, authenticated;
grant execute on function loja_cardapio()          to anon, authenticated;
grant execute on function loja_criar_pedido(jsonb) to anon, authenticated;
