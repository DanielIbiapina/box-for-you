-- Embalagem de compra dos ingredientes.
-- Rode no Supabase → SQL Editor. Idempotente.
alter table ingredientes add column if not exists quantidade_compra numeric not null default 0;
alter table ingredientes add column if not exists unidade_compra    text    not null default '';
alter table ingredientes add column if not exists preco_compra      numeric not null default 0;
