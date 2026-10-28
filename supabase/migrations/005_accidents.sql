-- Frisk DU : registre des accidents, presque-accidents et situations dangereuses.
-- À exécuter une fois dans Supabase : SQL Editor > New query > coller ce fichier > Run.
-- Le script peut être relancé sans risque.

create or replace function public.frisk_version()
returns integer
language sql
immutable
set search_path = ''
as $$ select 5; $$;
grant execute on function public.frisk_version() to authenticated, anon;

-- Nouvelle liste « evenements », modifiable par le responsable (le contributeur reste limité
-- aux mouvements d'EPI et aux signatures, voir appliquer_operations).
create or replace function public.collections_frisk()
returns text[]
language sql
immutable
set search_path = ''
as $$ select array['duerp', 'actions', 'evenements', 'salaries', 'articles', 'mouvements']; $$;
