-- Frisk Plateforme : préférences d'e-mail de chaque personne, pour chacune de ses entreprises.
-- À exécuter une fois dans Supabase : SQL Editor > New query > coller ce fichier > Run.
-- Le script peut être relancé sans risque.

create or replace function public.frisk_version()
returns integer
language sql
immutable
set search_path = ''
as $$ select 19; $$;
grant execute on function public.frisk_version() to authenticated, anon;

-- Sans ligne pour une personne, tout est envoyé (comportement d'avant ces préférences).
-- Le réglage de l'entreprise (« Alertes par e-mail », document de l'entreprise) reste prioritaire :
-- s'il est coupé, personne ne reçoit le récapitulatif.
--   recapitulatif : récapitulatif des alertes du lundi
--   immediats     : e-mails envoyés sur le moment (signalement terrain, puis urgences)
create table if not exists public.preferences_email (
  user_id uuid not null,
  entreprise_id uuid not null,
  recapitulatif boolean not null default true,
  immediats boolean not null default true,
  modifie_le timestamptz not null default now(),
  primary key (user_id, entreprise_id),
  foreign key (user_id, entreprise_id) references public.membres (user_id, entreprise_id) on delete cascade
);

-- Lecture : ses propres préférences, ou toutes pour les administrateurs Frisk. Écriture uniquement par
-- la fonction ci-dessous ; les envois lisent la table avec la clé secrète du serveur.
alter table public.preferences_email enable row level security;
drop policy if exists "preferences_email_lecture" on public.preferences_email;
create policy "preferences_email_lecture" on public.preferences_email for select to authenticated
  using (user_id = auth.uid() or public.est_admin());
revoke all on public.preferences_email from anon;
revoke insert, update, delete on public.preferences_email from authenticated;

-- Enregistre les préférences de la personne connectée pour une entreprise dont elle est membre.
create or replace function public.changer_preferences_email(p_entreprise uuid, p_recapitulatif boolean, p_immediats boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.membres where user_id = auth.uid() and entreprise_id = p_entreprise
  ) then
    raise exception 'Accès refusé' using errcode = 'insufficient_privilege';
  end if;
  insert into public.preferences_email (user_id, entreprise_id, recapitulatif, immediats)
  values (auth.uid(), p_entreprise, coalesce(p_recapitulatif, true), coalesce(p_immediats, true))
  on conflict (user_id, entreprise_id) do update set
    recapitulatif = excluded.recapitulatif,
    immediats = excluded.immediats,
    modifie_le = now();
end;
$$;
revoke all on function public.changer_preferences_email(uuid, boolean, boolean) from public, anon;
grant execute on function public.changer_preferences_email(uuid, boolean, boolean) to authenticated;
