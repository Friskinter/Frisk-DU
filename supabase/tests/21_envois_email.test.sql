-- Tests du journal des e-mails (migration 022) : écrit par le serveur, lisible par Frisk seulement.
-- À lancer après 01_roles_journal.test.sql (réutilise ses comptes et entreprises).

\set ON_ERROR_STOP 1
set client_min_messages = warning;
reset role;

\ir ../migrations/022_envois_email.sql
truncate public.envois_email;

do $$ begin assert public.frisk_version() >= 22, 'version de la base'; end $$;

-- Le serveur (clé secrète) note chaque envoi.
set role service_role;
insert into public.envois_email (type, entreprise_id, destinataire, reussi, erreur) values
  ('recapitulatif', '10000000-0000-0000-0000-000000000001', 'responsable@e1.fr', true, ''),
  ('urgences', '10000000-0000-0000-0000-000000000001', 'lecteur@e1.fr', false, 'Resend 422 : adresse invalide');
reset role;

-- Un type inconnu est refusé.
do $$ begin
  insert into public.envois_email (type, destinataire, reussi) values ('autre', 'x@e1.fr', true);
  raise exception 'type inconnu accepté';
exception when check_violation then null;
end $$;

-- Un responsable de l'entreprise ne le lit pas et ne peut pas l'écrire.
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","email":"responsable@e1.fr"}', false);
do $$ begin assert (select count(*) from public.envois_email) = 0, 'journal caché aux clients'; end $$;
do $$ begin
  insert into public.envois_email (type, destinataire, reussi) values ('urgences', 'x@e1.fr', true);
  raise exception 'écriture acceptée';
exception when insufficient_privilege then null;
end $$;

-- Un administrateur Frisk le lit.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000f","email":"admin@frisk.fr"}', false);
do $$ begin assert (select count(*) from public.envois_email where not reussi) = 1, 'lisible par Frisk'; end $$;

reset role;
select 'Tests du journal des e-mails passés.' as resultat;
