-- Frisk DU : schéma de la base de données.
-- À exécuter une fois dans Supabase : SQL Editor > New query > coller ce fichier > Run.
-- Le script peut être relancé sans risque.

-- Entreprises clientes
create table if not exists public.entreprises (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  actif boolean not null default true,
  created_at timestamptz not null default now()
);

-- Utilisateurs rattachés à une entreprise
create table if not exists public.membres (
  user_id uuid not null references auth.users (id) on delete cascade,
  entreprise_id uuid not null references public.entreprises (id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, entreprise_id)
);

-- Comptes Frisk ayant accès à la console d'administration
create table if not exists public.admins_frisk (
  user_id uuid primary key references auth.users (id) on delete cascade
);

-- Données de chaque entreprise (DUERP, salariés, EPI, mouvements)
create table if not exists public.espaces (
  entreprise_id uuid primary key references public.entreprises (id) on delete cascade,
  contenu jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

-- La date de mise à jour sert de numéro de version pour éviter d'écraser
-- les modifications d'un collègue.
create or replace function public.horodater_espace()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := clock_timestamp();
  new.updated_by := auth.uid();
  return new;
end;
$$;

drop trigger if exists horodater_espace on public.espaces;
create trigger horodater_espace
  before insert or update on public.espaces
  for each row execute function public.horodater_espace();

-- Fonctions d'autorisation
create or replace function public.est_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins_frisk where user_id = auth.uid());
$$;

create or replace function public.est_membre_actif(e uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.membres m
    join public.entreprises en on en.id = m.entreprise_id
    where m.user_id = auth.uid() and m.entreprise_id = e and en.actif
  );
$$;

-- Sécurité au niveau des lignes : chaque entreprise ne voit que ses données.
alter table public.entreprises enable row level security;
alter table public.membres enable row level security;
alter table public.admins_frisk enable row level security;
alter table public.espaces enable row level security;

drop policy if exists "entreprises_lecture" on public.entreprises;
create policy "entreprises_lecture" on public.entreprises for select to authenticated
  using (
    public.est_admin()
    or exists (select 1 from public.membres m where m.entreprise_id = entreprises.id and m.user_id = auth.uid())
  );

drop policy if exists "entreprises_admin" on public.entreprises;
create policy "entreprises_admin" on public.entreprises for all to authenticated
  using (public.est_admin()) with check (public.est_admin());

drop policy if exists "membres_lecture" on public.membres;
create policy "membres_lecture" on public.membres for select to authenticated
  using (user_id = auth.uid() or public.est_admin());

drop policy if exists "membres_admin" on public.membres;
create policy "membres_admin" on public.membres for all to authenticated
  using (public.est_admin()) with check (public.est_admin());

drop policy if exists "admins_lecture" on public.admins_frisk;
create policy "admins_lecture" on public.admins_frisk for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "espaces_lecture" on public.espaces;
create policy "espaces_lecture" on public.espaces for select to authenticated
  using (public.est_admin() or public.est_membre_actif(entreprise_id));

drop policy if exists "espaces_creation" on public.espaces;
create policy "espaces_creation" on public.espaces for insert to authenticated
  with check (public.est_admin() or public.est_membre_actif(entreprise_id));

drop policy if exists "espaces_modification" on public.espaces;
create policy "espaces_modification" on public.espaces for update to authenticated
  using (public.est_admin() or public.est_membre_actif(entreprise_id))
  with check (public.est_admin() or public.est_membre_actif(entreprise_id));

drop policy if exists "espaces_suppression" on public.espaces;
create policy "espaces_suppression" on public.espaces for delete to authenticated
  using (public.est_admin());

-- Aucun accès pour les visiteurs non connectés.
revoke all on public.entreprises, public.membres, public.admins_frisk, public.espaces from anon;
