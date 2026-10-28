-- Tests de la double authentification exigée par la base (migration 010).
-- À lancer après 01_roles_journal.test.sql (réutilise ses comptes et entreprises).

\set ON_ERROR_STOP 1
set client_min_messages = warning;
reset role;

\ir ../migrations/010_double_authentification.sql

do $$ begin assert public.frisk_version() = 10, 'version de la base'; end $$;

delete from auth.mfa_factors;
-- Le responsable de l'entreprise 1 et l'administrateur activent la double authentification ;
-- le lecteur a commencé une activation sans la terminer.
insert into auth.mfa_factors (user_id, status) values
  ('00000000-0000-0000-0000-00000000000a', 'verified'),
  ('00000000-0000-0000-0000-00000000000f', 'verified'),
  ('00000000-0000-0000-0000-00000000000c', 'unverified');

set role authenticated;

-- Session validée par le seul mot de passe (aal1) : aucune donnée, aucun enregistrement.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","email":"responsable@e1.fr","aal":"aal1"}', false);
do $$ begin
  assert (select count(*) from public.espaces) = 0, 'espaces cachés sans le code';
  assert (select count(*) from public.journal) = 0, 'journal caché sans le code';
  assert public.role_dans('10000000-0000-0000-0000-000000000001') is null, 'aucun rôle sans le code';
  begin
    perform public.appliquer_operations('10000000-0000-0000-0000-000000000001', '[{"type":"racine","cle":"entreprise","valeur":"Pirate"}]');
    raise exception 'enregistrement accepté sans le code';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Session validée par le code (aal2) : accès normal.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","email":"responsable@e1.fr","aal":"aal2"}', false);
do $$ begin
  assert (select count(*) from public.espaces where entreprise_id = '10000000-0000-0000-0000-000000000001') = 1, 'espace visible avec le code';
  assert public.role_dans('10000000-0000-0000-0000-000000000001') = 'responsable', 'rôle retrouvé avec le code';
end $$;

-- Sans double authentification activée (activation non terminée), le mot de passe suffit.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c","email":"lecteur@e1.fr","aal":"aal1"}', false);
do $$ begin
  assert public.role_dans('10000000-0000-0000-0000-000000000001') = 'lecteur', 'facteur non vérifié sans effet';
end $$;

-- L'administrateur Frisk perd ses droits tant que le code n'est pas validé.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000f","email":"admin@frisk.fr","aal":"aal1"}', false);
do $$ begin
  assert not public.est_admin(), 'administrateur sans le code';
  assert (select count(*) from public.entreprises) = 0, 'entreprises cachées à l''administrateur sans le code';
end $$;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000f","email":"admin@frisk.fr","aal":"aal2"}', false);
do $$ begin
  assert public.est_admin(), 'administrateur avec le code';
end $$;

reset role;
delete from auth.mfa_factors;
select 'Tests de la double authentification passés.' as resultat;
