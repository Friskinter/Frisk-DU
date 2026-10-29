-- Tests des abonnements (migration 017) : inscription libre, essai gratuit, lecture seule.
-- À lancer après 01_roles_journal.test.sql (réutilise ses comptes et entreprises).

\set ON_ERROR_STOP 1
set client_min_messages = warning;
reset role;

-- Les tests précédents relancent des migrations antérieures : on réapplique la 017.
\ir ../migrations/017_abonnements.sql

do $$ begin assert public.frisk_version() >= 17, 'version de la base'; end $$;

-- Les entreprises créées par Frisk restent actives.
do $$ begin
  assert (select abonnement from public.entreprises where id = '10000000-0000-0000-0000-000000000001') = 'actif', 'entreprise existante active';
end $$;

-- Un nouvel utilisateur s'inscrit : son entreprise est créée en essai pour 7 jours.
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000e1', 'nouveau@essai.fr') on conflict do nothing;
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000e1","email":"nouveau@essai.fr"}', false);
select set_config('frisk.essai', public.creer_mon_espace('Menuiserie Essai', '1 à 10 salariés')::text, false);
do $$
declare e uuid := current_setting('frisk.essai')::uuid;
begin
  assert public.role_dans(e) = 'responsable', 'inscrit responsable';
  assert public.acces_entreprise(e) = 'essai', 'essai en cours';
  assert (select contenu -> 'fiche' ->> 'effectif' from public.espaces where entreprise_id = e) = '1 à 10 salariés', 'effectif repris';
end $$;

-- Une seule entreprise par compte.
do $$ begin
  begin
    perform public.creer_mon_espace('Deuxième', '');
    raise exception 'deuxième inscription acceptée';
  exception when unique_violation then null;
  end;
end $$;

-- Pendant l'essai : DUERP, plan d'actions, salariés et fiche oui ; le reste non.
do $$
declare e uuid := current_setting('frisk.essai')::uuid;
begin
  perform public.appliquer_operations(e, '[{"type":"ajout","collection":"duerp","id":"r1","apres":null,"valeur":{"id":"r1","unite":"Atelier"}},
    {"type":"ajout","collection":"actions","id":"a1","apres":null,"valeur":{"id":"a1","intitule":"Capter les poussières"}},
    {"type":"ajout","collection":"salaries","id":"s1","apres":null,"valeur":{"id":"s1","nom":"Léa"}},
    {"type":"racine","cle":"unites","valeur":["Atelier"]}]');
  assert (select jsonb_array_length(contenu -> 'duerp') from public.espaces where entreprise_id = e) = 1, 'risque enregistré pendant l''essai';
  begin
    perform public.appliquer_operations(e, '[{"type":"ajout","collection":"evenements","id":"ev1","apres":null,"valeur":{"id":"ev1"}}]');
    raise exception 'module réservé accepté pendant l''essai';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.appliquer_operations(e, '[{"type":"racine","cle":"identite","valeur":{"couleur":"#002b5c"}}]');
    raise exception 'identité visuelle acceptée pendant l''essai';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.appliquer_operations(e, '[{"type":"signature","id":"sig1","valeur":{"image":"x"}}]');
    raise exception 'signature acceptée pendant l''essai';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.changer_lien_signalement(e, true);
    raise exception 'lien de signalement activé pendant l''essai';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Pas de version officielle du document unique pendant l'essai.
do $$ begin
  begin
    insert into public.versions (entreprise_id, motif, contenu) values (current_setting('frisk.essai')::uuid, 'Essai', '{}');
    raise exception 'version figée pendant l''essai';
  exception when insufficient_privilege then null;
  end;
end $$;

-- L'utilisateur ne peut pas prolonger lui-même son essai.
update public.entreprises set essai_fin = now() + interval '1 year', abonnement = 'actif' where id = current_setting('frisk.essai')::uuid;
reset role;
do $$ begin
  assert (select abonnement from public.entreprises where id = current_setting('frisk.essai')::uuid) = 'essai', 'abonnement inchangé par le client';
end $$;

-- Essai terminé : lecture seule.
update public.entreprises set essai_fin = now() - interval '1 minute' where id = current_setting('frisk.essai')::uuid;
set role authenticated;
do $$
declare e uuid := current_setting('frisk.essai')::uuid;
begin
  assert public.acces_entreprise(e) = 'lecture', 'essai terminé';
  assert (select count(*) from public.espaces where entreprise_id = e) = 1, 'données toujours consultables';
  begin
    perform public.appliquer_operations(e, '[{"type":"suppression","collection":"duerp","id":"r1"}]');
    raise exception 'modification acceptée après l''essai';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Abonnement payé (mis à jour par le serveur à la réception du paiement) : tout est ouvert.
reset role;
update public.entreprises set abonnement = 'actif' where id = current_setting('frisk.essai')::uuid;
set role authenticated;
do $$
declare e uuid := current_setting('frisk.essai')::uuid;
begin
  assert public.acces_entreprise(e) = 'complet', 'abonné';
  perform public.appliquer_operations(e, '[{"type":"ajout","collection":"evenements","id":"ev1","apres":null,"valeur":{"id":"ev1"}}]');
  assert public.changer_lien_signalement(e, true) is not null, 'lien de signalement activé';
end $$;

-- Abonnement résilié : le lien de signalement ne fonctionne plus.
reset role;
update public.entreprises set abonnement = 'termine' where id = current_setting('frisk.essai')::uuid;
set role service_role;
do $$ begin
  begin
    perform public.signaler_evenement((select jeton_signalement from public.entreprises where id = current_setting('frisk.essai')::uuid),
      '{"id":"ev2","type":"presque-accident"}');
    raise exception 'signalement accepté après résiliation';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Journal des erreurs : lisible par Frisk seulement.
reset role;
insert into public.erreurs (origine, message) values ('navigateur', 'Erreur de test');
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","email":"responsable@e1.fr"}', false);
do $$ begin assert (select count(*) from public.erreurs) = 0, 'erreurs cachées aux clients'; end $$;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000f","email":"admin@frisk.fr"}', false);
do $$ begin assert (select count(*) from public.erreurs) >= 1, 'erreurs visibles par Frisk'; end $$;

reset role;
select 'Tests des abonnements passés.' as resultat;
