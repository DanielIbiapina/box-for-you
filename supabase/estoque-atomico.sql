-- Box for You — stock somado dentro do banco (em vez de sobrescrito)
-- Rode este script inteiro no Supabase → SQL Editor. É idempotente e não
-- mexe em nenhum dado: só acrescenta uma função.
--
-- PORQUÊ
-- Até aqui, ao vender, o aparelho calculava "ficaram 8" e gravava o número 8.
-- Se dois aparelhos vendessem ao mesmo tempo (ou um estivesse sem rede e só
-- sincronizasse depois), o último a gravar apagava as contas do outro.
--
-- Com esta função, o aparelho passa a dizer "tira 1" e é o Postgres que faz a
-- conta, uma de cada vez. Duas pessoas a vender ao mesmo tempo deixam de se
-- atropelar, e uma venda registada sem rede pode subir horas depois sem risco.
--
-- Entrada: [ { "tipo": "cookie", "cookie_id": "nutella", "delta": -2 }, ... ]
--   tipo:  'cookie' | 'massa' | 'cookie50'
--   delta: negativo tira, positivo devolve

create or replace function estoque_ajustar(p jsonb)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  m record;
begin
  for m in
    select *
    from jsonb_to_recordset(coalesce(p, '[]'::jsonb))
      as x(tipo text, cookie_id text, delta numeric)
  loop
    continue when m.tipo is null or m.cookie_id is null or coalesce(m.delta, 0) = 0;

    insert into estoque (tipo, cookie_id, qty)
    values (m.tipo, m.cookie_id, greatest(0, m.delta))
    on conflict (tipo, cookie_id)
    do update set qty = greatest(0, estoque.qty + m.delta);
  end loop;
end $$;

revoke all on function estoque_ajustar(jsonb) from public, anon;
grant execute on function estoque_ajustar(jsonb) to authenticated;
