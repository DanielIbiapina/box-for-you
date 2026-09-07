-- Box for You — Perfil "Feira" (acesso limitado para quem trabalha no balcão)
-- Rode este script inteiro no Supabase → SQL Editor. É idempotente (pode
-- rodar de novo sem problema) e não mexe em nenhum dado, só em permissões.
--
-- Como funciona: não criámos tabela de utilizadores nova. Continua tudo em
-- auth.users — quem tiver app_metadata.role = 'feira' passa a ter acesso
-- limitado; quem não tiver essa marca (a dona) continua com acesso total,
-- exatamente como hoje.
--
-- ── Passo a passo ────────────────────────────────────────────────────────
-- 1) Cria o login da funcionária em Authentication → Users → Add user
--    (email + password). Ela vai entrar no /crm/ com isso.
-- 2) Roda este script inteiro no SQL Editor.
-- 3) Marca essa conta como "feira" (troca o email abaixo pelo dela):
--
--   update auth.users
--   set raw_app_meta_data = raw_app_meta_data || jsonb_build_object('role', 'feira')
--   where email = 'email-da-funcionaria@exemplo.com';
--
-- 4) Ela faz login de novo (para o token pegar a marca nova) e só vê a tela
--    de Caixa da Feira — o resto do app nem aparece na navegação dela.
--
-- Para tirar o acesso de alguém (ex.: parou de trabalhar):
--   update auth.users set raw_app_meta_data = raw_app_meta_data - 'role'
--   where email = 'email-da-funcionaria@exemplo.com';
-- Isso sozinho já derruba o acesso dela na próxima vez que o token expirar;
-- pra cortar na hora, também dá pra apagar o login em Authentication → Users.
--
-- IMPORTANTE: quem decide o que a conta "feira" pode fazer é a regra aqui
-- embaixo (RLS), não a tela do app. Esconder o menu é só conforto — a trava
-- de verdade é esta.

create or replace function is_feira()
returns boolean
language sql
stable
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'feira'
$$;

-- ---------- Tabelas totalmente fora do alcance do perfil Feira ----------
-- Receitas, ingredientes, estoque de matéria-prima, clientes, pedidos diretos,
-- custos fixos e despesas: só a dona mexe. A conta "feira" não lê nem escreve.
do $$
declare t text;
begin
  foreach t in array array[
    'receitas', 'ingredientes', 'movimentacoes', 'clientes', 'pedidos',
    'custos_fixos', 'despesas'
  ] loop
    execute format('drop policy if exists app_rw on %I', t);
    execute format('drop policy if exists owner_rw on %I', t);
    execute format(
      'create policy owner_rw on %I for all to authenticated using (not is_feira()) with check (not is_feira())',
      t
    );
  end loop;
end $$;

-- ---------- Cardápio, feiras/eventos, configuração: Feira só lê ----------
-- Precisa ver sabores/preços/stock e saber que dia é hoje, mas não edita nada.
do $$
declare t text;
begin
  foreach t in array array['cookies_catalogo', 'eventos', 'configuracao'] loop
    execute format('drop policy if exists app_rw on %I', t);
    execute format('drop policy if exists all_read on %I', t);
    execute format('drop policy if exists owner_write on %I', t);
    execute format('create policy all_read on %I for select to authenticated using (true)', t);
    execute format(
      'create policy owner_write on %I for all to authenticated using (not is_feira()) with check (not is_feira())',
      t
    );
  end loop;
end $$;

-- ---------- Estoque de cookies prontos: Feira lê e dá baixa ao vender ----------
-- A baixa de stock (deductCookies) faz upsert = insert + update. Apagar uma
-- linha de estoque fica só com a dona.
drop policy if exists app_rw on estoque;
drop policy if exists estoque_select on estoque;
drop policy if exists estoque_insert on estoque;
drop policy if exists estoque_update on estoque;
drop policy if exists estoque_delete on estoque;
create policy estoque_select on estoque for select to authenticated using (true);
create policy estoque_insert on estoque for insert to authenticated with check (true);
create policy estoque_update on estoque for update to authenticated using (true) with check (true);
create policy estoque_delete on estoque for delete to authenticated using (not is_feira());

-- ---------- Vendas (POS da feira): sem mudança ----------
-- É exatamente o trabalho da conta "feira" — mantém a policy app_rw original,
-- acesso total (registar venda e anular a última), igual à dona.
