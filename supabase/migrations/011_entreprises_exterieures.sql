-- Frisk DU : plans de prévention des entreprises extérieures (art. R4512-6 du Code du travail).
-- À exécuter une fois dans Supabase : SQL Editor > New query > coller ce fichier > Run.
-- Le script peut être relancé sans risque. Les signatures des plans rejoignent les signatures
-- existantes (jamais modifiées ni supprimées).

create or replace function public.frisk_version()
returns integer
language sql
immutable
set search_path = ''
as $$ select 11; $$;
grant execute on function public.frisk_version() to authenticated, anon;

-- Nouvelle liste « interventions », modifiable par le responsable.
create or replace function public.collections_frisk()
returns text[]
language sql
immutable
set search_path = ''
as $$ select array['duerp', 'actions', 'evenements', 'formations', 'exigences', 'equipements', 'verifications', 'produits', 'interventions', 'salaries', 'articles', 'mouvements']; $$;
