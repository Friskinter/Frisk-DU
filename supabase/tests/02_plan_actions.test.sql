-- Tests du plan d'actions (migration 004) : conversion des anciens contenus et droits.
-- À lancer après 01_roles_journal.test.sql (réutilise ses comptes et entreprises).

\set ON_ERROR_STOP 1
set client_min_messages = warning;
reset role;

do $$ begin assert public.frisk_version() >= 4, 'version de la base'; end $$;

-- Un contenu à l'ancien format : l'action est portée par la ligne du DUERP.
update public.espaces set contenu = '{
  "version":1,"entreprise":"Entreprise 1","services":[],"unites":[],"salaries":[],"articles":[],"mouvements":[],
  "duerp":[
    {"id":"r1","unite":"Quai","gravite":4,"frequence":3,"action":"Barrières de quai","responsable":"Direction","echeance":"2026-12-01","statut":"en-cours"},
    {"id":"r2","unite":"Bureau","gravite":1,"frequence":1,"action":"","responsable":"","echeance":"","statut":"a-faire"}
  ]}'
where entreprise_id = '10000000-0000-0000-0000-000000000001';

-- La migration convertit le contenu, et la relancer ne change plus rien.
\ir ../migrations/004_plan_actions.sql
\ir ../migrations/004_plan_actions.sql

do $$
declare c jsonb := (select contenu from public.espaces where entreprise_id = '10000000-0000-0000-0000-000000000001');
begin
  assert jsonb_array_length(c -> 'actions') = 1, 'une action créée, une seule fois';
  assert c -> 'actions' -> 0 @> '{"id":"r1-action","risqueId":"r1","intitule":"Barrières de quai","responsable":"Direction","echeance":"2026-12-01","statut":"en-cours","efficacite":"non-evaluee"}',
    'action reprise de la ligne';
  assert not (c -> 'duerp' -> 0 ? 'action') and not (c -> 'duerp' -> 0 ? 'statut'), 'anciens champs retirés des lignes';
  assert (c -> 'duerp' -> 0 ->> 'gravite')::int = 4, 'cotation conservée';
end $$;

-- Le responsable ajoute et modifie des actions ; elles sont journalisées.
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","email":"responsable@e1.fr"}', false);
select public.appliquer_operations('10000000-0000-0000-0000-000000000001',
  '[{"type":"ajout","collection":"actions","id":"a2","apres":"r1-action","valeur":{"id":"a2","risqueId":"r1","intitule":"Formation","principe":"formation"}},
    {"type":"modification","collection":"actions","id":"r1-action","champs":{"principe":"collective","cout":6500}}]');
do $$ begin
  assert (select count(*) from public.journal where collection = 'actions') = 2, 'actions journalisées';
end $$;

-- Le contributeur ne modifie pas le plan d'actions.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","email":"contributeur@e1.fr"}', false);
do $$ begin
  begin
    perform public.appliquer_operations('10000000-0000-0000-0000-000000000001',
      '[{"type":"modification","collection":"actions","id":"a2","champs":{"statut":"fait"}}]');
    raise exception 'le contributeur a modifié le plan d''actions';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;
select 'Tests du plan d''actions passés.' as resultat;
