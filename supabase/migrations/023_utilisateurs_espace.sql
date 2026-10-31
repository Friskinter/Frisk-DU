-- Frisk Plateforme : liste des utilisateurs d'un espace, pour confier une action à l'un d'eux
-- (plan d'actions, page « Mes actions », récapitulatif du lundi).
-- À exécuter une fois dans Supabase : SQL Editor > New query > coller ce fichier > Run.
-- Le script peut être relancé sans risque.

create or replace function public.frisk_version()
returns integer
language sql
immutable
set search_path = ''
as $$ select 23; $$;
grant execute on function public.frisk_version() to authenticated, anon;

-- Chaque membre ne lit que sa propre ligne de « membres » (règle d'accès inchangée). Cette fonction
-- donne aux membres d'un espace actif l'adresse et le rôle de leurs collègues de cet espace, rien
-- de plus : ni les autres espaces, ni les identifiants.
create or replace function public.utilisateurs_espace(p_entreprise uuid)
returns table (email text, role text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (public.est_membre_actif(p_entreprise) or public.est_admin()) then
    raise exception 'Accès refusé' using errcode = 'insufficient_privilege';
  end if;
  return query
    select m.email, m.role
    from public.membres m
    where m.entreprise_id = p_entreprise
    order by lower(m.email);
end;
$$;
revoke all on function public.utilisateurs_espace(uuid) from public, anon;
grant execute on function public.utilisateurs_espace(uuid) to authenticated;
