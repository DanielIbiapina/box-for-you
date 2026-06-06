-- Execute no SQL Editor do Supabase (Dashboard → SQL → New query)

create table if not exists public.business_data (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.business_data enable row level security;

-- App pessoal: acesso via chave anon (proteção principal é a senha do app)
create policy "Leitura pública com anon key"
  on public.business_data for select
  using (true);

create policy "Escrita pública com anon key"
  on public.business_data for insert
  with check (true);

create policy "Atualização pública com anon key"
  on public.business_data for update
  using (true)
  with check (true);
