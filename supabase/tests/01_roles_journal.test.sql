-- Tests des droits, du journal et de l'enregistrement par opérations.
-- À lancer après 00_imitation_supabase.sql et schema.sql, sur une base de test (voir tests/sql.sh).
-- Chaque vérification lève une erreur si elle échoue ; le script s'arrête à la première.

\set ON_ERROR_STOP 1
set client_min_messages = warning;

-- Jeu de données ------------------------------------------------------------
reset role;
truncate public.journal, public.versions, public.espaces, public.membres, public.admins_frisk, public.entreprises, auth.users cascade;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'responsable@e1.fr'),
  ('00000000-0000-0000-0000-00000000000b', 'contributeur@e1.fr'),
  ('00000000-0000-0000-0000-00000000000c', 'lecteur@e1.fr'),
  ('00000000-0000-0000-0000-00000000000d', 'responsable@e2.fr'),
  ('00000000-0000-0000-0000-00000000000f', 'admin@frisk.fr');
insert into public.admins_frisk (user_id) values ('00000000-0000-0000-0000-00000000000f');
insert into public.entreprises (id, nom) values
  ('10000000-0000-0000-0000-000000000001', 'Entreprise 1'),
  ('10000000-0000-0000-0000-000000000002', 'Entreprise 2');
insert into public.membres (user_id, entreprise_id, email, role) values
  ('00000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-000000000001', 'responsable@e1.fr', 'responsable'),
  ('00000000-0000-0000-0000-00000000000b', '10000000-0000-0000-0000-000000000001', 'contributeur@e1.fr', 'contributeur'),
  ('00000000-0000-0000-0000-00000000000c', '10000000-0000-0000-0000-000000000001', 'lecteur@e1.fr', 'lecteur'),
  ('00000000-0000-0000-0000-00000000000d', '10000000-0000-0000-0000-000000000002', 'responsable@e2.fr', 'responsable');
insert into public.espaces (entreprise_id, contenu) values (
  '10000000-0000-0000-0000-000000000001',
  '{"version":1,"entreprise":"Entreprise 1","services":[],"unites":[],"salaries":[],"articles":[],"mouvements":[],
    "duerp":[{"id":"l1","unite":"Atelier","gravite":1,"frequence":1},{"id":"l2","unite":"Quai","gravite":2,"frequence":2}]}'
);

-- Outils : se connecter en tant que…, et lire le contenu.
create or replace function pg_temp.connecter(email text) returns void language sql security definer as $$
  select set_config('request.jwt.claims', json_build_object('sub', u.id, 'email', u.email)::text, false)
  from auth.users u where u.email = connecter.email;
$$;
create or replace function pg_temp.contenu() returns jsonb language sql security definer as $$
  select contenu from public.espaces where entreprise_id = '10000000-0000-0000-0000-000000000001';
$$;
create or replace function pg_temp.journal_compte() returns bigint language sql security definer as $$
  select count(*) from public.journal where entreprise_id = '10000000-0000-0000-0000-000000000001';
$$;

-- 1. Le responsable ajoute une ligne après l1 : l'ordre est respecté et l'ajout est journalisé.
set role authenticated;
select pg_temp.connecter('responsable@e1.fr');
select public.appliquer_operations('10000000-0000-0000-0000-000000000001',
  '[{"type":"ajout","collection":"duerp","id":"l3","apres":"l1","valeur":{"id":"l3","unite":"Bureau","gravite":3,"frequence":1}}]');
do $$ begin
  assert (select jsonb_path_query_array(pg_temp.contenu() -> 'duerp', '$[*].id')) = '["l1","l3","l2"]', 'ordre après ajout';
  assert pg_temp.journal_compte() = 1, 'ajout journalisé';
end $$;

-- 2. Modification : seuls les champs réellement changés sont journalisés, avec l'auteur.
select public.appliquer_operations('10000000-0000-0000-0000-000000000001',
  '[{"type":"modification","collection":"duerp","id":"l1","champs":{"gravite":4,"unite":"Atelier"}}]');
do $$
declare j record;
begin
  select * into j from public.journal order by id desc limit 1;
  assert j.action = 'modification' and j.element_id = 'l1', 'modification journalisée';
  assert j.avant = '{"gravite":1}' and j.apres = '{"gravite":4}', 'seul le champ modifié est journalisé';
  assert j.auteur = 'responsable@e1.fr', 'auteur du journal';
end $$;

-- 3. Une modification sans changement réel n'est pas journalisée.
select public.appliquer_operations('10000000-0000-0000-0000-000000000001',
  '[{"type":"modification","collection":"duerp","id":"l1","champs":{"gravite":4}}]');
do $$ begin assert pg_temp.journal_compte() = 2, 'pas de journal sans changement'; end $$;

-- 4. Deux modifications de champs différents (deux collègues) se cumulent au lieu de s'écraser.
select public.appliquer_operations('10000000-0000-0000-0000-000000000001',
  '[{"type":"modification","collection":"duerp","id":"l2","champs":{"gravite":3}}]');
select public.appliquer_operations('10000000-0000-0000-0000-000000000001',
  '[{"type":"modification","collection":"duerp","id":"l2","champs":{"frequence":4}}]');
do $$ begin
  assert (pg_temp.contenu() -> 'duerp' -> 2) @> '{"gravite":3,"frequence":4}', 'modifications cumulées';
end $$;

-- 5. Un ajout renvoyé deux fois (coupure réseau) ne crée pas de doublon.
select public.appliquer_operations('10000000-0000-0000-0000-000000000001',
  '[{"type":"ajout","collection":"duerp","id":"l4","apres":"l2","valeur":{"id":"l4","unite":"Cour"}}]');
select public.appliquer_operations('10000000-0000-0000-0000-000000000001',
  '[{"type":"ajout","collection":"duerp","id":"l4","apres":"l2","valeur":{"id":"l4","unite":"Cour"}}]');
do $$ begin
  assert jsonb_array_length(pg_temp.contenu() -> 'duerp') = 4, 'ajout idempotent';
end $$;

-- 6. Suppression journalisée avec l'élément supprimé ; modifier un élément supprimé est ignoré.
select public.appliquer_operations('10000000-0000-0000-0000-000000000001',
  '[{"type":"suppression","collection":"duerp","id":"l4"},
    {"type":"modification","collection":"duerp","id":"l4","champs":{"unite":"Fantôme"}}]');
do $$
declare j record;
begin
  assert jsonb_array_length(pg_temp.contenu() -> 'duerp') = 3, 'suppression appliquée';
  select * into j from public.journal order by id desc limit 1;
  assert j.action = 'suppression' and j.avant ->> 'unite' = 'Cour', 'suppression journalisée avec l''élément';
end $$;

-- 7. Réglage d'entreprise (racine) journalisé.
select public.appliquer_operations('10000000-0000-0000-0000-000000000001',
  '[{"type":"racine","cle":"fiche","valeur":{"siret":"123"}}]');
do $$ begin
  assert pg_temp.contenu() -> 'fiche' = '{"siret":"123"}', 'fiche enregistrée';
  assert (select collection from public.journal order by id desc limit 1) = 'entreprise', 'racine journalisée';
end $$;

-- 8. Le contributeur saisit une remise d'EPI et une signature…
select pg_temp.connecter('contributeur@e1.fr');
select public.appliquer_operations('10000000-0000-0000-0000-000000000001',
  '[{"type":"ajout","collection":"mouvements","id":"m1","apres":null,"valeur":{"id":"m1","type":"sortie","quantite":1}},
    {"type":"signature","id":"s1","valeur":{"image":"data:image/png;base64,AAAA","date":"2026-10-28","salarieId":"x"}}]');
do $$ begin
  assert pg_temp.contenu() #>> '{signatures,s1,date}' = '2026-10-28', 'signature enregistrée';
  assert (select apres ? 'image' from public.journal where collection = 'signatures') = false, 'image non journalisée';
end $$;

-- … mais ne peut pas modifier le DUERP.
do $$ begin
  begin
    perform public.appliquer_operations('10000000-0000-0000-0000-000000000001',
      '[{"type":"modification","collection":"duerp","id":"l1","champs":{"gravite":1}}]');
    raise exception 'le contributeur a pu modifier le DUERP';
  exception when insufficient_privilege then null;
  end;
end $$;

-- 9. Le lecteur ne peut rien modifier, mais il lit le contenu et le journal.
select pg_temp.connecter('lecteur@e1.fr');
do $$ begin
  begin
    perform public.appliquer_operations('10000000-0000-0000-0000-000000000001',
      '[{"type":"ajout","collection":"mouvements","id":"m2","apres":null,"valeur":{"id":"m2"}}]');
    raise exception 'le lecteur a pu modifier';
  exception when insufficient_privilege then null;
  end;
  assert (select count(*) from public.espaces) = 1, 'le lecteur lit son espace';
  assert (select count(*) from public.journal) > 0, 'le lecteur lit le journal';
end $$;

-- 10. Une autre entreprise ne voit ni ne modifie rien.
select pg_temp.connecter('responsable@e2.fr');
do $$ begin
  assert (select count(*) from public.espaces where entreprise_id = '10000000-0000-0000-0000-000000000001') = 0, 'espace invisible';
  assert (select count(*) from public.journal) = 0, 'journal invisible';
  begin
    perform public.appliquer_operations('10000000-0000-0000-0000-000000000001',
      '[{"type":"racine","cle":"entreprise","valeur":"Piraté"}]');
    raise exception 'une autre entreprise a pu modifier';
  exception when insufficient_privilege then null;
  end;
end $$;

-- 11. Écritures directes refusées : l'espace ne bouge pas, le journal est inaccessible en écriture.
select pg_temp.connecter('responsable@e1.fr');
update public.espaces set contenu = '{}' where entreprise_id = '10000000-0000-0000-0000-000000000001';
do $$ begin
  assert pg_temp.contenu() ? 'duerp', 'mise à jour directe sans effet';
  begin
    insert into public.journal (entreprise_id, collection, element_id, action)
      values ('10000000-0000-0000-0000-000000000001', 'duerp', 'x', 'ajout');
    raise exception 'écriture directe dans le journal';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.journal;
    raise exception 'suppression du journal';
  exception when insufficient_privilege then null;
  end;
end $$;

-- 12. Versions : le responsable fige, le contributeur non ; une version ne se modifie pas.
insert into public.versions (entreprise_id, motif, contenu, auteur)
  values ('10000000-0000-0000-0000-000000000001', 'Première version', '{"duerp":[]}', 'R');
do $$ begin
  assert (select numero from public.versions) = 1, 'version numérotée';
  begin
    update public.versions set motif = 'modifié';
    raise exception 'version modifiée';
  exception when insufficient_privilege then null;
  end;
end $$;
select pg_temp.connecter('contributeur@e1.fr');
do $$ begin
  begin
    insert into public.versions (entreprise_id, motif, contenu, auteur)
      values ('10000000-0000-0000-0000-000000000001', 'x', '{}', 'C');
    raise exception 'le contributeur a figé une version';
  exception when insufficient_privilege then null;
  end;
end $$;

-- 13. L'administrateur Frisk peut intervenir ; une entreprise suspendue est bloquée.
select pg_temp.connecter('admin@frisk.fr');
select public.appliquer_operations('10000000-0000-0000-0000-000000000001',
  '[{"type":"racine","cle":"unites","valeur":["Atelier"]}]');
reset role;
update public.entreprises set actif = false where id = '10000000-0000-0000-0000-000000000001';
set role authenticated;
select pg_temp.connecter('responsable@e1.fr');
do $$ begin
  begin
    perform public.appliquer_operations('10000000-0000-0000-0000-000000000001',
      '[{"type":"racine","cle":"unites","valeur":[]}]');
    raise exception 'entreprise suspendue modifiée';
  exception when insufficient_privilege then null;
  end;
end $$;

-- 14. Opérations malformées refusées.
reset role;
update public.entreprises set actif = true;
set role authenticated;
do $$ begin
  begin
    perform public.appliquer_operations('10000000-0000-0000-0000-000000000001', '[{"type":"racine","cle":"version","valeur":2}]');
    raise exception 'clé racine non autorisée acceptée';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.appliquer_operations('10000000-0000-0000-0000-000000000001',
      '[{"type":"ajout","collection":"duerp","id":"a","apres":null,"valeur":{"id":"b"}}]');
    raise exception 'identifiant incohérent accepté';
  exception when invalid_parameter_value then null;
  end;
end $$;

reset role;
select 'Tous les tests SQL sont passés.' as resultat;
