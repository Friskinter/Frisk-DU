-- Frisk DU : double authentification exigée par la base de données.
-- Dès qu'un utilisateur a activé la double authentification, ses données (espaces, versions,
-- journal, fichiers, enregistrement) ne lui sont accessibles qu'avec une session validée par le
-- code de son application (niveau « aal2 »). Sans double authentification, rien ne change.
-- À exécuter une fois dans Supabase : SQL Editor > New query > coller ce fichier > Run.
-- Le script peut être relancé sans risque.

create or replace function public.frisk_version()
returns integer
language sql
immutable
set search_path = ''
as $$ select 10; $$;
grant execute on function public.frisk_version() to authenticated, anon;

create or replace function public.authentification_suffisante()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
    or not exists (
      select 1 from auth.mfa_factors f
      where f.user_id = auth.uid() and f.status::text = 'verified'
    );
$$;
grant execute on function public.authentification_suffisante() to authenticated;

-- Les trois fonctions sur lesquelles reposent toutes les règles d'accès aux données.
create or replace function public.est_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.authentification_suffisante()
    and exists (select 1 from public.admins_frisk where user_id = auth.uid());
$$;

create or replace function public.est_membre_actif(e uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.authentification_suffisante() and exists (
    select 1
    from public.membres m
    join public.entreprises en on en.id = m.entreprise_id
    where m.user_id = auth.uid() and m.entreprise_id = e and en.actif
  );
$$;

create or replace function public.role_dans(e uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when not public.authentification_suffisante() then null
    when public.est_admin() then 'admin'
    else (
      select m.role
      from public.membres m
      join public.entreprises en on en.id = m.entreprise_id
      where m.user_id = auth.uid() and m.entreprise_id = e and en.actif
    )
  end;
$$;
