-- Frisk DU : inventaire des produits chimiques (FDS, mentions de danger, CMR).
-- À exécuter une fois dans Supabase : SQL Editor > New query > coller ce fichier > Run.
-- Le script peut être relancé sans risque. Les FDS sont rangées dans le même espace de
-- stockage privé que les attestations et les rapports (migration 006).

create or replace function public.frisk_version()
returns integer
language sql
immutable
set search_path = ''
as $$ select 8; $$;
grant execute on function public.frisk_version() to authenticated, anon;

-- Nouvelle liste « produits », modifiable par le responsable.
create or replace function public.collections_frisk()
returns text[]
language sql
immutable
set search_path = ''
as $$ select array['duerp', 'actions', 'evenements', 'formations', 'exigences', 'equipements', 'verifications', 'produits', 'salaries', 'articles', 'mouvements']; $$;
