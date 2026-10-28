-- Tests des vérifications périodiques (migration 007) : droits et journal.
-- À lancer après 01_roles_journal.test.sql (réutilise ses comptes et entreprises).

\set ON_ERROR_STOP 1
set client_min_messages = warning;
reset role;

-- Les tests précédents relancent des migrations antérieures : on réapplique la 007.
\ir ../migrations/007_verifications.sql

do $$ begin assert public.frisk_version() = 7, 'version de la base'; end $$;

-- Le responsable enregistre un équipement et sa vérification, puis lève une observation.
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","email":"responsable@e1.fr"}', false);
select public.appliquer_operations('10000000-0000-0000-0000-000000000001',
  '[{"type":"ajout","collection":"equipements","id":"q1","apres":null,"valeur":{"id":"q1","type":"chariots","nom":"Chariot 1","periodicite":6}},
    {"type":"ajout","collection":"verifications","id":"v1","apres":null,"valeur":{"id":"v1","equipementId":"q1","date":"2026-10-01","resultat":"observations","prochaine":"2027-04-01","observations":[{"id":"o1","texte":"Klaxon défectueux","leveeLe":""}]}},
    {"type":"modification","collection":"verifications","id":"v1","champs":{"observations":[{"id":"o1","texte":"Klaxon défectueux","leveeLe":"2026-10-15"}]}}]');
do $$
declare c jsonb := (select contenu from public.espaces where entreprise_id = '10000000-0000-0000-0000-000000000001');
begin
  assert c -> 'verifications' -> 0 -> 'observations' -> 0 ->> 'leveeLe' = '2026-10-15', 'observation levée';
  assert (select count(*) from public.journal where collection in ('equipements', 'verifications')) = 3, 'vérifications journalisées';
end $$;

-- Le contributeur ne modifie pas les vérifications.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","email":"contributeur@e1.fr"}', false);
do $$ begin
  begin
    perform public.appliquer_operations('10000000-0000-0000-0000-000000000001',
      '[{"type":"modification","collection":"verifications","id":"v1","champs":{"resultat":"conforme"}}]');
    raise exception 'le contributeur a modifié une vérification';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;
select 'Tests des vérifications passés.' as resultat;
