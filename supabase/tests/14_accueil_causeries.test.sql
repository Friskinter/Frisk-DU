-- Tests des accueil et causeries (migration 015) : droits, signatures et journal.
-- À lancer après 01_roles_journal.test.sql (réutilise ses comptes et entreprises).

\set ON_ERROR_STOP 1
set client_min_messages = warning;
reset role;

-- Les tests précédents relancent des migrations antérieures : on réapplique la 015.
\ir ../migrations/015_accueil_causeries.sql

do $$ begin assert public.frisk_version() >= 15, 'version de la base'; end $$;

-- Le responsable enregistre un accueil et une causerie.
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","email":"responsable@e1.fr"}', false);
select public.appliquer_operations('10000000-0000-0000-0000-000000000001',
  '[{"type":"ajout","collection":"accueils","id":"a1","apres":null,"valeur":{"id":"a1","nom":"Thomas B.","points":[]}},
    {"type":"ajout","collection":"causeries","id":"c1","apres":null,"valeur":{"id":"c1","theme":"Port des EPI","participants":[]}}]');
do $$ begin
  assert (select contenu -> 'accueils' -> 0 ->> 'nom' from public.espaces where entreprise_id = '10000000-0000-0000-0000-000000000001') = 'Thomas B.', 'accueil enregistré';
  assert (select count(*) from public.journal where collection in ('accueils', 'causeries')) = 2, 'accueil et causerie journalisés';
end $$;

-- Le contributeur ne modifie pas les accueils.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","email":"contributeur@e1.fr"}', false);
do $$ begin
  begin
    perform public.appliquer_operations('10000000-0000-0000-0000-000000000001',
      '[{"type":"suppression","collection":"accueils","id":"a1"}]');
    raise exception 'le contributeur a supprimé un accueil';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;
select 'Tests de l''accueil et des causeries passés.' as resultat;
