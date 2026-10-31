-- Frisk Plateforme : e-mails immédiats des urgences, sans jamais signaler deux fois la même.
-- À exécuter une fois dans Supabase : SQL Editor > New query > coller ce fichier > Run.
-- Le script peut être relancé sans risque.

create or replace function public.frisk_version()
returns integer
language sql
immutable
set search_path = ''
as $$ select 20; $$;
grant execute on function public.frisk_version() to authenticated, anon;

-- Urgences déjà signalées par e-mail, par entreprise (clé : alerte et élément concerné, lib/urgences.ts).
-- Une urgence réglée est retirée de la table : si elle revient, elle est signalée de nouveau.
-- Lue et écrite uniquement par la tâche planifiée (clé secrète du serveur) ; lisible par Frisk.
create table if not exists public.alertes_envoyees (
  entreprise_id uuid not null references public.entreprises (id) on delete cascade,
  cle text not null check (char_length(cle) <= 300),
  envoyee_le timestamptz not null default now(),
  primary key (entreprise_id, cle)
);

alter table public.alertes_envoyees enable row level security;
drop policy if exists "alertes_envoyees_lecture" on public.alertes_envoyees;
create policy "alertes_envoyees_lecture" on public.alertes_envoyees for select to authenticated
  using (public.est_admin());
revoke all on public.alertes_envoyees from anon;
revoke insert, update, delete on public.alertes_envoyees from authenticated;
