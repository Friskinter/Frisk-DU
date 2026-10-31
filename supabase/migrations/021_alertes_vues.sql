-- Frisk Plateforme : alertes déjà vues par chaque personne, pour signaler les nouvelles.
-- À exécuter une fois dans Supabase : SQL Editor > New query > coller ce fichier > Run.
-- Le script peut être relancé sans risque.

create or replace function public.frisk_version()
returns integer
language sql
immutable
set search_path = ''
as $$ select 21; $$;
grant execute on function public.frisk_version() to authenticated, anon;

-- Empreintes des alertes affichées lors de la dernière visite du tableau de bord (lib/alertes-vues.ts).
-- Une alerte dont l'empreinte n'y figure pas est « nouvelle ». La ligne « __visite__ » distingue une
-- première visite (aucune alerte présentée comme nouvelle) d'une visite sans alerte.
create table if not exists public.alertes_vues (
  user_id uuid not null,
  entreprise_id uuid not null,
  empreinte text not null check (char_length(empreinte) <= 120),
  vue_le timestamptz not null default now(),
  primary key (user_id, entreprise_id, empreinte),
  foreign key (user_id, entreprise_id) references public.membres (user_id, entreprise_id) on delete cascade
);

alter table public.alertes_vues enable row level security;
drop policy if exists "alertes_vues_lecture" on public.alertes_vues;
create policy "alertes_vues_lecture" on public.alertes_vues for select to authenticated
  using (user_id = auth.uid());
revoke all on public.alertes_vues from anon;
revoke insert, update, delete on public.alertes_vues from authenticated;

-- Remplace les alertes vues de la personne connectée par celles qu'elle vient de voir : la table
-- reste petite, et une alerte réglée puis revenue est de nouveau signalée comme nouvelle.
create or replace function public.marquer_alertes_vues(p_entreprise uuid, p_empreintes text[])
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
  if coalesce(array_length(p_empreintes, 1), 0) > 500 then
    raise exception 'Trop d''alertes' using errcode = 'invalid_parameter_value';
  end if;
  delete from public.alertes_vues
    where user_id = auth.uid() and entreprise_id = p_entreprise
      and empreinte <> '__visite__' and not (empreinte = any (coalesce(p_empreintes, '{}')));
  insert into public.alertes_vues (user_id, entreprise_id, empreinte)
    select auth.uid(), p_entreprise, e from unnest(coalesce(p_empreintes, '{}') || '__visite__'::text) as e
    on conflict do nothing;
end;
$$;
revoke all on function public.marquer_alertes_vues(uuid, text[]) from public, anon;
grant execute on function public.marquer_alertes_vues(uuid, text[]) to authenticated;
