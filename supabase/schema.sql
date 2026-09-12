-- ============================================================================
-- Box for You — esquema Supabase (substitui o blob único bfy:* por tabelas)
-- Rode este script inteiro no Supabase → SQL Editor.
-- NÃO destrutivo: cria tabelas novas ao lado do 'business_data' antigo.
-- Idempotente: pode rodar de novo (usa IF NOT EXISTS / DROP POLICY IF EXISTS).
--
-- IDs são TEXT de propósito, para preservar EXATAMENTE os ids atuais
-- (UUIDs e ids legados como 'fixo-aluguel', 'legacy-mm', 'red-white').
-- Registros novos ganham um UUID automático.
-- ============================================================================

-- ---------- Catálogo de cookies (bfy:feiras-cookies) ----------
create table if not exists cookies_catalogo (
  id                text primary key default gen_random_uuid()::text,
  nome              text    not null default '',
  short             text    not null default '',
  emoji             text    not null default '',
  price             numeric not null default 0,
  image             text    not null default '',
  ativo_no_cardapio boolean not null default true,
  updated_at        timestamptz not null default now()
);

-- ---------- Ingredientes (matéria-prima) (bfy:ingredientes) ----------
create table if not exists ingredientes (
  id                text primary key default gen_random_uuid()::text,
  nome              text    not null default '',
  unidade           text    not null default 'g',
  estoque_atual     numeric not null default 0,
  estoque_minimo    numeric not null default 0,
  custo_por_unidade numeric not null default 0,
  updated_at        timestamptz not null default now()
);

-- ---------- Movimentações de estoque (bfy:movimentacoes) ----------
create table if not exists movimentacoes (
  id             text primary key default gen_random_uuid()::text,
  ingrediente_id text references ingredientes(id) on delete cascade,
  tipo           text    not null default 'entrada',   -- 'entrada' | 'saida'
  quantidade     numeric not null default 0,
  motivo         text    not null default '',
  data           timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- ---------- Receitas (bfy:receitas) ----------
create table if not exists receitas (
  id              text primary key default gen_random_uuid()::text,
  nome            text    not null default '',
  emoji           text    not null default '',
  categoria       text    not null default 'classico',
  descricao       text    not null default '',
  observacoes     text    not null default '',
  rendimento      numeric not null default 0,
  tempo_forno     numeric,
  tempo_preparo   numeric,
  cookie_do_mes   boolean not null default false,
  eh_receita_base boolean not null default false,
  -- itens ficam como JSONB: são sempre lidos/gravados junto com a receita
  -- [{ tipo?, nome, unidade, quantidade, ingredienteId?, receitaBaseId? }]
  ingredientes    jsonb   not null default '[]'::jsonb,
  criada_em       timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ---------- Eventos / feiras (bfy:eventos) ----------
create table if not exists eventos (
  id             text primary key default gen_random_uuid()::text,
  nome           text    not null default '',
  local          text    not null default '',
  data           date,
  status         text    not null default 'planejada',
  taxa_inscricao numeric not null default 0,
  updated_at     timestamptz not null default now()
);

-- ---------- Clientes (bfy:clientes) ----------
create table if not exists clientes (
  id         text primary key default gen_random_uuid()::text,
  nome       text not null default '',
  telefone   text not null default '',
  instagram  text not null default '',
  email      text not null default '',
  notas      text not null default '',
  criado_em  timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- Vendas (POS das feiras — cookies-sales:v1) ----------
create table if not exists vendas (
  id          text primary key default gen_random_uuid()::text,
  kind        text    not null default 'single',      -- 'single'|'box'|'demo'|'order'
  lines       jsonb   not null default '[]'::jsonb,   -- [{ qty, productId, customLabel?, ... }]
  flavor_id   text,
  demo_flavor_id text,                                 -- sabor da demonstração grátis
  box_flavors jsonb   not null default '[]'::jsonb,
  payment_id  text,
  total_eur   numeric not null default 0,
  desconto    numeric not null default 0,
  event_id    text references eventos(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------- Pedidos (vendas diretas — bfy:pedidos-vendas) ----------
create table if not exists pedidos (
  id              text primary key default gen_random_uuid()::text,
  cliente_id      text references clientes(id) on delete set null,
  linhas          jsonb   not null default '[]'::jsonb,   -- [{ cookieId, qty, preco, customLabel? }]
  box             jsonb,                                  -- { counts, priceEur } | null
  total_eur       numeric not null default 0,
  desconto        numeric not null default 0,
  data_pedido     date,
  forma_pagamento text    not null default '',
  status          text    not null default 'pendente',
  notas           text    not null default '',
  criado_em       timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ---------- Custos fixos (templates) (bfy:custos-fixos) ----------
create table if not exists custos_fixos (
  id           text primary key default gen_random_uuid()::text,
  nome         text    not null default '',
  valor_padrao numeric not null default 0,
  updated_at   timestamptz not null default now()
);

-- ---------- Despesas (bfy:despesas) ----------
create table if not exists despesas (
  id            text primary key default gen_random_uuid()::text,
  data          date,
  categoria     text    not null default 'outro',
  valor_eur     numeric not null default 0,
  descricao     text    not null default '',
  pago          boolean not null default true,
  origem        text    not null default 'manual',   -- 'manual'|'inscricao-evento'|'custo-fixo'
  event_id      text references eventos(id) on delete set null,
  custo_fixo_id text references custos_fixos(id) on delete set null,
  mes_ref       text,                                 -- 'YYYY-MM'
  updated_at    timestamptz not null default now()
);

-- ---------- Estoque de cookies/massa prontos (bfy:estoque-cookies / -massa) ----------
-- Mapas { cookieId: qty } viram linhas. Sem FK (há ids legados e mini-box).
create table if not exists estoque (
  tipo       text not null,          -- 'cookie' | 'massa'
  cookie_id  text not null,
  qty        numeric not null default 0,
  updated_at timestamptz not null default now(),
  primary key (tipo, cookie_id)
);

-- ---------- Configuração + config das caixas (singleton) ----------
-- Junta bfy:configuracoes + bfy:feiras-box + bfy:feiras-minibox numa linha só.
create table if not exists configuracao (
  id                text primary key default 'main',
  nome_negocio      text    not null default 'Box for You',
  nome_proprietaria text    not null default '',
  moeda             text    not null default '€',
  meta_lucro_mensal numeric not null default 0,
  formas_pagamento  jsonb   not null default '[]'::jsonb,
  box_config        jsonb   not null default '{"size":4,"price":12}'::jsonb,
  mini_box_config   jsonb   not null default '{"price":7}'::jsonb,
  updated_at        timestamptz not null default now()
);

-- colunas acrescentadas depois da 1ª versão (idempotente p/ tabelas já criadas)
alter table vendas add column if not exists demo_flavor_id text;
alter table pedidos add column if not exists origem text not null default 'app';
alter table pedidos add column if not exists referencia text;
alter table pedidos add column if not exists entrega jsonb;
create unique index if not exists idx_pedidos_referencia
  on pedidos (referencia) where referencia is not null;

-- Tasting Box: 1 cookie de 50g de cada sabor ativo no cardápio, preço fixo.
alter table configuracao add column if not exists tasting_box_config jsonb
  not null default '{"price":16}'::jsonb;
alter table configuracao add column if not exists loja_instrucoes_levantamento text not null default '';
alter table configuracao add column if not exists loja_instrucoes_entrega text not null default '';

-- ---------- Índices úteis para relatórios/consultas ----------
create index if not exists idx_vendas_created_at on vendas (created_at desc);
create index if not exists idx_vendas_event      on vendas (event_id);
create index if not exists idx_pedidos_cliente    on pedidos (cliente_id);
create index if not exists idx_pedidos_data       on pedidos (data_pedido desc);
create index if not exists idx_pedidos_status     on pedidos (status);
create index if not exists idx_despesas_data      on despesas (data desc);
create index if not exists idx_despesas_event     on despesas (event_id);
create index if not exists idx_despesas_mesref    on despesas (mes_ref);
create index if not exists idx_mov_ingrediente    on movimentacoes (ingrediente_id);
create index if not exists idx_mov_data           on movimentacoes (data desc);

-- ---------- updated_at automático em toda UPDATE ----------
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array[
    'cookies_catalogo','ingredientes','movimentacoes','receitas','eventos',
    'clientes','vendas','pedidos','custos_fixos','despesas','estoque','configuracao'
  ] loop
    execute format('drop trigger if exists trg_updated_at on %I', t);
    execute format('create trigger trg_updated_at before update on %I '
                   'for each row execute function set_updated_at()', t);
  end loop;
end $$;

-- ---------- RLS: qualquer utilizador AUTENTICADO tem acesso total ----------
-- É um único negócio partilhado (dona + ajudante), não multi-empresa —
-- então todos os logados leem/escrevem tudo. Quem não está logado não acessa.
do $$
declare t text;
begin
  foreach t in array array[
    'cookies_catalogo','ingredientes','movimentacoes','receitas','eventos',
    'clientes','vendas','pedidos','custos_fixos','despesas','estoque','configuracao'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists app_rw on %I', t);
    execute format('create policy app_rw on %I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;

-- ---------- Realtime: publica todas as tabelas ----------
do $$
declare t text;
begin
  foreach t in array array[
    'cookies_catalogo','ingredientes','movimentacoes','receitas','eventos',
    'clientes','vendas','pedidos','custos_fixos','despesas','estoque','configuracao'
  ] loop
    begin
      execute format('alter publication supabase_realtime add table %I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;
