-- Tests des préférences d'e-mail par personne (migration 019) : écriture, confidentialité, suppression.
-- À lancer après 01_roles_journal.test.sql (réutilise ses comptes et entreprises).

\set ON_ERROR_STOP 1
set client_min_messages = warning;
reset role;

\ir ../migrations/019_preferences_email.sql
truncate public.preferences_email;

do $$ begin assert public.frisk_version() >= 19, 'version de la base'; end $$;

-- Le lecteur de l'entreprise 1 coupe le récapitulatif du lundi et garde les e-mails immédiats.
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c","email":"lecteur@e1.fr"}', false);
select public.changer_preferences_email('10000000-0000-0000-0000-000000000001', false, true);
do $$ begin
  assert (select recapitulatif from public.preferences_email) = false, 'récapitulatif coupé';
  assert (select immediats from public.preferences_email) = true, 'e-mails immédiats gardés';
end $$;

-- Il change d'avis : la même ligne est mise à jour.
select public.changer_preferences_email('10000000-0000-0000-0000-000000000001', true, false);
do $$ begin
  assert (select count(*) from public.preferences_email) = 1, 'une seule ligne par personne et par entreprise';
  assert (select recapitulatif and not immediats from public.preferences_email), 'préférences mises à jour';
end $$;

-- Il ne peut pas régler une entreprise dont il n'est pas membre.
do $$ begin
  perform public.changer_preferences_email('10000000-0000-0000-0000-000000000002', false, false);
  raise exception 'préférence acceptée hors de son entreprise';
exception when insufficient_privilege then null;
end $$;

-- Ni écrire directement dans la table.
do $$ begin
  insert into public.preferences_email (user_id, entreprise_id) values ('00000000-0000-0000-0000-00000000000c', '10000000-0000-0000-0000-000000000001');
  raise exception 'écriture directe acceptée';
exception when insufficient_privilege then null;
end $$;

-- Un collègue ne voit pas ses préférences.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","email":"responsable@e1.fr"}', false);
do $$ begin assert (select count(*) from public.preferences_email) = 0, 'préférences d''un collègue cachées'; end $$;

-- Un administrateur Frisk les voit.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000f","email":"admin@frisk.fr"}', false);
do $$ begin assert (select count(*) from public.preferences_email) = 1, 'préférences visibles par Frisk'; end $$;

-- Retirer la personne de l'entreprise efface ses préférences.
reset role;
delete from public.membres where user_id = '00000000-0000-0000-0000-00000000000c' and entreprise_id = '10000000-0000-0000-0000-000000000001';
do $$ begin assert (select count(*) from public.preferences_email) = 0, 'préférences effacées avec le membre'; end $$;
insert into public.membres (user_id, entreprise_id, email, role)
  values ('00000000-0000-0000-0000-00000000000c', '10000000-0000-0000-0000-000000000001', 'lecteur@e1.fr', 'lecteur');

reset role;
select 'Tests des préférences d''e-mail passés.' as resultat;
