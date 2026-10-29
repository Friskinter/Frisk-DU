-- Frisk DU : accueil sécurité des nouveaux arrivants et causeries sécurité avec émargement.
-- À exécuter une fois dans Supabase : SQL Editor > New query > coller ce fichier > Run.
-- Le script peut être relancé sans risque.

create or replace function public.frisk_version()
returns integer
language sql
immutable
set search_path = ''
as $$ select 15; $$;
grant execute on function public.frisk_version() to authenticated, anon;

-- Nouvelles listes « accueils » et « causeries », modifiables par le responsable.
create or replace function public.collections_frisk()
returns text[]
language sql
immutable
set search_path = ''
as $$ select array['duerp', 'actions', 'evenements', 'formations', 'exigences', 'equipements', 'verifications', 'produits', 'interventions', 'protocoles', 'grilles', 'visites', 'accueils', 'causeries', 'salaries', 'articles', 'mouvements']; $$;
