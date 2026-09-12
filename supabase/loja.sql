-- ============================================================================
-- Box for You — Loja pública (crumblab.pt/)
-- Rode este script inteiro no Supabase → SQL Editor. Idempotente.
--
-- Princípio: o visitante NUNCA fala com as tabelas. O RLS continua a permitir
-- apenas utilizadores autenticados (a app da dona). A loja usa funções
-- SECURITY DEFINER que expõem só o necessário:
--
--   loja_cardapio()          → sabores ativos, preços das caixas, stock e
--                              textos de levantamento/entrega
--   loja_criar_pedido(jsonb) → valida, RECALCULA o total no servidor, cria o
--                              cliente + pedido e dá baixa no stock
--   loja_ver_pedido(ref,tel) → acompanhamento público (os dois juntos)
--
-- Recalcular no servidor é o ponto central: o preço que o browser envia é
-- ignorado, portanto ninguém compra uma caixa por €0,01 mexendo no devtools.
-- ============================================================================

-- Marca a origem do pedido para a dona distinguir loja de venda manual.
alter table pedidos add column if not exists origem text not null default 'app';

-- Referência curta única (ex. K7M2PQ) e dados estruturados de levantamento/entrega.
alter table pedidos add column if not exists referencia text;
alter table pedidos add column if not exists entrega jsonb;

create unique index if not exists idx_pedidos_referencia
  on pedidos (referencia) where referencia is not null;

-- Textos que a dona edita em Definições e a loja mostra no checkout.
alter table configuracao add column if not exists loja_instrucoes_levantamento text not null default '';
alter table configuracao add column if not exists loja_instrucoes_entrega text not null default '';

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

-- Código de 6 caracteres sem 0/O/1/I, para ler em voz alta sem confusão.
create or replace function loja_nova_referencia()
returns text
language plpgsql
volatile
set search_path = public
as $$
declare
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  candidate text;
  i int;
begin
  for i in 1..32 loop
    select string_agg(ch, '')
      into candidate
    from (
      select substr(alphabet, 1 + floor(random() * 32)::int, 1) as ch
      from generate_series(1, 6)
    ) s;
    if not exists (select 1 from pedidos where referencia = candidate) then
      return candidate;
    end if;
  end loop;
  raise exception 'Não foi possível gerar uma referência única';
end
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
      'moeda', coalesce(v_cfg.moeda, '€'),
      'instrucoesLevantamento', coalesce(nullif(btrim(v_cfg.loja_instrucoes_levantamento), ''),
        'Combinamos o sítio e a hora contigo por mensagem.'),
      'instrucoesEntrega', coalesce(nullif(btrim(v_cfg.loja_instrucoes_entrega), ''),
        'Entregamos na morada que indicares. Combinamos o horário contigo.')
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
--   "caixas":    [ { "nutella": 2, "pistache": 2 } ],
--   "pagamento": "MB WAY | Dinheiro",
--   "entrega":   { "tipo": "levantar"|"entrega", "data": "YYYY-MM-DD",
--                  "morada": "...", "localidade": "...", "cp": "..." },
--   "notas":     "..."
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

  v_ent        jsonb;
  v_tipo       text;
  v_data       text;
  v_morada     text;
  v_localidade text;
  v_cp         text;
  v_entrega    jsonb;

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
  v_ref        text;
begin
  -- ── validação do contacto ────────────────────────────────────────────────
  if length(v_nome) < 2 then
    return jsonb_build_object('ok', false, 'campo', 'nome', 'motivo', 'Diz-nos o teu nome.');
  end if;
  if length(regexp_replace(v_tel, '\D', '', 'g')) < 6 then
    return jsonb_build_object('ok', false, 'campo', 'telefone', 'motivo', 'Precisamos de um telemóvel para confirmar o pedido.');
  end if;
  if v_pag not in ('MB WAY', 'Dinheiro') then
    return jsonb_build_object('ok', false, 'campo', 'pagamento', 'motivo', 'Escolhe uma forma de pagamento.');
  end if;

  -- ── levantamento / entrega ───────────────────────────────────────────────
  -- Aceita objecto novo; se vier uma data solta (versão antiga), trata como levantar.
  v_ent := p->'entrega';
  if v_ent is null or jsonb_typeof(v_ent) = 'null' then
    v_ent := '{}'::jsonb;
  end if;
  if jsonb_typeof(v_ent) <> 'object' then
    v_ent := jsonb_build_object('tipo', 'levantar', 'data', btrim(v_ent #>> '{}'));
  elsif coalesce(v_ent->>'tipo', '') = '' and coalesce(v_ent->>'data', '') <> '' then
    v_ent := v_ent || jsonb_build_object('tipo', 'levantar');
  end if;

  v_tipo       := btrim(coalesce(v_ent->>'tipo', ''));
  v_data       := btrim(coalesce(v_ent->>'data', ''));
  v_morada     := btrim(coalesce(v_ent->>'morada', ''));
  v_localidade := btrim(coalesce(v_ent->>'localidade', ''));
  v_cp         := btrim(coalesce(v_ent->>'cp', ''));

  if v_tipo not in ('levantar', 'entrega') then
    return jsonb_build_object('ok', false, 'campo', 'entrega',
      'motivo', 'Diz-nos se preferes levantar ou receber em casa.');
  end if;
  if v_data !~ '^\d{4}-\d{2}-\d{2}$' then
    return jsonb_build_object('ok', false, 'campo', 'data',
      'motivo', 'Escolhe o dia em que queres os cookies.');
  end if;
  if v_data::date < current_date then
    return jsonb_build_object('ok', false, 'campo', 'data', 'motivo', 'Essa data já passou.');
  end if;
  if v_tipo = 'entrega' then
    if length(v_morada) < 4 then
      return jsonb_build_object('ok', false, 'campo', 'morada', 'motivo', 'Indica a morada de entrega.');
    end if;
    if length(v_localidade) < 2 then
      return jsonb_build_object('ok', false, 'campo', 'localidade', 'motivo', 'Indica a localidade.');
    end if;
  end if;

  v_entrega := jsonb_strip_nulls(jsonb_build_object(
    'tipo', v_tipo,
    'data', v_data,
    'morada',     case when v_tipo = 'entrega' then left(v_morada, 160) end,
    'localidade', case when v_tipo = 'entrega' then left(v_localidade, 80) end,
    'cp',         case when v_tipo = 'entrega' then nullif(left(v_cp, 12), '') end
  ));

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
    return jsonb_build_object('ok', false, 'motivo', 'Pedido demasiado grande para a loja. Fala connosco diretamente.');
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

  v_ref := loja_nova_referencia();

  -- ── pedido ───────────────────────────────────────────────────────────────
  insert into pedidos (cliente_id, linhas, box, total_eur, desconto, data_pedido,
                       forma_pagamento, status, notas, origem, referencia, entrega)
  values (
    v_cliente_id, v_linhas, v_box, v_total, 0,
    current_date, v_pag, 'pendente',
    left(v_notas, 400),
    'loja', v_ref, v_entrega
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
    'referencia', v_ref,
    'total', v_total
  );
end $$;

-- ────────────────────────────────────────────────────────────────────────────
-- 3) Acompanhar pedido (referência + telemóvel)
-- ────────────────────────────────────────────────────────────────────────────
create or replace function loja_ver_pedido(p_ref text, p_tel text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_ref text := upper(btrim(coalesce(p_ref, '')));
  v_p   pedidos%rowtype;
  v_cli clientes%rowtype;
  v_cfg configuracao%rowtype;
  v_linhas jsonb := '[]'::jsonb;
  v_par record;
  v_ln  jsonb;
  v_nome text;
  v_detalhe text;
  v_estado text;
  v_seguinte text;
  v_tipo text;
  v_box_size int;
begin
  if length(v_ref) < 4 or length(regexp_replace(coalesce(p_tel, ''), '\D', '', 'g')) < 6 then
    return jsonb_build_object('ok', false, 'motivo',
      'Indica a referência e o telemóvel do pedido.');
  end if;

  select * into v_p from pedidos
   where referencia = v_ref and origem = 'loja'
   limit 1;
  if not found then
    return jsonb_build_object('ok', false, 'motivo',
      'Não encontrámos este pedido. Confirma a referência e o telemóvel.');
  end if;

  select * into v_cli from clientes where id = v_p.cliente_id;
  if not found or loja_tel_norm(v_cli.telefone) is distinct from loja_tel_norm(p_tel) then
    return jsonb_build_object('ok', false, 'motivo',
      'Não encontrámos este pedido. Confirma a referência e o telemóvel.');
  end if;

  select * into v_cfg from configuracao where id = 'main';
  v_box_size := coalesce((v_cfg.box_config->>'size')::int, 4);

  if v_p.box is not null and v_p.box->'counts' is not null then
    v_detalhe := '';
    for v_par in
      select key as id, floor(coalesce(value::numeric, 0))::int as qty
      from jsonb_each_text(v_p.box->'counts')
    loop
      if v_par.qty <= 0 then continue; end if;
      select coalesce(nullif(short, ''), nome) into v_nome
        from cookies_catalogo where id = v_par.id;
      v_detalhe := v_detalhe || case when v_detalhe = '' then '' else ', ' end
                 || v_par.qty || '× ' || coalesce(v_nome, v_par.id);
    end loop;
    v_linhas := v_linhas || jsonb_build_object(
      'nome', format('Box de %s', v_box_size),
      'detalhe', v_detalhe,
      'qty', 1,
      'subtotal', coalesce((v_p.box->>'priceEur')::numeric, 0)
    );
  end if;

  for v_ln in select value from jsonb_array_elements(coalesce(v_p.linhas, '[]'::jsonb))
  loop
    v_nome := nullif(v_ln->>'customLabel', '');
    if v_nome is null then
      select coalesce(nullif(nome, ''), id) into v_nome
        from cookies_catalogo where id = v_ln->>'cookieId';
      v_nome := coalesce(v_nome, v_ln->>'cookieId');
    end if;
    v_linhas := v_linhas || jsonb_build_object(
      'nome', v_nome,
      'detalhe', '',
      'qty', coalesce((v_ln->>'qty')::int, 1),
      'subtotal', coalesce((v_ln->>'preco')::numeric, 0) * coalesce((v_ln->>'qty')::int, 1)
    );
  end loop;

  v_tipo := coalesce(v_p.entrega->>'tipo', '');

  case v_p.status
    when 'pendente' then
      v_estado := 'Recebemos. Vamos confirmar contigo.';
      v_seguinte := case v_p.forma_pagamento
        when 'MB WAY' then 'Vamos enviar-te o pedido de pagamento MB WAY para o número que deixaste.'
        when 'Dinheiro' then
          case when v_tipo = 'levantar'
            then 'Pagas em dinheiro quando levantares. Falamos contigo em breve.'
            else 'Pagas em dinheiro na entrega. Falamos contigo em breve.'
          end
        else 'Falamos contigo em breve para confirmar tudo.'
      end;
    when 'pago' then
      v_estado := 'Confirmado. Estamos a preparar.';
      v_seguinte := case when v_tipo = 'levantar'
        then 'Avisamos quando puderes vir buscar.'
        else 'Avisamos quando formos a caminho.'
      end;
    when 'entregue' then
      v_estado := case when v_tipo = 'levantar'
        then 'Já foi levantado'
        else 'Já foi entregue'
      end;
      v_seguinte := 'Obrigado. Até à próxima fornada.';
    when 'cancelado' then
      v_estado := 'Este pedido foi cancelado';
      v_seguinte := 'Se tiveres dúvidas, fala connosco.';
    else
      v_estado := 'Pedido registado';
      v_seguinte := 'Falamos contigo em breve.';
  end case;

  return jsonb_build_object(
    'ok', true,
    'referencia', v_p.referencia,
    'status', v_p.status,
    'estado', v_estado,
    'seguinte', v_seguinte,
    'total', v_p.total_eur,
    'pagamento', v_p.forma_pagamento,
    'linhas', v_linhas,
    'entrega', coalesce(v_p.entrega, '{}'::jsonb)
  );
end $$;

-- ────────────────────────────────────────────────────────────────────────────
-- 4) Permissões: o visitante anónimo só pode chamar estas funções
-- ────────────────────────────────────────────────────────────────────────────
revoke all on function loja_tel_norm(text)       from public, anon, authenticated;
revoke all on function loja_nova_referencia()    from public, anon, authenticated;
revoke all on function loja_cardapio()           from public, anon, authenticated;
revoke all on function loja_criar_pedido(jsonb)  from public, anon, authenticated;
revoke all on function loja_ver_pedido(text, text) from public, anon, authenticated;
grant execute on function loja_cardapio()             to anon, authenticated;
grant execute on function loja_criar_pedido(jsonb)    to anon, authenticated;
grant execute on function loja_ver_pedido(text, text) to anon, authenticated;
