-- Tests du registre des accidents (migration 005) : droits et journal.
-- À lancer après 01_roles_journal.test.sql (réutilise ses comptes et entreprises).

\set ON_ERROR_STOP 1
set client_min_messages = warning;
reset role;

-- Le test du plan d'actions relance la migration 004 : on réapplique la 005.
\ir ../migrations/005_accidents.sql

do $$ begin assert public.frisk_version() >= 5, 'version de la base'; end $$;

-- Le responsable enregistre un accident puis son analyse ; tout est journalisé.
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","email":"responsable@e1.fr"}', false);
select public.appliquer_operations('10000000-0000-0000-0000-000000000001',
  '[{"type":"ajout","collection":"evenements","id":"ev1","apres":null,"valeur":{"id":"ev1","type":"accident-travail","date":"2026-10-20","soins":"arret","joursArret":3,"declaration":"a-faire","pourquoi":[]}},
    {"type":"modification","collection":"evenements","id":"ev1","champs":{"declaration":"faite","pourquoi":["Sol glissant","Fuite non réparée"]}}]');
do $$
declare c jsonb := (select contenu from public.espaces where entreprise_id = '10000000-0000-0000-0000-000000000001');
begin
  assert jsonb_array_length(c -> 'evenements') = 1, 'événement enregistré';
  assert c -> 'evenements' -> 0 @> '{"declaration":"faite","pourquoi":["Sol glissant","Fuite non réparée"]}', 'analyse enregistrée';
  assert (select count(*) from public.journal where collection = 'evenements') = 2, 'événement journalisé';
end $$;

-- Le contributeur et le lecteur ne touchent pas au registre (données de santé).
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","email":"contributeur@e1.fr"}', false);
do $$ begin
  begin
    perform public.appliquer_operations('10000000-0000-0000-0000-000000000001',
      '[{"type":"suppression","collection":"evenements","id":"ev1"}]');
    raise exception 'le contributeur a modifié le registre des accidents';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;
select 'Tests du registre des accidents passés.' as resultat;
