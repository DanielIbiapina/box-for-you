-- Box for You — Abrir e fechar o caixa da feira
-- Rode este script inteiro no Supabase → SQL Editor. É idempotente (pode
-- rodar de novo sem problema) e não mexe em nenhum dado: só cria uma tabela.
--
-- Cada linha é um caixa: abre-se com o troco e a contagem do que vai para a
-- feira (mini cookies, embalagens, o que for), fecha-se com o dinheiro contado
-- e o que sobrou. O dinheiro esperado não fica gravado — calcula-se das vendas
-- em dinheiro entre a abertura e o fecho, para bater sempre com o POS.
--
-- contagem_inicial / contagem_final: [ { "nome": "Embalagens", "qty": 30 }, ... ]

create table if not exists caixas (
  id               text primary key default gen_random_uuid()::text,
  dia              date not null,
  evento_id        text references eventos(id) on delete set null,
  aberto_em        timestamptz not null default now(),
  aberto_por       text not null default '',
  fundo_inicial    numeric not null default 0,
  contagem_inicial jsonb not null default '[]'::jsonb,
  fechado_em       timestamptz,
  fechado_por      text not null default '',
  dinheiro_contado numeric,
  contagem_final   jsonb not null default '[]'::jsonb,
  notas            text not null default '',
  updated_at       timestamptz not null default now()
);

create index if not exists idx_caixas_aberto_em on caixas (aberto_em desc);

drop trigger if exists trg_updated_at on caixas;
create trigger trg_updated_at before update on caixas
  for each row execute function set_updated_at();

-- Quem trabalha na feira (perfil "feira") abre e fecha o caixa; apagar um
-- caixa fica só com a dona. A mesma função de supabase/perfil-feira.sql —
-- repetida aqui para este script funcionar sozinho.
create or replace function is_feira()
returns boolean
language sql
stable
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'feira'
$$;

alter table caixas enable row level security;
drop policy if exists caixas_select on caixas;
drop policy if exists caixas_insert on caixas;
drop policy if exists caixas_update on caixas;
drop policy if exists caixas_delete on caixas;
create policy caixas_select on caixas for select to authenticated using (true);
create policy caixas_insert on caixas for insert to authenticated with check (true);
create policy caixas_update on caixas for update to authenticated using (true) with check (true);
create policy caixas_delete on caixas for delete to authenticated using (not is_feira());

-- Realtime: o caixa aberto num aparelho aparece aberto nos outros.
do $$
begin
  alter publication supabase_realtime add table caixas;
exception when duplicate_object then null;
end $$;
