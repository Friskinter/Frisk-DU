-- Tests du multi-établissements (migration 009) : visibilité des groupes et des établissements.
-- À lancer après 01_roles_journal.test.sql (réutilise ses comptes et entreprises).

\set ON_ERROR_STOP 1
set client_min_messages = warning;
reset role;

\ir ../migrations/009_groupes.sql

do $$ begin assert public.frisk_version() >= 9, 'version de la base'; end $$;

-- Un groupe de deux établissements (entreprises 1 et 3) ; l'entreprise 2 reste à part.
delete from public.groupes;
insert into public.groupes (id, nom) values ('20000000-0000-0000-0000-000000000001', 'Groupe 1');
insert into public.entreprises (id, nom) values ('10000000-0000-0000-0000-000000000003', 'Entreprise 1 - site B')
  on conflict (id) do nothing;
update public.entreprises set groupe_id = '20000000-0000-0000-0000-000000000001'
  where id in ('10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003');

-- Le responsable de l'entreprise 1 voit le groupe, mais pas le site B auquel il n'est pas rattaché.
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","email":"responsable@e1.fr"}', false);
do $$ begin
  assert (select count(*) from public.groupes) = 1, 'groupe visible';
  assert (select count(*) from public.entreprises where groupe_id is not null) = 1, 'seul son établissement est visible';
end $$;

-- Rattaché aussi au site B, il voit les deux établissements et leurs espaces.
reset role;
insert into public.membres (user_id, entreprise_id, email, role)
  values ('00000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-000000000003', 'responsable@e1.fr', 'lecteur')
  on conflict do nothing;
insert into public.espaces (entreprise_id, contenu) values ('10000000-0000-0000-0000-000000000003', '{"version":1,"entreprise":"Site B"}')
  on conflict (entreprise_id) do nothing;
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","email":"responsable@e1.fr"}', false);
do $$ begin
  assert (select count(*) from public.entreprises where groupe_id = '20000000-0000-0000-0000-000000000001') = 2, 'deux établissements visibles';
  assert (select count(*) from public.espaces where entreprise_id in ('10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003')) = 2, 'deux espaces lisibles';
end $$;

-- Le responsable de l'entreprise 2 ne voit pas le groupe et ne peut pas en créer.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000d","email":"responsable@e2.fr"}', false);
do $$ begin
  assert (select count(*) from public.groupes) = 0, 'groupe invisible pour une autre entreprise';
  begin
    insert into public.groupes (nom) values ('Pirate');
    raise exception 'un client a créé un groupe';
  exception when insufficient_privilege then null;
  end;
  -- Il ne peut pas non plus rattacher son entreprise à un groupe (la ligne reste inchangée).
  update public.entreprises set groupe_id = '20000000-0000-0000-0000-000000000001' where id = '10000000-0000-0000-0000-000000000002';
end $$;
reset role;
do $$ begin
  assert (select groupe_id is null from public.entreprises where id = '10000000-0000-0000-0000-000000000002'), 'rattachement refusé au client';
end $$;
set role authenticated;

-- L'administrateur Frisk gère les groupes.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000f","email":"admin@frisk.fr"}', false);
do $$ begin
  insert into public.groupes (id, nom) values ('20000000-0000-0000-0000-000000000002', 'Groupe 2');
  update public.entreprises set groupe_id = '20000000-0000-0000-0000-000000000002' where id = '10000000-0000-0000-0000-000000000002';
  assert (select groupe_id from public.entreprises where id = '10000000-0000-0000-0000-000000000002') = '20000000-0000-0000-0000-000000000002', 'rattachement par l''administrateur';
end $$;

-- Supprimer un groupe laisse les établissements intacts.
reset role;
delete from public.groupes where id = '20000000-0000-0000-0000-000000000002';
do $$ begin
  assert (select groupe_id is null from public.entreprises where id = '10000000-0000-0000-0000-000000000002'), 'établissement détaché';
end $$;

select 'Tests du multi-établissements passés.' as resultat;
