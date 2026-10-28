-- Imitation minimale de Supabase pour tester les migrations sur un PostgreSQL ordinaire :
-- rôles anon / authenticated, schéma auth avec auth.users, auth.uid() et auth.jwt().
-- L'utilisateur « connecté » se choisit avec : select set_config('request.jwt.claims', '{"sub":"…","email":"…"}', true);

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end $$;

create schema if not exists auth;
create table if not exists auth.users (id uuid primary key, email text);

create or replace function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
$$;
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(auth.jwt() ->> 'sub', '')::uuid;
$$;

grant usage on schema public, auth to anon, authenticated;
grant execute on function auth.uid(), auth.jwt() to anon, authenticated;
-- Comme Supabase : les tables créées ensuite sont accessibles aux rôles, sous réserve des règles RLS.
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;
