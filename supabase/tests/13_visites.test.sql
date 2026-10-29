-- Tests des visites et audits (migration 014) : droits, signatures et journal.
-- À lancer après 01_roles_journal.test.sql (réutilise ses comptes et entreprises).

\set ON_ERROR_STOP 1
set client_min_messages = warning;
reset role;

-- Les tests précédents relancent des migrations antérieures : on réapplique la 014.
\ir ../migrations/014_visites.sql

do $$ begin assert public.frisk_version() >= 14, 'version de la base'; end $$;

-- Le responsable enregistre une visite et une grille.
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","email":"responsable@e1.fr"}', false);
select public.appliquer_operations('10000000-0000-0000-0000-000000000001',
  '[{"type":"ajout","collection":"visites","id":"v1","apres":null,"valeur":{"id":"v1","grille":"Visite sécurité générale","reponses":[]}},
    {"type":"ajout","collection":"grilles","id":"g1","apres":null,"valeur":{"id":"g1","nom":"Grille maison","points":[]}}]');
do $$ begin
  assert (select contenu -> 'visites' -> 0 ->> 'grille' from public.espaces where entreprise_id = '10000000-0000-0000-0000-000000000001') = 'Visite sécurité générale', 'visite enregistrée';
  assert (select count(*) from public.journal where collection in ('visites', 'grilles')) = 2, 'visite et grille journalisées';
end $$;

-- Le contributeur ne modifie pas les visites.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","email":"contributeur@e1.fr"}', false);
do $$ begin
  begin
    perform public.appliquer_operations('10000000-0000-0000-0000-000000000001',
      '[{"type":"suppression","collection":"visites","id":"v1"}]');
    raise exception 'le contributeur a supprimé une visite';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;
select 'Tests des visites et audits passés.' as resultat;
