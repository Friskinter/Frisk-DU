-- Tests de la liste des utilisateurs d'un espace (migration 023) : collègues seulement, et droits.
-- À lancer après 01_roles_journal.test.sql (réutilise ses comptes et entreprises).

\set ON_ERROR_STOP 1
set client_min_messages = warning;
reset role;

\ir ../migrations/023_utilisateurs_espace.sql

do $$ begin assert public.frisk_version() >= 23, 'version de la base'; end $$;

-- Un membre de l'entreprise 1 voit ses trois collègues, avec leur rôle.
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","email":"contributeur@e1.fr"}', false);
do $$ begin
  assert (select array_agg(email order by email) from public.utilisateurs_espace('10000000-0000-0000-0000-000000000001'))
    = array['contributeur@e1.fr', 'lecteur@e1.fr', 'responsable@e1.fr'], 'collègues de l''entreprise 1';
  assert (select role from public.utilisateurs_espace('10000000-0000-0000-0000-000000000001') where email = 'responsable@e1.fr') = 'responsable', 'rôle';
  -- Sa propre règle d'accès reste inchangée : il ne lit toujours que sa ligne de « membres ».
  assert (select count(*) from public.membres) = 1, 'membres : sa ligne seulement';
end $$;

-- Pas les utilisateurs d'une autre entreprise.
do $$ begin
  begin
    perform public.utilisateurs_espace('10000000-0000-0000-0000-000000000002');
    raise exception 'liste d''une autre entreprise obtenue';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Pas sans compte.
set role anon;
select set_config('request.jwt.claims', '{}', false);
do $$ begin
  begin
    perform public.utilisateurs_espace('10000000-0000-0000-0000-000000000001');
    raise exception 'liste obtenue sans compte';
  exception when insufficient_privilege then null;
  end;
end $$;

-- L'administrateur Frisk voit les utilisateurs de toute entreprise.
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000f","email":"admin@frisk.fr"}', false);
do $$ begin
  assert (select count(*) from public.utilisateurs_espace('10000000-0000-0000-0000-000000000002')) = 1, 'administrateur';
end $$;

reset role;
select 'Tests des utilisateurs de l''espace passés.' as resultat;
