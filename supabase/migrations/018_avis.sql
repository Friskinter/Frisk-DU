-- Frisk DU : avis des clients, publiés sur le site vitrine Frisk après relecture.
-- À exécuter une fois dans Supabase : SQL Editor > New query > coller ce fichier > Run.
-- Le script peut être relancé sans risque.

create or replace function public.frisk_version()
returns integer
language sql
immutable
set search_path = ''
as $$ select 18; $$;
grant execute on function public.frisk_version() to authenticated, anon;

-- Un avis par utilisateur, déposé depuis son espace (« Mon compte ») : seuls de vrais clients
-- connectés peuvent en donner un. Le modifier le renvoie en relecture.
--   en_attente : à relire par Frisk (console)
--   publie     : affiché sur le site vitrine
--   refuse     : écarté (injurieux, hors sujet, données personnelles)
create table if not exists public.avis (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  modifie_le timestamptz not null default now(),
  entreprise_id uuid not null references public.entreprises (id) on delete cascade,
  user_id uuid not null unique,
  note smallint not null check (note between 1 and 5),
  texte text not null check (char_length(texte) between 20 and 1000),
  auteur text not null check (char_length(auteur) between 2 and 80), -- nom affiché, ex. « Marie D. »
  fonction text not null default '' check (char_length(fonction) <= 80), -- ex. « Gérante »
  entreprise_affichee text not null default '' check (char_length(entreprise_affichee) <= 120), -- vide : non affichée
  statut text not null default 'en_attente' check (statut in ('en_attente', 'publie', 'refuse')),
  modere_le timestamptz
);
create index if not exists avis_publies on public.avis (modifie_le desc) where statut = 'publie';

-- Lecture : son propre avis, ou tous pour les administrateurs Frisk. Écriture uniquement par les
-- fonctions ci-dessous.
alter table public.avis enable row level security;
drop policy if exists "avis_lecture" on public.avis;
create policy "avis_lecture" on public.avis for select to authenticated
  using (user_id = auth.uid() or public.est_admin());
revoke all on public.avis from anon;
revoke insert, update, delete on public.avis from authenticated;

-- Dépôt ou modification de son avis, par un membre actif de l'entreprise.
create or replace function public.deposer_avis(
  p_entreprise uuid, p_note integer, p_texte text, p_auteur text, p_fonction text, p_entreprise_affichee text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.est_membre_actif(p_entreprise) then
    raise exception 'Accès refusé' using errcode = 'insufficient_privilege';
  end if;
  insert into public.avis (entreprise_id, user_id, note, texte, auteur, fonction, entreprise_affichee)
  values (p_entreprise, auth.uid(), p_note, btrim(p_texte), btrim(p_auteur), btrim(coalesce(p_fonction, '')),
          btrim(coalesce(p_entreprise_affichee, '')))
  on conflict (user_id) do update set
    entreprise_id = excluded.entreprise_id,
    note = excluded.note,
    texte = excluded.texte,
    auteur = excluded.auteur,
    fonction = excluded.fonction,
    entreprise_affichee = excluded.entreprise_affichee,
    statut = 'en_attente',
    modifie_le = now(),
    modere_le = null;
end;
$$;
revoke all on function public.deposer_avis(uuid, integer, text, text, text, text) from public, anon;
grant execute on function public.deposer_avis(uuid, integer, text, text, text, text) to authenticated;

-- Relecture par un administrateur Frisk : publier, refuser ou remettre en attente.
create or replace function public.moderer_avis(p_avis uuid, p_statut text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.est_admin() then
    raise exception 'Accès refusé' using errcode = 'insufficient_privilege';
  end if;
  if p_statut not in ('en_attente', 'publie', 'refuse') then
    raise exception 'Statut inconnu : %', p_statut using errcode = 'invalid_parameter_value';
  end if;
  update public.avis set statut = p_statut, modere_le = case when p_statut = 'en_attente' then null else now() end
  where id = p_avis;
end;
$$;
revoke all on function public.moderer_avis(uuid, text) from public, anon;
grant execute on function public.moderer_avis(uuid, text) to authenticated;

-- Avis publiés, lisibles par tous (site vitrine) : uniquement ce qui est fait pour être affiché,
-- jamais l'e-mail ni l'identifiant de l'auteur ou de l'entreprise.
create or replace function public.avis_publies()
returns table (note smallint, texte text, auteur text, fonction text, entreprise text, date timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select a.note, a.texte, a.auteur, a.fonction, a.entreprise_affichee, a.modifie_le
  from public.avis a
  join public.entreprises en on en.id = a.entreprise_id
  where a.statut = 'publie' and en.actif
  order by a.modifie_le desc
  limit 50;
$$;
grant execute on function public.avis_publies() to anon, authenticated;
