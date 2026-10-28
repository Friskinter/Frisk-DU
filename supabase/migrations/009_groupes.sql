-- Frisk DU : multi-établissements. Plusieurs espaces (un par établissement) réunis dans un groupe,
-- avec une vue d'ensemble pour les utilisateurs qui ont accès à plusieurs établissements.
-- À exécuter une fois dans Supabase : SQL Editor > New query > coller ce fichier > Run.
-- Le script peut être relancé sans risque.

create or replace function public.frisk_version()
returns integer
language sql
immutable
set search_path = ''
as $$ select 9; $$;
grant execute on function public.frisk_version() to authenticated, anon;

create table if not exists public.groupes (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  created_at timestamptz not null default now()
);

alter table public.entreprises add column if not exists groupe_id uuid references public.groupes (id) on delete set null;
create index if not exists entreprises_groupe on public.entreprises (groupe_id);

-- Un utilisateur voit le nom d'un groupe s'il a accès à l'un de ses établissements.
-- Il ne voit que les établissements auxquels il est rattaché (règles des entreprises inchangées).
alter table public.groupes enable row level security;

drop policy if exists "groupes_lecture" on public.groupes;
create policy "groupes_lecture" on public.groupes for select to authenticated
  using (
    public.est_admin()
    or exists (
      select 1 from public.entreprises e
      join public.membres m on m.entreprise_id = e.id
      where e.groupe_id = groupes.id and m.user_id = auth.uid()
    )
  );

drop policy if exists "groupes_admin" on public.groupes;
create policy "groupes_admin" on public.groupes for all to authenticated
  using (public.est_admin()) with check (public.est_admin());

revoke all on public.groupes from anon;
grant select, insert, update, delete on public.groupes to authenticated;
