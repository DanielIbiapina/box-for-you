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
--   loja_criar_pedido_black(jsonb) → pedido da campanha Black Crumb (combos)
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

-- Horário por dia da semana (nov/2026): `semana` tem uma entrada por dia,
-- 0 = domingo … 6 = sábado (como extract(dow) e o getDay() do JavaScript).
-- Um dia a null está fechado. `abre`/`fecha` ficam como o horário comum a
-- todos os dias, para quem ainda tenha a loja antiga aberta no telemóvel.
-- Só entra se a dona ainda não tiver horário por dia.
update configuracao
   set loja_horarios = loja_horarios || '{
     "abre": 15, "fecha": 19,
     "semana": {
       "0": {"abre": 10, "fecha": 22},
       "1": {"abre": 15, "fecha": 19},
       "2": {"abre": 15, "fecha": 19},
       "3": {"abre": 15, "fecha": 19},
       "4": {"abre": 15, "fecha": 19},
       "5": {"abre": 15, "fecha": 19},
       "6": {"abre": 13, "fecha": 22}
     }
   }'::jsonb
 where id = 'main' and not (loja_horarios ? 'semana');

-- Dados legais do vendedor, que a loja mostra no rodapé e em /legal/ (exigidos
-- pela Ifthenpay e pela lei do comércio eletrónico). A dona preenche em
-- Definições → Dados legais. { "nome", "nif", "morada", "telefone", "email" }
alter table configuracao add column if not exists loja_legal jsonb not null default '{}'::jsonb;
update configuracao
   set loja_legal = '{
     "nome": "", "nif": "",
     "morada": "Vereda 2 Manuel da Rocha Páris, 36, 4400-189 Vila Nova de Gaia",
     "telefone": "+351 939 826 591", "email": ""
   }'::jsonb
 where id = 'main' and loja_legal = '{}'::jsonb;

-- Campanhas com aba própria na loja (Black Crumb, Natal…). O pedido guarda de
-- que campanha veio, para a dona o distinguir em Vendas.
alter table pedidos add column if not exists campanha text;

-- Black Crumb (Black Friday, nov/2026). Horas em hora de Lisboa. Três fases:
--   1. até antecipadoAte (sex 19h): "encomenda antecipada" — selos a dobrar e
--      vantagem na entrega; marca-se de diasAntecipado[0] a diasAntecipado[1].
--   2. de antecipadoAte até reabre (sáb 0h): tudo fechado, ninguém encomenda.
--   3. de reabre até fim (seg 0h): Black Crumb outra vez, só para os dias de
--      diasNoDia (sáb e dom), com a taxa de entrega normal.
--   fechaLojaNormal: enquanto a campanha dura (até `fim`) a loja normal fica
--      fechada — só há a aba da Black Crumb. A partir de `fim` tudo volta ao normal.
--   combos:        N cookies por um preço fechado; cada combo leva
--                  brindePorCombo mini cookie(s) de 50 g de oferta.
--   Entrega: grátis a partir de freteGratisAPartirDe €; abaixo disso, a
--   encomenda antecipada não paga até antecipadoFreteGratisAteKm km e tem
--   antecipadoDescontoFrete € de desconto mais longe. Levantar é sempre grátis.
-- Os sabores estão sempre disponíveis: o stock desconta e pode ficar negativo
-- (é o que falta fazer).
alter table configuracao add column if not exists loja_black jsonb not null default '{}'::jsonb;

update configuracao
   set loja_black = '{
     "ativo": true,
     "nome": "Black Crumb",
     "antecipadoAte": "2026-11-27T19:00",
     "reabre": "2026-11-28T00:00",
     "fim": "2026-11-30T00:00",
     "fechaLojaNormal": true,
     "diasAntecipado": ["2026-11-28", "2026-12-06"],
     "diasNoDia": ["2026-11-28", "2026-11-29"],
     "combos": [
       {"id": "duo", "nome": "THE DUO",       "cookies": 2, "preco": 6,  "gramas": 250},
       {"id": "box", "nome": "THE BOX",       "cookies": 4, "preco": 10, "gramas": 450},
       {"id": "big", "nome": "THE BIG CRUMB", "cookies": 6, "preco": 14, "gramas": 650}
     ],
     "brindePorCombo": 1,
     "freteGratisAPartirDe": 20,
     "antecipadoFreteGratisAteKm": 7,
     "antecipadoDescontoFrete": 2
   }'::jsonb
 where id = 'main' and loja_black = '{}'::jsonb;

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

-- Horas de abrir e fechar num dia: [abre, fecha], ou null se estiver fechado.
-- Com `semana`, vale o horário desse dia da semana; sem ela, o horário único.
create or replace function loja_horario_dia(h jsonb, d date)
returns int[]
language plpgsql
immutable
set search_path = public
as $$
declare
  v_dia   jsonb;
  v_abre  int;
  v_fecha int;
begin
  h := coalesce(h, '{}'::jsonb);
  if jsonb_typeof(h->'semana') = 'object' then
    v_dia := h->'semana'->(extract(dow from d)::int::text);
    if v_dia is null or jsonb_typeof(v_dia) <> 'object'
       or coalesce(v_dia->>'abre', '') !~ '^\d{1,2}$'
       or coalesce(v_dia->>'fecha', '') !~ '^\d{1,2}$' then
      return null;
    end if;
    v_abre  := (v_dia->>'abre')::int;
    v_fecha := (v_dia->>'fecha')::int;
  else
    v_abre  := case when coalesce(h->>'abre', '') ~ '^\d{1,2}$' then (h->>'abre')::int else 10 end;
    v_fecha := case when coalesce(h->>'fecha', '') ~ '^\d{1,2}$' then (h->>'fecha')::int else 20 end;
  end if;
  if v_fecha <= v_abre or v_fecha > 24 then
    return null;
  end if;
  return array[v_abre, v_fecha];
end $$;

-- O que a loja precisa de saber da Black Crumb agora. Fora da campanha (antes
-- de ligar ou depois de `fim`) devolve { ativo: false } e a loja é a normal.
-- Dentro dela, `fase` diz em que ponto estamos:
--   'antecipado' → encomendas com vantagens, dias de diasAntecipado
--   'pausa'      → fechado até `reabre` (ninguém encomenda)
--   'noDia'      → só para os dias de diasNoDia que ainda não passaram
-- `aberta` = dá para encomendar agora; `fechaLoja` = a loja normal está fechada.
create or replace function loja_black_estado(c jsonb)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  v_agora  timestamp := now() at time zone 'Europe/Lisbon';
  v_hoje   date := (now() at time zone 'Europe/Lisbon')::date;
  v_ate    timestamp;
  v_reabre timestamp;
  v_fim    timestamp;
  v_fase   text;
  v_ant    boolean;
  v_dias   jsonb := '[]'::jsonb;
  v_combos jsonb;
  v_num    text := '^\d+(\.\d+)?$';
  v_ts     text := '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}';
begin
  c := coalesce(c, '{}'::jsonb);
  if coalesce(c->>'ativo', '') <> 'true' then
    return jsonb_build_object('ativo', false);
  end if;

  v_ate    := case when coalesce(c->>'antecipadoAte', '') ~ v_ts then (c->>'antecipadoAte')::timestamp end;
  v_reabre := case when coalesce(c->>'reabre', '') ~ v_ts then (c->>'reabre')::timestamp end;
  v_fim    := case when coalesce(c->>'fim', '') ~ v_ts then (c->>'fim')::timestamp end;
  if v_fim is not null and v_agora >= v_fim then
    return jsonb_build_object('ativo', false);
  end if;

  v_fase := case
    when v_ate is not null and v_agora < v_ate then 'antecipado'
    when v_reabre is not null and v_agora < v_reabre then 'pausa'
    else 'noDia'
  end;
  v_ant := v_fase = 'antecipado';

  if v_ant
     and coalesce(c#>>'{diasAntecipado,0}', '') ~ '^\d{4}-\d{2}-\d{2}$'
     and coalesce(c#>>'{diasAntecipado,1}', '') ~ '^\d{4}-\d{2}-\d{2}$' then
    select coalesce(jsonb_agg(to_char(d, 'YYYY-MM-DD') order by d), '[]'::jsonb)
      into v_dias
      from generate_series(greatest((c#>>'{diasAntecipado,0}')::date, v_hoje)::timestamp,
                           (c#>>'{diasAntecipado,1}')::date::timestamp,
                           interval '1 day') d;
  elsif v_fase = 'noDia' then
    select coalesce(jsonb_agg(x order by x), '[]'::jsonb)
      into v_dias
      from jsonb_array_elements_text(case when jsonb_typeof(c->'diasNoDia') = 'array'
                                          then c->'diasNoDia' else '[]'::jsonb end) x
     where case when x ~ '^\d{4}-\d{2}-\d{2}$' then x::date >= v_hoje else false end;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', x->>'id',
           'nome', coalesce(nullif(btrim(x->>'nome'), ''), x->>'id'),
           'cookies', (x->>'cookies')::int,
           'preco', (x->>'preco')::numeric,
           'gramas', case when coalesce(x->>'gramas', '') ~ '^\d+$' then (x->>'gramas')::int end
         ) order by (x->>'cookies')::int), '[]'::jsonb)
    into v_combos
    from jsonb_array_elements(case when jsonb_typeof(c->'combos') = 'array'
                                   then c->'combos' else '[]'::jsonb end) x
   where coalesce(x->>'id', '') <> ''
     and case when coalesce(x->>'cookies', '') ~ '^\d{1,2}$' then (x->>'cookies')::int > 0 else false end
     and coalesce(x->>'preco', '') ~ v_num;

  if jsonb_array_length(v_combos) = 0 then
    return jsonb_build_object('ativo', false);
  end if;

  return jsonb_build_object(
    'ativo', true,
    'nome', coalesce(nullif(btrim(c->>'nome'), ''), 'Black Crumb'),
    'fase', v_fase,
    'aberta', v_fase <> 'pausa' and jsonb_array_length(v_dias) > 0,
    'fechaLoja', coalesce(c->>'fechaLojaNormal', '') = 'true',
    'antecipado', v_ant,
    'antecipadoAte', case when v_ant then to_char(v_ate, 'YYYY-MM-DD"T"HH24:MI') end,
    'reabre', case when v_fase = 'pausa' then to_char(v_reabre, 'YYYY-MM-DD"T"HH24:MI') end,
    'fim', to_char(v_fim, 'YYYY-MM-DD"T"HH24:MI'),
    'diasNoDia', case when jsonb_typeof(c->'diasNoDia') = 'array' then c->'diasNoDia' else '[]'::jsonb end,
    'dias', v_dias,
    'combos', v_combos,
    'brindePorCombo', case when coalesce(c->>'brindePorCombo', '') ~ '^\d+$' then (c->>'brindePorCombo')::int else 0 end,
    'freteGratisAPartirDe', case when coalesce(c->>'freteGratisAPartirDe', '') ~ v_num then (c->>'freteGratisAPartirDe')::numeric end,
    'antecipadoFreteGratisAteKm', case when coalesce(c->>'antecipadoFreteGratisAteKm', '') ~ v_num then (c->>'antecipadoFreteGratisAteKm')::numeric end,
    'antecipadoDescontoFrete', case when coalesce(c->>'antecipadoDescontoFrete', '') ~ v_num then (c->>'antecipadoDescontoFrete')::numeric end
  );
end $$;

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
      'agora', to_char(now() at time zone 'Europe/Lisbon', 'YYYY-MM-DD"T"HH24:MI:SS'),
      -- horário de cada dia da semana (0 = domingo); null = fechado. 2023-01-01 foi domingo.
      'semana', case when jsonb_typeof(v_cfg.loja_horarios->'semana') = 'object' then (
        select jsonb_object_agg(k::text, case when r is null then 'null'::jsonb
                                              else jsonb_build_object('abre', r[1], 'fecha', r[2]) end)
          from generate_series(0, 6) k,
               lateral (select loja_horario_dia(v_cfg.loja_horarios, date '2023-01-01' + k) as r) x
      ) end
    ),
    -- campanha Black Crumb: combos, dias marcáveis e regras ({ ativo: false } fora do prazo)
    'black', loja_black_estado(v_cfg.loja_black),
    -- identificação do vendedor (rodapé e /legal/); só os campos preenchidos
    'legal', (select coalesce(jsonb_object_agg(k, left(btrim(v), 200)), '{}'::jsonb)
                from jsonb_each_text(coalesce(v_cfg.loja_legal, '{}'::jsonb)) e(k, v)
               where k in ('nome', 'nif', 'morada', 'telefone', 'email') and btrim(v) <> ''),
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
  v_hd         int[];
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
  v_bf         jsonb;
begin
  -- ── loja fechada durante uma campanha (ex.: Black Crumb) ──────────────────
  select * into v_cfg from configuracao where id = 'main';
  v_bf := loja_black_estado(v_cfg.loja_black);
  if coalesce((v_bf->>'ativo')::boolean, false) and coalesce((v_bf->>'fechaLoja')::boolean, false) then
    return jsonb_build_object('ok', false, 'fim', true, 'motivo',
      case when coalesce(v_bf->>'fim', '') ~ '^\d{4}-\d{2}-\d{2}'
           then format('Por agora só temos a Black Crumb. A loja normal volta no dia %s.',
                       to_char(left(v_bf->>'fim', 10)::date, 'DD/MM'))
           else 'Por agora só temos a Black Crumb.' end);
  end if;

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

  -- ── hora: faixa de 1 hora dentro do horário desse dia, com antecedência
  --    mínima (hora de Lisboa) ─────────────────────────────────────────────
  v_hd := loja_horario_dia(v_cfg.loja_horarios, v_data::date);
  if v_hd is null then
    return jsonb_build_object('ok', false, 'campo', 'data', 'motivo', 'Nesse dia estamos fechados. Escolhe outro dia.');
  end if;
  v_abre  := v_hd[1];
  v_fecha := v_hd[2];
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
  -- Sem coordenadas (a morada não foi encontrada no mapa) NÃO se aceita a
  -- entrega: antes ficava "a confirmar" e passou uma entrega a 38 km sem taxa.
  -- precisao = 'localidade': a loja só achou a localidade, a distância é
  -- aproximada e fica marcada para a dona ver.
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
      v_entrega := v_entrega || jsonb_build_object('distanciaKm', round(v_km, 1), 'taxa', v_taxa)
                   || case when v_ent->>'precisao' = 'localidade' then '{"aprox": true}'::jsonb else '{}'::jsonb end;
    else
      return jsonb_build_object('ok', false, 'campo', 'morada', 'motivo',
        'Não encontrámos esta morada no mapa. Confirma a rua, a localidade e o código postal, ou fala connosco no WhatsApp para combinarmos a entrega.');
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
                         greatest(0, floor(v_have))::int, coalesce(v_faltou, v_par.id))
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
                         greatest(0, floor(v_have))::int,
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
-- 2a) Levantamento / entrega de um pedido de campanha
-- ────────────────────────────────────────────────────────────────────────────
-- As mesmas regras do loja_criar_pedido (tipo, dia, faixa de hora no horário
-- desse dia, local ligado, distância), num sítio só para as campanhas.
-- Devolve { ok: false, campo, motivo } ou
--   { ok: true, entrega, entregaAtiva, km, taxa, semMapa }
-- onde `taxa` é a da tabela por distância — cada campanha aplica as suas regras.
create or replace function loja_entrega_validar(p jsonb, c configuracao)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  v_ent        jsonb := p->'entrega';
  v_tipo       text;
  v_data       text;
  v_morada     text;
  v_localidade text;
  v_cp         text;
  v_hora       text;
  v_h          int;
  v_hd         int[];
  v_antec      numeric;
  v_locais     jsonb;
  v_local      jsonb;
  v_entrega    jsonb;
  v_ent_cfg    jsonb;
  v_faixa      jsonb;
  v_km         numeric;
begin
  if v_ent is null or jsonb_typeof(v_ent) <> 'object' then
    v_ent := '{}'::jsonb;
  end if;
  v_tipo       := btrim(coalesce(v_ent->>'tipo', ''));
  v_data       := btrim(coalesce(v_ent->>'data', ''));
  v_morada     := btrim(coalesce(v_ent->>'morada', ''));
  v_localidade := btrim(coalesce(v_ent->>'localidade', ''));
  v_cp         := btrim(coalesce(v_ent->>'cp', ''));
  v_hora       := btrim(coalesce(v_ent->>'hora', ''));

  if v_tipo not in ('levantar', 'entrega') then
    return jsonb_build_object('ok', false, 'campo', 'entrega',
      'motivo', 'Diz-nos se preferes levantar ou receber em casa.');
  end if;
  if v_data !~ '^\d{4}-\d{2}-\d{2}$' then
    return jsonb_build_object('ok', false, 'campo', 'data', 'motivo', 'Escolhe o dia em que queres os cookies.');
  end if;
  if v_data::date < (now() at time zone 'Europe/Lisbon')::date then
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

  v_hd := loja_horario_dia(c.loja_horarios, v_data::date);
  if v_hd is null then
    return jsonb_build_object('ok', false, 'campo', 'data', 'motivo', 'Nesse dia estamos fechados. Escolhe outro dia.');
  end if;
  v_antec := case when (c.loja_horarios->>'antecedenciaHoras') ~ '^\d+(\.\d+)?$'
                  then (c.loja_horarios->>'antecedenciaHoras')::numeric else 2 end;
  if v_hora !~ '^\d{2}:00$' then
    return jsonb_build_object('ok', false, 'campo', 'hora', 'motivo', 'Escolhe a hora.');
  end if;
  v_h := substr(v_hora, 1, 2)::int;
  if v_h < v_hd[1] or v_h >= v_hd[2] then
    return jsonb_build_object('ok', false, 'campo', 'hora', 'motivo', 'Essa hora não está disponível. Escolhe outra.');
  end if;
  if v_data::date + make_interval(hours => v_h)
     < (now() at time zone 'Europe/Lisbon') + v_antec * interval '1 hour' then
    return jsonb_build_object('ok', false, 'campo', 'hora',
      'motivo', format('Precisamos de pelo menos %s horas para preparar. Escolhe uma hora mais tarde.',
                       replace(trim(trailing '.' from trim(trailing '0' from v_antec::text)), '.', ',')));
  end if;

  v_locais := coalesce(c.loja_locais_levantamento, '[]'::jsonb);
  if v_tipo = 'levantar' and jsonb_array_length(v_locais) > 0 then
    if not exists (select 1 from jsonb_array_elements(v_locais) l where coalesce((l->>'ativo')::boolean, false)) then
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

  v_ent_cfg := coalesce(c.loja_entrega_config, '{}'::jsonb);
  if v_tipo <> 'entrega'
     or coalesce(v_ent_cfg->>'ativo', '') <> 'true'
     or coalesce(v_ent_cfg #>> '{origem,lat}', '') !~ '^-?\d+(\.\d+)?$'
     or coalesce(v_ent_cfg #>> '{origem,lng}', '') !~ '^-?\d+(\.\d+)?$'
     or jsonb_typeof(v_ent_cfg->'faixas') is distinct from 'array'
     or jsonb_array_length(v_ent_cfg->'faixas') = 0 then
    return jsonb_build_object('ok', true, 'entrega', v_entrega, 'entregaAtiva', false);
  end if;

  -- sem coordenadas (a morada não apareceu no mapa) não se aceita a entrega:
  -- antes ficava "a confirmar" e passou uma entrega a 38 km sem taxa
  if coalesce(v_ent->>'lat', '') !~ '^-?\d+(\.\d+)?$' or coalesce(v_ent->>'lng', '') !~ '^-?\d+(\.\d+)?$' then
    return jsonb_build_object('ok', false, 'campo', 'morada', 'motivo',
      'Não encontrámos esta morada no mapa. Confirma a rua, a localidade e o código postal, ou fala connosco no WhatsApp para combinarmos a entrega.');
  end if;
  -- só se achou a localidade: a distância é aproximada (a dona vê isto em Vendas)
  if v_ent->>'precisao' = 'localidade' then
    v_entrega := v_entrega || '{"aprox": true}'::jsonb;
  end if;

  v_km := 2 * 6371 * asin(sqrt(
            power(sin(radians((v_ent->>'lat')::numeric - (v_ent_cfg #>> '{origem,lat}')::numeric) / 2), 2) +
            cos(radians((v_ent_cfg #>> '{origem,lat}')::numeric)) * cos(radians((v_ent->>'lat')::numeric)) *
            power(sin(radians((v_ent->>'lng')::numeric - (v_ent_cfg #>> '{origem,lng}')::numeric) / 2), 2)));

  select f into v_faixa
    from jsonb_array_elements(v_ent_cfg->'faixas') f
   where (f->>'ateKm') ~ '^\d+(\.\d+)?$'
     and v_km <= case when (f->>'ateKm') ~ '^\d+(\.\d+)?$' then (f->>'ateKm')::numeric end
   order by case when (f->>'ateKm') ~ '^\d+(\.\d+)?$' then (f->>'ateKm')::numeric end
   limit 1;
  if v_faixa is null then
    return jsonb_build_object('ok', false, 'campo', 'morada',
      'motivo', format('Ainda não entregamos tão longe (cerca de %s km). Podes escolher levantar.',
                       replace(round(v_km, 1)::text, '.', ',')));
  end if;

  return jsonb_build_object(
    'ok', true, 'entrega', v_entrega, 'entregaAtiva', true, 'semMapa', false,
    'km', round(v_km, 1),
    'taxa', case when (v_faixa->>'preco') ~ '^\d+(\.\d+)?$' then (v_faixa->>'preco')::numeric else 0 end
  );
end $$;

-- ────────────────────────────────────────────────────────────────────────────
-- 2c) Pedido da Black Crumb
-- ────────────────────────────────────────────────────────────────────────────
-- Entrada:
-- {
--   "cliente": { "nome": "...", "telefone": "..." },
--   "combos":  [ { "combo": "duo", "sabores": { "nutella": 1, "pistache": 1 },
--                  "minis": ["pistache"] } ],
--   "entrega": { ... como no loja_criar_pedido ... },
--   "notas":   "..."
-- }
-- Pagamento só por MB WAY, na hora. O preço de cada combo, o brinde e a taxa
-- de entrega saem daqui (configuracao.loja_black) — o browser só manda a escolha.
-- Cada combo vira uma linha com etiqueta e com `stock` (os sabores que tirou),
-- para a app devolver o stock certo se o pedido for cancelado. O mini de oferta
-- (brindePorCombo por combo) é escolhido pelo cliente em `minis`; sai do stock de
-- 50 g e fica numa linha a 0 € com `stock50`. Sem `minis` (loja antiga) é surpresa.
-- Saída: { ok: true, pedidoId, referencia, total, taxaEntrega, antecipado } | { ok: false, motivo, campo }
create or replace function loja_criar_pedido_black(p jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_cfg     configuracao%rowtype;
  v_bf      jsonb;
  v_ant     boolean;
  v_nome    text := btrim(coalesce(p#>>'{cliente,nome}', ''));
  v_tel     text := btrim(coalesce(p#>>'{cliente,telefone}', ''));
  v_notas   text := btrim(coalesce(p->>'notas', ''));
  v_combos  jsonb := coalesce(p->'combos', '[]'::jsonb);
  v_val     jsonb;
  v_entrega jsonb;
  v_combo   jsonb;
  v_def     jsonb;
  v_par     record;
  v_cookie  record;
  v_soma    int;
  v_resumo  text;
  v_stock   jsonb;
  v_need    jsonb := '{}'::jsonb;
  v_linhas  jsonb := '[]'::jsonb;
  v_n       int := 0;
  v_bpc     int;                       -- minis de oferta por combo
  v_mini    text;
  v_need50  jsonb := '{}'::jsonb;      -- { cookieId: qty } de minis escolhidos
  v_surpresa int := 0;                 -- minis sem sabor escolhido (loja antiga)
  v_total   numeric := 0;
  v_taxa    numeric := 0;
  v_km      numeric;
  v_gratis  numeric;
  v_ate_km  numeric;
  v_desc    numeric;
  v_cliente_id text;
  v_pedido_id  text;
  v_ref     text;
begin
  select * into v_cfg from configuracao where id = 'main';
  v_bf := loja_black_estado(v_cfg.loja_black);
  if not coalesce((v_bf->>'ativo')::boolean, false) then
    return jsonb_build_object('ok', false, 'fim', true, 'motivo', 'A Black Crumb já terminou. Obrigada!');
  end if;
  if v_bf->>'fase' = 'pausa' then
    return jsonb_build_object('ok', false, 'fim', true, 'motivo',
      format('As encomendas estão fechadas por agora. Voltamos a abrir no dia %s.',
             to_char((v_bf->>'reabre')::timestamp, 'DD/MM')));
  end if;
  if not coalesce((v_bf->>'aberta')::boolean, false) then
    return jsonb_build_object('ok', false, 'fim', true, 'motivo', 'As encomendas da Black Crumb já terminaram. Obrigada!');
  end if;
  v_ant := coalesce((v_bf->>'antecipado')::boolean, false);

  -- ── contacto ─────────────────────────────────────────────────────────────
  if length(v_nome) < 2 then
    return jsonb_build_object('ok', false, 'campo', 'nome', 'motivo', 'Diz-nos o teu nome.');
  end if;
  if length(regexp_replace(v_tel, '\D', '', 'g')) < 6 then
    return jsonb_build_object('ok', false, 'campo', 'telefone', 'motivo', 'Precisamos de um telemóvel para confirmar o pedido.');
  end if;

  -- ── combos ───────────────────────────────────────────────────────────────
  if jsonb_typeof(v_combos) <> 'array' or jsonb_array_length(v_combos) = 0 then
    return jsonb_build_object('ok', false, 'motivo', 'Escolhe pelo menos um combo.');
  end if;
  if jsonb_array_length(v_combos) > 20 then
    return jsonb_build_object('ok', false, 'motivo', 'Para encomendas grandes, fala connosco diretamente.');
  end if;
  v_bpc := coalesce((v_bf->>'brindePorCombo')::int, 0);

  for v_combo in select value from jsonb_array_elements(v_combos)
  loop
    v_def := null;
    select x into v_def
      from jsonb_array_elements(v_bf->'combos') x
     where x->>'id' = coalesce(v_combo->>'combo', '')
     limit 1;
    if v_def is null then
      return jsonb_build_object('ok', false, 'motivo', 'Esse combo já não existe. Atualiza a página.');
    end if;
    if jsonb_typeof(v_combo->'sabores') is distinct from 'object' then
      return jsonb_build_object('ok', false, 'motivo', format('Escolhe os sabores do %s.', v_def->>'nome'));
    end if;

    v_soma := 0;
    v_resumo := '';
    v_stock := '{}'::jsonb;
    for v_par in
      select key as id,
             case when value ~ '^\d{1,2}$' then value::int else 0 end as qty
      from jsonb_each_text(v_combo->'sabores') t(key, value)
    loop
      if v_par.qty <= 0 then continue; end if;
      select * into v_cookie from cookies_catalogo
       where id = v_par.id and ativo_no_cardapio;
      if not found then
        return jsonb_build_object('ok', false, 'motivo', 'Um dos sabores já não está disponível. Atualiza a página.');
      end if;
      v_soma   := v_soma + v_par.qty;
      v_resumo := v_resumo || case when v_resumo = '' then '' else ', ' end
                            || v_par.qty || '× ' || coalesce(nullif(v_cookie.short, ''), v_cookie.nome);
      v_stock  := v_stock || jsonb_build_object(v_par.id, v_par.qty);
      v_need   := jsonb_set(v_need, array[v_par.id],
                    to_jsonb(coalesce((v_need->>v_par.id)::int, 0) + v_par.qty));
    end loop;

    if v_soma <> (v_def->>'cookies')::int then
      return jsonb_build_object('ok', false, 'motivo',
        format('O %s leva exatamente %s cookies.', v_def->>'nome', v_def->>'cookies'));
    end if;

    v_n     := v_n + 1;
    v_total := v_total + (v_def->>'preco')::numeric;
    v_linhas := v_linhas || jsonb_build_object(
      'cookieId', format('black-%s-%s', v_def->>'id', v_n),
      'qty', 1,
      'preco', (v_def->>'preco')::numeric,
      'customLabel', format('%s · %s', v_def->>'nome', v_resumo),
      'stock', v_stock
    );

    -- os minis de oferta deste combo, com o sabor que o cliente escolheu
    if v_bpc > 0 then
      if jsonb_typeof(v_combo->'minis') = 'array' then
        if jsonb_array_length(v_combo->'minis') <> v_bpc then
          return jsonb_build_object('ok', false, 'motivo',
            format('Escolhe o sabor do mini cookie de oferta do %s.', v_def->>'nome'));
        end if;
        for v_mini in select value from jsonb_array_elements_text(v_combo->'minis')
        loop
          if not exists (select 1 from cookies_catalogo where id = v_mini and ativo_no_cardapio) then
            return jsonb_build_object('ok', false, 'motivo', 'O sabor do mini já não está disponível. Atualiza a página.');
          end if;
          v_need50 := jsonb_set(v_need50, array[v_mini],
                        to_jsonb(coalesce((v_need50->>v_mini)::int, 0) + 1));
        end loop;
      else
        v_surpresa := v_surpresa + v_bpc;
      end if;
    end if;
  end loop;

  -- minis de oferta: uma linha a 0 € por sabor, com o stock de 50 g que tiram
  for v_par in
    select t.key as id, t.value::int as qty, c.nome, c.short
      from jsonb_each_text(v_need50) t(key, value)
      join cookies_catalogo c on c.id = t.key
     order by c.nome
  loop
    v_linhas := v_linhas || jsonb_build_object(
      'cookieId', 'black-mini-' || v_par.id, 'qty', v_par.qty, 'preco', 0,
      'customLabel', format('Mini %s 50 g (oferta)', coalesce(nullif(btrim(v_par.nome), ''), v_par.id)),
      'stock50', jsonb_build_object(v_par.id, 1)
    );
  end loop;
  if v_surpresa > 0 then
    v_linhas := v_linhas || jsonb_build_object(
      'cookieId', 'black-brinde', 'qty', v_surpresa, 'preco', 0,
      'customLabel', 'Mini cookie 50 g de oferta (sabor surpresa)'
    );
  end if;

  -- ── levantamento / entrega ───────────────────────────────────────────────
  v_val := loja_entrega_validar(p, v_cfg);
  if not coalesce((v_val->>'ok')::boolean, false) then
    return v_val;
  end if;
  v_entrega := v_val->'entrega';
  if not ((v_bf->'dias') ? (v_entrega->>'data')) then
    return jsonb_build_object('ok', false, 'campo', 'data',
      'motivo', 'Esse dia não está disponível na Black Crumb. Escolhe outro.');
  end if;

  -- ── taxa de entrega com as regras da campanha ────────────────────────────
  if v_entrega->>'tipo' = 'entrega' and coalesce((v_val->>'entregaAtiva')::boolean, false) then
    v_gratis := (v_bf->>'freteGratisAPartirDe')::numeric;
    v_ate_km := (v_bf->>'antecipadoFreteGratisAteKm')::numeric;
    v_desc   := (v_bf->>'antecipadoDescontoFrete')::numeric;
    v_km     := (v_val->>'km')::numeric;

    if v_gratis is not null and v_total >= v_gratis then
      v_taxa := 0;
      v_entrega := v_entrega || jsonb_strip_nulls(jsonb_build_object('distanciaKm', v_km, 'taxa', 0));
    elsif coalesce((v_val->>'semMapa')::boolean, false) then
      v_entrega := v_entrega || jsonb_build_object('taxaAConfirmar', true);
    else
      v_taxa := coalesce((v_val->>'taxa')::numeric, 0);
      if v_ant and v_ate_km is not null and v_km <= v_ate_km then
        v_taxa := 0;
      elsif v_ant and v_desc is not null then
        v_taxa := greatest(0, v_taxa - v_desc);
      end if;
      if v_taxa > 0 then
        v_linhas := v_linhas || jsonb_build_object(
          'cookieId', 'entrega', 'qty', 1, 'preco', v_taxa,
          'customLabel', format('Entrega (%s km)', replace(v_km::text, '.', ',')));
      end if;
      v_entrega := v_entrega || jsonb_build_object('distanciaKm', v_km, 'taxa', v_taxa);
    end if;
  end if;

  if v_ant then
    v_entrega := v_entrega || jsonb_build_object('antecipado', true);
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
    values (left(v_nome, 80), left(v_tel, 40), '', '', 'Cliente da loja online')
    returning id into v_cliente_id;
  elsif (select count(*) from pedidos
          where cliente_id = v_cliente_id and origem = 'loja'
            and status = 'pendente' and criado_em > now() - interval '24 hours') >= 5 then
    return jsonb_build_object('ok', false, 'motivo',
      'Já tens pedidos por confirmar. Falamos contigo em breve!');
  end if;

  v_ref := loja_nova_referencia();
  v_total := v_total + v_taxa;

  insert into pedidos (cliente_id, linhas, box, total_eur, desconto, data_pedido,
                       forma_pagamento, status, notas, origem, referencia, entrega, campanha)
  values (v_cliente_id, v_linhas, null, v_total, 0, current_date,
          'MB WAY', 'pendente', left(v_notas, 400), 'loja', v_ref, v_entrega, 'black')
  returning id into v_pedido_id;

  -- ── stock: desconta sempre, mesmo que fique negativo (é o que falta fazer).
  --    Soma no banco, para dois pedidos ao mesmo tempo não se atropelarem ──
  insert into estoque (tipo, cookie_id, qty)
  select 'cookie', t.key, -(t.value::numeric)
    from jsonb_each_text(v_need) t(key, value)
  on conflict (tipo, cookie_id) do update set qty = estoque.qty + excluded.qty;

  -- os minis de oferta saem do stock de 50 g, com a mesma regra
  insert into estoque (tipo, cookie_id, qty)
  select 'cookie50', t.key, -(t.value::numeric)
    from jsonb_each_text(v_need50) t(key, value)
  on conflict (tipo, cookie_id) do update set qty = estoque.qty + excluded.qty;

  return jsonb_build_object(
    'ok', true,
    'pedidoId', v_pedido_id,
    'referencia', v_ref,
    'total', v_total,
    'taxaEntrega', v_taxa,
    'antecipado', v_ant
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
      v_seguinte := case when v_p.campanha = 'black' and v_p.forma_pagamento = 'MB WAY'
        then 'Assim que recebermos o MB WAY, confirmamos a tua encomenda.'
        else case v_p.forma_pagamento
        when 'MB WAY' then 'Vamos enviar-te o pedido de pagamento MB WAY para o número que deixaste.'
        when 'Dinheiro' then
          case when v_tipo = 'levantar'
            then 'Pagas em dinheiro quando levantares. Falamos contigo em breve.'
            else 'Pagas em dinheiro na entrega. Falamos contigo em breve.'
          end
        else 'Falamos contigo em breve para confirmar tudo.'
      end end;
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
    'campanha', v_p.campanha,
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
revoke all on function loja_horario_dia(jsonb, date) from public, anon, authenticated;
revoke all on function loja_black_estado(jsonb)   from public, anon, authenticated;
revoke all on function loja_entrega_validar(jsonb, configuracao) from public, anon, authenticated;
revoke all on function loja_criar_pedido_black(jsonb) from public, anon, authenticated;
grant execute on function loja_cardapio()             to anon, authenticated;
grant execute on function loja_criar_pedido(jsonb)    to anon, authenticated;
grant execute on function loja_criar_pedido_black(jsonb) to anon, authenticated;
grant execute on function loja_ver_pedido(text, text) to anon, authenticated;
grant execute on function loja_validar_cupom(text)    to anon, authenticated;
