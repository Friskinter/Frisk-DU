-- Frisk DU : vérifications périodiques des équipements (extincteurs, électricité, levage…).
-- À exécuter une fois dans Supabase : SQL Editor > New query > coller ce fichier > Run.
-- Le script peut être relancé sans risque. Les rapports de vérification sont rangés dans le
-- même espace de stockage privé que les attestations de formation (migration 006).

create or replace function public.frisk_version()
returns integer
language sql
immutable
set search_path = ''
as $$ select 7; $$;
grant execute on function public.frisk_version() to authenticated, anon;

-- Nouvelles listes « equipements » et « verifications », modifiables par le responsable.
create or replace function public.collections_frisk()
returns text[]
language sql
immutable
set search_path = ''
as $$ select array['duerp', 'actions', 'evenements', 'formations', 'exigences', 'equipements', 'verifications', 'salaries', 'articles', 'mouvements']; $$;
