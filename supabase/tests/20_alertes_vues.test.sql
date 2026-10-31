-- Tests des alertes vues (migration 021) : remplacement, confidentialité, droits.
-- À lancer après 01_roles_journal.test.sql (réutilise ses comptes et entreprises).

\set ON_ERROR_STOP 1
set client_min_messages = warning;
reset role;

\ir ../migrations/021_alertes_vues.sql
truncate public.alertes_vues;

do $$ begin assert public.frisk_version() >= 21, 'version de la base'; end $$;

set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c","email":"lecteur@e1.fr"}', false);
select public.marquer_alertes_vues('10000000-0000-0000-0000-000000000001', array['actions-retard:a1', 'stocks-rupture:b2']);
do $$ begin
  assert (select count(*) from public.alertes_vues) = 3, 'deux alertes et la visite';
end $$;

-- Visite suivante : une alerte réglée disparaît, une nouvelle s'ajoute, la visite reste.
select public.marquer_alertes_vues('10000000-0000-0000-0000-000000000001', array['actions-retard:a1', 'formations-30j:c3']);
do $$ begin
  assert (select array_agg(empreinte order by empreinte collate "C") from public.alertes_vues) = array['__visite__', 'actions-retard:a1', 'formations-30j:c3'], 'remplacement';
end $$;

-- Visite sans alerte : seule la visite reste.
select public.marquer_alertes_vues('10000000-0000-0000-0000-000000000001', '{}');
do $$ begin assert (select count(*) from public.alertes_vues) = 1, 'seule la visite'; end $$;

-- Pas dans une autre entreprise, ni en écriture directe.
do $$ begin
  perform public.marquer_alertes_vues('10000000-0000-0000-0000-000000000002', array['x']);
  raise exception 'accepté hors de son entreprise';
exception when insufficient_privilege then null;
end $$;
do $$ begin
  insert into public.alertes_vues (user_id, entreprise_id, empreinte) values ('00000000-0000-0000-0000-00000000000c', '10000000-0000-0000-0000-000000000001', 'x');
  raise exception 'écriture directe acceptée';
exception when insufficient_privilege then null;
end $$;

-- Un collègue ne voit pas ce que la personne a vu.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","email":"responsable@e1.fr"}', false);
do $$ begin assert (select count(*) from public.alertes_vues) = 0, 'confidentiel'; end $$;

reset role;
select 'Tests des alertes vues passés.' as resultat;
