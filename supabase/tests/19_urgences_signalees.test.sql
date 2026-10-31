-- Tests des urgences signalées (migration 020) : réservées au serveur, lisibles par Frisk seulement.
-- À lancer après 01_roles_journal.test.sql (réutilise ses comptes et entreprises).

\set ON_ERROR_STOP 1
set client_min_messages = warning;
reset role;

\ir ../migrations/020_urgences_signalees.sql
truncate public.alertes_envoyees;

do $$ begin assert public.frisk_version() >= 20, 'version de la base'; end $$;

-- La tâche planifiée (clé secrète) retient les urgences signalées.
set role service_role;
insert into public.alertes_envoyees (entreprise_id, cle) values
  ('10000000-0000-0000-0000-000000000001', 'accidents-a-declarer:ev1'),
  ('10000000-0000-0000-0000-000000000001', 'stocks-rupture:gants:9');
reset role;

-- Un responsable de l'entreprise ne la lit pas et ne peut pas l'écrire.
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","email":"responsable@e1.fr"}', false);
do $$ begin assert (select count(*) from public.alertes_envoyees) = 0, 'table cachée aux clients'; end $$;
do $$ begin
  insert into public.alertes_envoyees (entreprise_id, cle) values ('10000000-0000-0000-0000-000000000001', 'x');
  raise exception 'écriture acceptée';
exception when insufficient_privilege then null;
end $$;

-- Un administrateur Frisk la lit.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000f","email":"admin@frisk.fr"}', false);
do $$ begin assert (select count(*) from public.alertes_envoyees) = 2, 'lisible par Frisk'; end $$;

reset role;
select 'Tests des urgences signalées passés.' as resultat;
