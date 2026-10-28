-- Frisk DU : versions figées du document unique (conservation 40 ans).
-- À exécuter une fois dans Supabase : SQL Editor > New query > coller ce fichier > Run.
-- Le script peut être relancé sans risque.

create table if not exists public.versions (
  id uuid primary key default gen_random_uuid(),
  entreprise_id uuid not null references public.entreprises (id) on delete restrict,
  numero integer not null,
  motif text not null,
  contenu jsonb not null, -- instantané : entreprise, fiche, unités et lignes du DUERP
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  auteur text not null default '',
  unique (entreprise_id, numero)
);

-- Numéro attribué par la base, à la suite du précédent, et auteur horodaté côté serveur.
create or replace function public.numeroter_version()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtext(new.entreprise_id::text));
  select coalesce(max(numero), 0) + 1 into new.numero from public.versions where entreprise_id = new.entreprise_id;
  new.created_at := now();
  new.created_by := auth.uid();
  return new;
end;
$$;

drop trigger if exists numeroter_version on public.versions;
create trigger numeroter_version
  before insert on public.versions
  for each row execute function public.numeroter_version();

alter table public.versions enable row level security;

drop policy if exists "versions_lecture" on public.versions;
create policy "versions_lecture" on public.versions for select to authenticated
  using (public.est_admin() or public.est_membre_actif(entreprise_id));

drop policy if exists "versions_creation" on public.versions;
create policy "versions_creation" on public.versions for insert to authenticated
  with check (public.est_admin() or public.est_membre_actif(entreprise_id));

-- Aucune règle de modification ni de suppression : une version figée est définitive.
revoke update, delete on public.versions from authenticated, anon;
revoke all on public.versions from anon;
