-- Frisk DU : protocoles de sécurité des opérations de chargement et de déchargement
-- (art. R4515-4 du Code du travail).
-- À exécuter une fois dans Supabase : SQL Editor > New query > coller ce fichier > Run.
-- Le script peut être relancé sans risque.

create or replace function public.frisk_version()
returns integer
language sql
immutable
set search_path = ''
as $$ select 12; $$;
grant execute on function public.frisk_version() to authenticated, anon;

-- Nouvelle liste « protocoles », modifiable par le responsable.
create or replace function public.collections_frisk()
returns text[]
language sql
immutable
set search_path = ''
as $$ select array['duerp', 'actions', 'evenements', 'formations', 'exigences', 'equipements', 'verifications', 'produits', 'interventions', 'protocoles', 'salaries', 'articles', 'mouvements']; $$;
