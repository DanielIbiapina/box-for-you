-- ============================================================================
-- Box for You — Loja pública (crumblabcookies.com/)
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

-- Andamento do pedido que o cliente vê ao acompanhar (a dona avança em Vendas):
-- recebido → confirmado → preparando → pronto → a_caminho (entrega) → entregue.
-- Nulo = ainda não mexido (tira-se do status). Ver src/lib/etapas.js.
alter table pedidos add column if not exists etapa text;
alter table pedidos add column if not exists etapa_em timestamptz;

-- Textos que a dona edita em Definições e a loja mostra no checkout.
alter table configuracao add column if not exists loja_instrucoes_levantamento text not null default '';
alter table configuracao add column if not exists loja_instrucoes_entrega text not null default '';

-- Locais onde se pode levantar (casa, River Market, outro mercado…), que a
-- dona liga e desliga em Definições conforme onde vai estar.
-- [ { "id": "...", "nome": "River Market", "morada": "...", "notas": "...", "ativo": true } ]
-- Lista vazia = ainda não configurado: o levantamento funciona como antes
-- ("combinamos o sítio"). Com locais mas todos desligados, não há levantamento.
alter table configuracao add column if not exists loja_locais_levantamento jsonb not null default '[]'::jsonb;

-- Taxa de entrega por distância (em linha reta, a partir da morada de partida):
-- { "ativo": true, "origem": { "morada": "...", "lat": 38.7, "lng": -9.1 },
--   "faixas": [ { "ateKm": 3, "preco": 0 }, { "ateKm": 7, "preco": 3 } ] }
-- Mais longe que a última faixa: não se entrega. Inativo = como antes (sem taxa).
alter table configuracao add column if not exists loja_entrega_config jsonb not null default '{}'::jsonb;

-- Cupões de desconto: [ { "codigo": "WHATELSE15", "percent": 15, "validoAte": "2026-10-31", "ativo": true } ]
-- O desconto aplica-se aos cookies (não à taxa de entrega) e é calculado no servidor.
alter table configuracao add column if not exists loja_cupons jsonb not null default '[]'::jsonb;
alter table pedidos add column if not exists cupom text;

-- Mini cookies de 50 g: cada sabor tem a sua versão pequena, com stock em
-- estoque(tipo 'cookie50') e um preço único. { "price": 2.5, "descricao": "..." }
-- Preço 0 = não aparecem na loja. (A Tasting Box foi extinta em out/2026.)
alter table configuracao add column if not exists loja_mini50 jsonb not null default '{"price": 2.5}'::jsonb;

-- Texto por baixo do título "Cookies" na loja (editável em Definições).
alter table configuracao add column if not exists loja_texto_cookies text not null
  default 'Os nossos cookies individuais têm, em média, 100 g cada.';

-- Horário do levantamento/entrega, por faixas de 1 hora (ex.: 14h–15h).
-- { "abre": 10, "fecha": 20, "antecedenciaHoras": 2 }: a primeira faixa
-- possível começa pelo menos `antecedenciaHoras` depois do pedido.
alter table configuracao add column if not exists loja_horarios jsonb not null
  default '{"abre": 10, "fecha": 20, "antecedenciaHoras": 2}'::jsonb;

-- Cupões de outubro/2026 — só entram se ainda não houver nenhum cupão.
update configuracao
   set loja_cupons = '[
     {"codigo": "WHATELSE15", "percent": 15, "validoAte": "2026-10-31", "ativo": true},
     {"codigo": "MEDICINA15", "percent": 15, "validoAte": "2026-10-31", "ativo": true}
   ]'::jsonb
 where id = 'main' and loja_cupons = '[]'::jsonb;

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
  v_locais   jsonb;
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
        'stock',  floor(coalesce(e.qty, 0))::int,
        'stock50', floor(coalesce(e50.qty, 0))::int
      ) as x
    from cookies_catalogo c
    left join estoque e   on e.tipo   = 'cookie'   and e.cookie_id   = c.id
    left join estoque e50 on e50.tipo = 'cookie50' and e50.cookie_id = c.id
    where c.ativo_no_cardapio
  ) s;

  -- Tasting Box leva 1 cookie de 50g de CADA sabor ativo → o stock é o mínimo.
  select coalesce(min(coalesce(e.qty, 0)), 0) into v_min50
  from cookies_catalogo c
  left join estoque e on e.tipo = 'cookie50' and e.cookie_id = c.id
  where c.ativo_no_cardapio;

  select coalesce(qty, 0) into v_mini
  from estoque where tipo = 'cookie' and cookie_id = 'mini-box';

  -- Só os locais ligados chegam à loja; a morada e as notas vão para o cliente.
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', l->>'id', 'nome', l->>'nome',
           'morada', coalesce(l->>'morada', ''), 'notas', coalesce(l->>'notas', '')
         )), '[]'::jsonb)
    into v_locais
  from jsonb_array_elements(coalesce(v_cfg.loja_locais_levantamento, '[]'::jsonb)) l
  where coalesce((l->>'ativo')::boolean, false) and coalesce(btrim(l->>'nome'), '') <> '';

  return jsonb_build_object(
    'temLocais', jsonb_array_length(coalesce(v_cfg.loja_locais_levantamento, '[]'::jsonb)) > 0,
    'locais', v_locais,
    -- Para a loja mostrar a taxa logo que o cliente escreve a morada (o
    -- servidor volta a calcular ao criar o pedido). A morada de partida não sai.
    'entrega', case
      when coalesce(v_cfg.loja_entrega_config->>'ativo', '') = 'true'
       and (v_cfg.loja_entrega_config #>> '{origem,lat}') ~ '^-?\d+(\.\d+)?$'
       and (v_cfg.loja_entrega_config #>> '{origem,lng}') ~ '^-?\d+(\.\d+)?$'
       and jsonb_typeof(v_cfg.loja_entrega_config->'faixas') = 'array'
       and jsonb_array_length(v_cfg.loja_entrega_config->'faixas') > 0
      then jsonb_build_object(
        'ativo', true,
        'origem', jsonb_build_object(
          'lat', (v_cfg.loja_entrega_config #>> '{origem,lat}')::numeric,
          'lng', (v_cfg.loja_entrega_config #>> '{origem,lng}')::numeric),
        'faixas', (select coalesce(jsonb_agg(jsonb_build_object(
                     'ateKm', (f->>'ateKm')::numeric,
                     'preco', case when (f->>'preco') ~ '^\d+(\.\d+)?$' then (f->>'preco')::numeric else 0 end)
                     order by (f->>'ateKm')::numeric), '[]'::jsonb)
                   from jsonb_array_elements(v_cfg.loja_entrega_config->'faixas') f
                   where (f->>'ateKm') ~ '^\d+(\.\d+)?$'))
      else jsonb_build_object('ativo', false)
    end,
    'negocio', jsonb_build_object(
      'nome',  coalesce(v_cfg.nome_negocio, 'Box for You'),
      'moeda', coalesce(v_cfg.moeda, '€'),
      'instrucoesLevantamento', coalesce(nullif(btrim(v_cfg.loja_instrucoes_levantamento), ''),
        'Combinamos o sítio e a hora contigo por mensagem.'),
      'instrucoesEntrega', coalesce(nullif(btrim(v_cfg.loja_instrucoes_entrega), ''),
        'Entregamos na morada que indicares. Combinamos o horário contigo.'),
      'textoCookies', nullif(btrim(coalesce(v_cfg.loja_texto_cookies, '')), '')
    ),
    -- faixas de horário: a loja mostra só as que cumprem a antecedência;
    -- `agora` é a hora de Lisboa no servidor (o relógio do telemóvel pode estar errado)
    'horarios', jsonb_build_object(
      'abre', case when (v_cfg.loja_horarios->>'abre') ~ '^\d{1,2}$' then (v_cfg.loja_horarios->>'abre')::int else 10 end,
      'fecha', case when (v_cfg.loja_horarios->>'fecha') ~ '^\d{1,2}$' then (v_cfg.loja_horarios->>'fecha')::int else 20 end,
      'antecedenciaHoras', case when (v_cfg.loja_horarios->>'antecedenciaHoras') ~ '^\d+(\.\d+)?$'
                                then (v_cfg.loja_horarios->>'antecedenciaHoras')::numeric else 2 end,
      'agora', to_char(now() at time zone 'Europe/Lisbon', 'YYYY-MM-DD"T"HH24:MI:SS')
    ),
    'cookies', v_cookies,
    'box', jsonb_build_object(
      'size',  coalesce((v_cfg.box_config->>'size')::int, 4),
      'price', coalesce((v_cfg.box_config->>'price')::numeric, 12)
    ),
    'mini50', jsonb_build_object(
      'price', case when (v_cfg.loja_mini50->>'price') ~ '^\d+(\.\d+)?$' then (v_cfg.loja_mini50->>'price')::numeric else 0 end,
      'descricao', nullif(btrim(coalesce(v_cfg.loja_mini50->>'descricao', '')), '')
    ),
    'miniBox', jsonb_build_object(
      'price', coalesce((v_cfg.mini_box_config->>'price')::numeric, 7),
      'stock', floor(coalesce(v_mini, 0))::int,
      'descricao', nullif(btrim(coalesce(v_cfg.mini_box_config->>'descricao', '')), '')
    ),
    'tastingBox', jsonb_build_object(
      'price',   coalesce((v_cfg.tasting_box_config->>'price')::numeric, 16),
      'sabores', v_n_ativos,
      'stock',   case when v_n_ativos = 0 then 0 else floor(coalesce(v_min50, 0))::int end,
      'descricao', nullif(btrim(coalesce(v_cfg.tasting_box_config->>'descricao', '')), '')
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
--                  "local": "<id do local de levantamento>",
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
  v_locais     jsonb;
  v_local      jsonb;

  v_ent_cfg    jsonb;
  v_km         numeric;
  v_taxa       numeric := 0;
  v_faixa      jsonb;
  v_o_lat      numeric;
  v_o_lng      numeric;
  v_d_lat      numeric;
  v_d_lng      numeric;
  v_normal     numeric;
  v_need50     jsonb := '{}'::jsonb;   -- { cookieId: qty } de mini cookies de 50 g
  v_m50_price  numeric;
  v_m50_id     text;
  v_hora       text;
  v_h          int;
  v_abre       int;
  v_fecha      int;
  v_antec      numeric;
  v_cupom      text := upper(btrim(coalesce(p->>'cupom', '')));
  v_cupom_obj  jsonb;
  v_desconto   numeric := 0;
  v_pct        numeric;

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

  select * into v_cfg from configuracao where id = 'main';

  -- ── hora: faixa de 1 hora, com antecedência mínima (hora de Lisboa) ───────
  v_abre  := case when (v_cfg.loja_horarios->>'abre') ~ '^\d{1,2}$' then (v_cfg.loja_horarios->>'abre')::int else 10 end;
  v_fecha := case when (v_cfg.loja_horarios->>'fecha') ~ '^\d{1,2}$' then (v_cfg.loja_horarios->>'fecha')::int else 20 end;
  v_antec := case when (v_cfg.loja_horarios->>'antecedenciaHoras') ~ '^\d+(\.\d+)?$'
                  then (v_cfg.loja_horarios->>'antecedenciaHoras')::numeric else 2 end;
  v_hora  := btrim(coalesce(v_ent->>'hora', ''));
  if v_hora !~ '^\d{2}:00$' then
    return jsonb_build_object('ok', false, 'campo', 'hora', 'motivo', 'Escolhe a hora.');
  end if;
  v_h := substr(v_hora, 1, 2)::int;
  if v_h < v_abre or v_h >= v_fecha then
    return jsonb_build_object('ok', false, 'campo', 'hora', 'motivo', 'Essa hora não está disponível. Escolhe outra.');
  end if;
  if v_data::date + make_interval(hours => v_h)
     < (now() at time zone 'Europe/Lisbon') + v_antec * interval '1 hour' then
    return jsonb_build_object('ok', false, 'campo', 'hora',
      'motivo', format('Precisamos de pelo menos %s horas para preparar. Escolhe uma hora mais tarde.',
                       replace(trim(trailing '.' from trim(trailing '0' from v_antec::text)), '.', ',')));
  end if;

  -- Levantar num dos locais que a dona tem LIGADOS (se ela configurou locais).
  v_locais := coalesce(v_cfg.loja_locais_levantamento, '[]'::jsonb);
  if v_tipo = 'levantar' and jsonb_array_length(v_locais) > 0 then
    if not exists (
      select 1 from jsonb_array_elements(v_locais) l
       where coalesce((l->>'ativo')::boolean, false)
    ) then
      return jsonb_build_object('ok', false, 'campo', 'entrega',
        'motivo', 'De momento não temos levantamento. Escolhe a entrega.');
    end if;
    select l into v_local
      from jsonb_array_elements(v_locais) l
     where l->>'id' = btrim(coalesce(v_ent->>'local', ''))
       and coalesce((l->>'ativo')::boolean, false)
     limit 1;
    if v_local is null then
      return jsonb_build_object('ok', false, 'campo', 'local',
        'motivo', 'Esse local de levantamento já não está disponível. Escolhe outro.');
    end if;
  end if;

  v_entrega := jsonb_strip_nulls(jsonb_build_object(
    'tipo', v_tipo,
    'data', v_data,
    'hora', v_hora,
    'horaFim', lpad((v_h + 1)::text, 2, '0') || ':00',
    'local', case when v_local is not null then jsonb_strip_nulls(jsonb_build_object(
               'id', v_local->>'id',
               'nome', left(v_local->>'nome', 80),
               'morada', nullif(left(coalesce(v_local->>'morada', ''), 160), '')
             )) end,
    'morada',     case when v_tipo = 'entrega' then left(v_morada, 160) end,
    'localidade', case when v_tipo = 'entrega' then left(v_localidade, 80) end,
    'cp',         case when v_tipo = 'entrega' then nullif(left(v_cp, 12), '') end
  ));

  v_box_size   := coalesce((v_cfg.box_config->>'size')::int, 4);
  v_box_price  := coalesce((v_cfg.box_config->>'price')::numeric, 12);
  v_mini_price := coalesce((v_cfg.mini_box_config->>'price')::numeric, 7);
  v_tast_price := coalesce((v_cfg.tasting_box_config->>'price')::numeric, 16);
  v_m50_price  := case when (v_cfg.loja_mini50->>'price') ~ '^\d+(\.\d+)?$'
                       then (v_cfg.loja_mini50->>'price')::numeric else 0 end;

  -- Preço "normal" de um cookie: o mais comum no cardápio (empate → o mais
  -- baixo). Na Box só entram cookies a esse preço; os outros (ex.:
  -- "Mini Cookies" a 5 €, um de 50 g) vão à parte. Mesma regra de src/loja/util.js.
  select price into v_normal
    from cookies_catalogo
   where ativo_no_cardapio
   group by price
   order by count(*) desc, price asc
   limit 1;

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
      if coalesce(v_tast_price, 0) <= 0 then
        return jsonb_build_object('ok', false, 'motivo', 'A Tasting Box não está disponível de momento.');
      end if;
      v_tasting := v_tasting + v_item.qty;
      v_total   := v_total + v_item.qty * v_tast_price;
      v_linhas  := v_linhas || jsonb_build_object(
        'cookieId', 'tasting-box', 'qty', v_item.qty,
        'preco', v_tast_price, 'customLabel', 'Tasting Box'
      );

    elsif v_item.id = 'mini-box' then
      if coalesce(v_mini_price, 0) <= 0 then
        return jsonb_build_object('ok', false, 'motivo', 'A Mini Box não está disponível de momento.');
      end if;
      v_total  := v_total + v_item.qty * v_mini_price;
      v_need   := jsonb_set(v_need, array['mini-box'],
                    to_jsonb(coalesce((v_need->>'mini-box')::int, 0) + v_item.qty));
      v_linhas := v_linhas || jsonb_build_object(
        'cookieId', 'mini-box', 'qty', v_item.qty,
        'preco', v_mini_price, 'customLabel', 'Mini Box'
      );

    elsif v_item.id like 'mini50:%' then
      -- mini cookie de 50 g de um sabor: preço único, stock em cookie50
      if coalesce(v_m50_price, 0) <= 0 then
        return jsonb_build_object('ok', false, 'motivo', 'Os mini cookies não estão disponíveis de momento.');
      end if;
      v_m50_id := substr(v_item.id, 8);
      select * into v_cookie from cookies_catalogo
       where id = v_m50_id and ativo_no_cardapio;
      if not found then
        return jsonb_build_object('ok', false, 'motivo', 'Um dos sabores já não está disponível. Atualiza a página.');
      end if;
      v_total  := v_total + v_item.qty * v_m50_price;
      v_need50 := jsonb_set(v_need50, array[v_m50_id],
                    to_jsonb(coalesce((v_need50->>v_m50_id)::int, 0) + v_item.qty));
      v_linhas := v_linhas || jsonb_build_object(
        'cookieId', v_m50_id, 'qty', v_item.qty, 'preco', v_m50_price,
        'customLabel', coalesce(nullif(btrim(v_cookie.nome), ''), v_m50_id) || ' · 50 g'
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
      if v_normal is not null and v_cookie.price <> v_normal then
        return jsonb_build_object('ok', false, 'motivo',
          format('%s não entra na Box (vai à parte). Atualiza a página.', coalesce(nullif(btrim(v_cookie.nome), ''), v_par.id)));
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

  -- ── cupão: % sobre os cookies (não sobre a entrega), válido até ao fim do
  --    dia em Lisboa. Calculado aqui — o browser só manda o código ─────────────
  if v_cupom <> '' then
    select c into v_cupom_obj
      from jsonb_array_elements(coalesce(v_cfg.loja_cupons, '[]'::jsonb)) c
     where upper(btrim(c->>'codigo')) = v_cupom
       and coalesce(c->>'ativo', '') = 'true'
       and (coalesce(c->>'validoAte', '') !~ '^\d{4}-\d{2}-\d{2}$'
            or (now() at time zone 'Europe/Lisbon')::date <= (c->>'validoAte')::date)
     limit 1;
    if v_cupom_obj is null then
      return jsonb_build_object('ok', false, 'campo', 'cupom',
        'motivo', 'Este cupão não é válido ou já expirou.');
    end if;
    v_pct := case when (v_cupom_obj->>'percent') ~ '^\d+(\.\d+)?$'
                  then least((v_cupom_obj->>'percent')::numeric, 100) else 0 end;
    v_desconto := round(v_total * v_pct / 100, 2);
    v_cupom := upper(btrim(v_cupom_obj->>'codigo'));
  else
    v_cupom := null;
  end if;

  -- ── taxa de entrega por distância (linha reta) ─────────────────────────────
  -- Sem coordenadas (a morada não foi encontrada no mapa), aceita-se o pedido
  -- com a taxa "a confirmar" — a dona combina com o cliente.
  v_ent_cfg := coalesce(v_cfg.loja_entrega_config, '{}'::jsonb);
  if v_tipo = 'entrega'
     and coalesce(v_ent_cfg->>'ativo', '') = 'true'
     and (v_ent_cfg #>> '{origem,lat}') ~ '^-?\d+(\.\d+)?$'
     and (v_ent_cfg #>> '{origem,lng}') ~ '^-?\d+(\.\d+)?$'
     and jsonb_typeof(v_ent_cfg->'faixas') = 'array'
     and jsonb_array_length(v_ent_cfg->'faixas') > 0
  then
    if coalesce(v_ent->>'lat', '') ~ '^-?\d+(\.\d+)?$' and coalesce(v_ent->>'lng', '') ~ '^-?\d+(\.\d+)?$' then
      v_o_lat := (v_ent_cfg #>> '{origem,lat}')::numeric;
      v_o_lng := (v_ent_cfg #>> '{origem,lng}')::numeric;
      v_d_lat := (v_ent->>'lat')::numeric;
      v_d_lng := (v_ent->>'lng')::numeric;
      v_km := 2 * 6371 * asin(sqrt(
                power(sin(radians(v_d_lat - v_o_lat) / 2), 2) +
                cos(radians(v_o_lat)) * cos(radians(v_d_lat)) *
                power(sin(radians(v_d_lng - v_o_lng) / 2), 2)));

      select f into v_faixa
        from jsonb_array_elements(v_ent_cfg->'faixas') f
       where (f->>'ateKm') ~ '^\d+(\.\d+)?$' and v_km <= (f->>'ateKm')::numeric
       order by (f->>'ateKm')::numeric
       limit 1;
      if v_faixa is null then
        return jsonb_build_object('ok', false, 'campo', 'morada',
          'motivo', format('Ainda não entregamos tão longe (cerca de %s km). Podes escolher levantar.',
                           replace(round(v_km, 1)::text, '.', ',')));
      end if;

      v_taxa := case when (v_faixa->>'preco') ~ '^\d+(\.\d+)?$' then (v_faixa->>'preco')::numeric else 0 end;
      if v_taxa > 0 then
        v_linhas := v_linhas || jsonb_build_object(
          'cookieId', 'entrega', 'qty', 1, 'preco', v_taxa,
          'customLabel', format('Entrega (%s km)', replace(round(v_km, 1)::text, '.', ',')));
      end if;
      v_entrega := v_entrega || jsonb_build_object('distanciaKm', round(v_km, 1), 'taxa', v_taxa);
    else
      v_entrega := v_entrega || jsonb_build_object('taxaAConfirmar', true);
    end if;
  end if;

  -- ── stock: tranca as linhas antes de ler, para dois clientes em simultâneo
  --    não venderem o mesmo último cookie ─────────────────────────────────────
  perform 1 from estoque
   where (tipo = 'cookie'   and cookie_id in (select k from jsonb_object_keys(v_need) k))
      or (tipo = 'cookie50' and cookie_id in (select k from jsonb_object_keys(v_need50) k))
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

  -- mini cookies de 50 g: stock por sabor em cookie50
  for v_par in select key as id, value::int as qty from jsonb_each_text(v_need50) t(key, value)
  loop
    select coalesce(qty, 0) into v_have
      from estoque where tipo = 'cookie50' and cookie_id = v_par.id;
    v_have := coalesce(v_have, 0);
    if v_have < v_par.qty then
      select coalesce(nullif(short, ''), nome) into v_faltou
        from cookies_catalogo where id = v_par.id;
      return jsonb_build_object(
        'ok', false, 'esgotado', true,
        'motivo', format('Só temos %s %s de %s neste momento. Ajusta o carrinho.',
                         floor(v_have)::int,
                         case when floor(v_have) = 1 then 'mini cookie' else 'mini cookies' end,
                         coalesce(v_faltou, v_par.id))
      );
    end if;
  end loop;

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
  -- total = cookies − cupão + entrega
  v_total := v_total - v_desconto + v_taxa;

  insert into pedidos (cliente_id, linhas, box, total_eur, desconto, data_pedido,
                       forma_pagamento, status, notas, origem, referencia, entrega, cupom)
  values (
    v_cliente_id, v_linhas, v_box, v_total, v_desconto,
    current_date, v_pag, 'pendente',
    left(v_notas, 400),
    'loja', v_ref, v_entrega, v_cupom
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

  -- baixa dos mini cookies de 50 g
  insert into estoque (tipo, cookie_id, qty)
  select 'cookie50', t.key, greatest(0, coalesce(e.qty, 0) - t.value::int)
    from jsonb_each_text(v_need50) t(key, value)
    left join estoque e on e.tipo = 'cookie50' and e.cookie_id = t.key
  on conflict (tipo, cookie_id) do update set qty = excluded.qty;

  return jsonb_build_object(
    'ok', true,
    'pedidoId', v_pedido_id,
    'referencia', v_ref,
    'total', v_total,
    'desconto', v_desconto,
    'taxaEntrega', v_taxa
  );
end $$;

-- ────────────────────────────────────────────────────────────────────────────
-- 2b) Validar um cupão (para a loja mostrar o desconto antes de pedir)
-- ────────────────────────────────────────────────────────────────────────────
-- Responde só sobre o código escrito; nunca devolve a lista de cupões.
create or replace function loja_validar_cupom(p_codigo text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_cfg configuracao%rowtype;
  v_c   jsonb;
  v_cod text := upper(btrim(coalesce(p_codigo, '')));
begin
  if v_cod = '' then
    return jsonb_build_object('ok', false, 'motivo', 'Escreve o código do cupão.');
  end if;
  select * into v_cfg from configuracao where id = 'main';
  select c into v_c
    from jsonb_array_elements(coalesce(v_cfg.loja_cupons, '[]'::jsonb)) c
   where upper(btrim(c->>'codigo')) = v_cod
     and coalesce(c->>'ativo', '') = 'true'
     and (coalesce(c->>'validoAte', '') !~ '^\d{4}-\d{2}-\d{2}$'
          or (now() at time zone 'Europe/Lisbon')::date <= (c->>'validoAte')::date)
   limit 1;
  if v_c is null or coalesce(v_c->>'percent', '') !~ '^\d+(\.\d+)?$' then
    return jsonb_build_object('ok', false, 'motivo', 'Este cupão não é válido ou já expirou.');
  end if;
  return jsonb_build_object(
    'ok', true,
    'codigo', upper(btrim(v_c->>'codigo')),
    'percent', least((v_c->>'percent')::numeric, 100)
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
  v_etapa text;
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

  -- A etapa que o cliente vê (mesma regra de src/lib/etapas.js → etapaAtual).
  v_etapa := case
    when v_p.status = 'cancelado' then 'cancelado'
    when v_p.etapa in ('recebido', 'confirmado', 'preparando', 'pronto', 'a_caminho', 'entregue') then v_p.etapa
    when v_p.status = 'entregue' then 'entregue'
    when v_p.status = 'pago' then 'confirmado'
    else 'recebido'
  end;

  case v_etapa
    when 'preparando' then
      v_estado := 'Estamos a preparar os teus cookies';
      v_seguinte := 'Saem do forno em breve.';
    when 'pronto' then
      v_estado := case when v_tipo = 'levantar' then 'Está pronto! Podes vir buscar' else 'Está pronto' end;
      v_seguinte := case when v_tipo = 'levantar' then 'Combinamos contigo o sítio e a hora.' else 'Sai em breve para entrega.' end;
    when 'a_caminho' then
      v_estado := 'O teu pedido está a caminho';
      v_seguinte := 'Prepara o leite.';
    else
      v_estado := null;
  end case;

  if v_estado is null then
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
  end if;

  return jsonb_build_object(
    'ok', true,
    'referencia', v_p.referencia,
    'status', v_p.status,
    'etapa', v_etapa,
    'etapaEm', v_p.etapa_em,
    'desconto', v_p.desconto,
    'cupom', v_p.cupom,
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
revoke all on function loja_validar_cupom(text)  from public, anon, authenticated;
grant execute on function loja_cardapio()             to anon, authenticated;
grant execute on function loja_criar_pedido(jsonb)    to anon, authenticated;
grant execute on function loja_ver_pedido(text, text) to anon, authenticated;
grant execute on function loja_validar_cupom(text)    to anon, authenticated;
