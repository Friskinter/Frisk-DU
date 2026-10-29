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

-- ---------------------------------------------------------------
-- Versions figées du document unique (conservation 40 ans)
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

-- ---------------------------------------------------------------
-- Rôles, journal des modifications et travail à plusieurs (migration 003)
-- Rôles
--   responsable  : modifie tout (DUERP, salariés, catalogue, réglages, versions)
--   contributeur : saisit les remises et réceptions d'EPI et les signatures
--   lecteur      : consulte seulement (ex. membre du CSE)
-- ---------------------------------------------------------------------------
alter table public.membres add column if not exists role text not null default 'responsable';
alter table public.membres drop constraint if exists membres_role_valide;
alter table public.membres add constraint membres_role_valide check (role in ('responsable', 'contributeur', 'lecteur'));

-- Rôle de l'utilisateur connecté dans une entreprise : 'admin' pour Frisk, null sans accès.
create or replace function public.role_dans(e uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when public.est_admin() then 'admin'
    else (
      select m.role
      from public.membres m
      join public.entreprises en on en.id = m.entreprise_id
      where m.user_id = auth.uid() and m.entreprise_id = e and en.actif
    )
  end;
$$;

-- Seuls les responsables (et Frisk) figent une version du document unique.
drop policy if exists "versions_creation" on public.versions;
create policy "versions_creation" on public.versions for insert to authenticated
  with check (public.role_dans(entreprise_id) in ('admin', 'responsable'));

-- ---------------------------------------------------------------------------
-- Journal des modifications
-- ---------------------------------------------------------------------------
create table if not exists public.journal (
  id bigint generated always as identity primary key,
  entreprise_id uuid not null references public.entreprises (id) on delete cascade,
  created_at timestamptz not null default now(),
  user_id uuid references auth.users (id) on delete set null,
  auteur text not null default '',
  collection text not null, -- duerp, salaries, articles, mouvements, entreprise, signatures
  element_id text not null,
  action text not null check (action in ('ajout', 'modification', 'suppression')),
  avant jsonb,
  apres jsonb
);
create index if not exists journal_entreprise_date on public.journal (entreprise_id, created_at desc);
create index if not exists journal_element on public.journal (entreprise_id, element_id);

alter table public.journal enable row level security;
drop policy if exists "journal_lecture" on public.journal;
create policy "journal_lecture" on public.journal for select to authenticated
  using (public.role_dans(entreprise_id) is not null);
-- Aucune écriture directe : seul appliquer_operations alimente le journal.
revoke insert, update, delete on public.journal from authenticated, anon;
revoke all on public.journal from anon;

-- ---------------------------------------------------------------------------
-- Enregistrement des modifications
-- ---------------------------------------------------------------------------
-- Identifiant de l'onglet qui a fait la dernière modification : un navigateur ignore ainsi
-- ses propres modifications quand la base les lui renvoie en direct.
alter table public.espaces add column if not exists updated_client text;

-- Les espaces ne s'écrivent plus directement : tout passe par appliquer_operations.
drop policy if exists "espaces_creation" on public.espaces;
drop policy if exists "espaces_modification" on public.espaces;
drop policy if exists "espaces_lecture" on public.espaces;
create policy "espaces_lecture" on public.espaces for select to authenticated
  using (public.role_dans(entreprise_id) is not null);

create or replace function public.position_element(tableau jsonb, element_id text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select (e.ord - 1)::integer
  from jsonb_array_elements(tableau) with ordinality as e(valeur, ord)
  where e.valeur ->> 'id' = element_id
  limit 1;
$$;

-- Applique une liste d'opérations au contenu d'une entreprise, après vérification des droits,
-- et les inscrit au journal. Opérations acceptées (champ « type ») :
--   ajout        { collection, id, apres (id de l'élément précédent ou null), valeur }
--   modification { collection, id, champs }   — seuls les champs modifiés
--   suppression  { collection, id }
--   racine       { cle, valeur }              — entreprise, fiche, services, unites, preferences
--   signature    { id, valeur }               — ajout d'une signature (jamais supprimée)
-- Une opération sur un élément supprimé entre-temps par un collègue est ignorée ;
-- un ajout déjà appliqué (nouvel envoi après une coupure réseau) remplace l'élément.
create or replace function public.appliquer_operations(p_entreprise uuid, p_operations jsonb, p_client text default null)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text := public.role_dans(p_entreprise);
  v_auteur text := coalesce(auth.jwt() ->> 'email', '');
  v_contenu jsonb;
  v_op jsonb;
  v_type text;
  v_collection text;
  v_id text;
  v_tableau jsonb;
  v_pos integer;
  v_avant jsonb;
  v_apres jsonb;
  v_champs jsonb;
  v_cle text;
  v_date timestamptz;
begin
  if v_role is null or v_role = 'lecteur' then
    raise exception 'acces_refuse' using errcode = '42501';
  end if;
  if jsonb_typeof(p_operations) <> 'array' then
    raise exception 'operations_invalides' using errcode = '22023';
  end if;

  select contenu into v_contenu from public.espaces where entreprise_id = p_entreprise for update;
  if v_contenu is null then
    select jsonb_build_object(
      'version', 1, 'entreprise', nom, 'services', '[]'::jsonb, 'unites', '[]'::jsonb, 'duerp', '[]'::jsonb,
      'salaries', '[]'::jsonb, 'articles', '[]'::jsonb, 'mouvements', '[]'::jsonb
    ) into v_contenu from public.entreprises where id = p_entreprise;
    insert into public.espaces (entreprise_id, contenu) values (p_entreprise, v_contenu);
  end if;

  for v_op in select * from jsonb_array_elements(p_operations) loop
    v_type := v_op ->> 'type';
    v_collection := coalesce(v_op ->> 'collection', case v_type when 'racine' then 'entreprise' when 'signature' then 'signatures' end);
    v_id := coalesce(v_op ->> 'id', v_op ->> 'cle');

    -- Droits : le contributeur ne touche qu'aux mouvements d'EPI et aux signatures.
    if v_role = 'contributeur' and v_collection not in ('mouvements', 'signatures') then
      raise exception 'acces_refuse' using errcode = '42501';
    end if;

    if v_type in ('ajout', 'modification', 'suppression') then
      if v_collection not in ('duerp', 'salaries', 'articles', 'mouvements') or v_id is null then
        raise exception 'operation_invalide' using errcode = '22023';
      end if;
      v_tableau := coalesce(v_contenu -> v_collection, '[]'::jsonb);
      v_pos := public.position_element(v_tableau, v_id);

      if v_type = 'ajout' then
        v_apres := v_op -> 'valeur';
        if v_apres ->> 'id' is distinct from v_id then
          raise exception 'operation_invalide' using errcode = '22023';
        end if;
        if v_pos is not null then
          v_avant := v_tableau -> v_pos;
          v_tableau := jsonb_set(v_tableau, array[v_pos::text], v_apres);
        else
          v_avant := null;
          if v_op -> 'apres' is null or jsonb_typeof(v_op -> 'apres') = 'null' then
            v_tableau := jsonb_build_array(v_apres) || v_tableau;
          else
            v_pos := public.position_element(v_tableau, v_op ->> 'apres');
            if v_pos is null then
              v_tableau := v_tableau || jsonb_build_array(v_apres);
            else
              v_tableau := jsonb_insert(v_tableau, array[v_pos::text], v_apres, true);
            end if;
          end if;
        end if;
        insert into public.journal (entreprise_id, user_id, auteur, collection, element_id, action, avant, apres)
          values (p_entreprise, auth.uid(), v_auteur, v_collection, v_id,
                  case when v_avant is null then 'ajout' else 'modification' end, v_avant, v_apres);

      elsif v_type = 'modification' then
        continue when v_pos is null;
        v_champs := coalesce(v_op -> 'champs', '{}'::jsonb);
        select coalesce(jsonb_object_agg(k, (v_tableau -> v_pos) -> k), '{}'::jsonb)
          into v_avant
          from jsonb_object_keys(v_champs) as k
          where (v_tableau -> v_pos) -> k is distinct from v_champs -> k;
        continue when v_avant = '{}'::jsonb;
        select jsonb_object_agg(k, v_champs -> k) into v_apres from jsonb_object_keys(v_avant) as k;
        v_tableau := jsonb_set(v_tableau, array[v_pos::text], (v_tableau -> v_pos) || v_champs);
        insert into public.journal (entreprise_id, user_id, auteur, collection, element_id, action, avant, apres)
          values (p_entreprise, auth.uid(), v_auteur, v_collection, v_id, 'modification', v_avant, v_apres);

      else
        continue when v_pos is null;
        v_avant := v_tableau -> v_pos;
        v_tableau := v_tableau - v_pos;
        insert into public.journal (entreprise_id, user_id, auteur, collection, element_id, action, avant, apres)
          values (p_entreprise, auth.uid(), v_auteur, v_collection, v_id, 'suppression', v_avant, null);
      end if;
      v_contenu := jsonb_set(v_contenu, array[v_collection], v_tableau);

    elsif v_type = 'racine' then
      v_cle := v_op ->> 'cle';
      if v_cle not in ('entreprise', 'fiche', 'services', 'unites', 'preferences') then
        raise exception 'operation_invalide' using errcode = '22023';
      end if;
      v_avant := v_contenu -> v_cle;
      v_apres := v_op -> 'valeur';
      continue when v_avant is not distinct from v_apres;
      v_contenu := jsonb_set(v_contenu, array[v_cle], v_apres);
      insert into public.journal (entreprise_id, user_id, auteur, collection, element_id, action, avant, apres)
        values (p_entreprise, auth.uid(), v_auteur, 'entreprise', v_cle, 'modification', v_avant, v_apres);

    elsif v_type = 'signature' then
      v_apres := v_op -> 'valeur';
      if v_id is null or jsonb_typeof(v_apres) <> 'object' then
        raise exception 'operation_invalide' using errcode = '22023';
      end if;
      continue when (v_contenu -> 'signatures') ? v_id;
      v_contenu := jsonb_set(v_contenu, '{signatures}', coalesce(v_contenu -> 'signatures', '{}'::jsonb) || jsonb_build_object(v_id, v_apres));
      -- L'image de la signature n'est pas recopiée dans le journal.
      insert into public.journal (entreprise_id, user_id, auteur, collection, element_id, action, avant, apres)
        values (p_entreprise, auth.uid(), v_auteur, 'signatures', v_id, 'ajout', null, v_apres - 'image');

    else
      raise exception 'operation_invalide' using errcode = '22023';
    end if;
  end loop;

  v_date := clock_timestamp();
  update public.espaces
    set contenu = v_contenu, updated_client = p_client
    where entreprise_id = p_entreprise;
  return v_date;
end;
$$;

revoke all on function public.appliquer_operations(uuid, jsonb, text) from public, anon;
grant execute on function public.appliquer_operations(uuid, jsonb, text) to authenticated;

-- Diffusion en direct des modifications aux collègues connectés (Supabase Realtime).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'espaces'
     ) then
    alter publication supabase_realtime add table public.espaces;
  end if;
end;
$$;

-- ---------------------------------------------------------------
-- Plan d'actions (migration 004)

-- Version de la base attendue par l'application : elle affiche « mise à jour en cours »
-- tant que cette migration n'est pas appliquée.
create or replace function public.frisk_version()
returns integer
language sql
immutable
set search_path = ''
as $$ select 4; $$;
grant execute on function public.frisk_version() to authenticated, anon;

-- Listes du contenu modifiables par opérations (ajouter ici les futures listes).
create or replace function public.collections_frisk()
returns text[]
language sql
immutable
set search_path = ''
as $$ select array['duerp', 'actions', 'salaries', 'articles', 'mouvements']; $$;

-- Conversion des contenus existants : l'action portée par chaque ligne du DUERP devient une
-- action du plan, rattachée au risque. Les lignes sans action n'en reçoivent pas.
update public.espaces e
set contenu = jsonb_set(
  jsonb_set(
    e.contenu,
    '{actions}',
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', (l ->> 'id') || '-action',
        'risqueId', l ->> 'id',
        'intitule', l ->> 'action',
        'principe', '',
        'responsable', coalesce(l ->> 'responsable', ''),
        'echeance', coalesce(l ->> 'echeance', ''),
        'statut', coalesce(l ->> 'statut', 'a-faire'),
        'cout', null,
        'ressources', '',
        'indicateur', '',
        'realiseeLe', '',
        'efficacite', 'non-evaluee',
        'commentaire', ''
      ) order by ord)
      from jsonb_array_elements(e.contenu -> 'duerp') with ordinality as t(l, ord)
      where coalesce(trim(l ->> 'action'), '') <> ''
    ), '[]'::jsonb)
  ),
  '{duerp}',
  coalesce((
    select jsonb_agg(l - 'action' - 'responsable' - 'echeance' - 'statut' order by ord)
    from jsonb_array_elements(e.contenu -> 'duerp') with ordinality as t(l, ord)
  ), '[]'::jsonb)
)
where not (e.contenu ? 'actions');

-- Enregistrement : même fonction qu'en migration 003, avec la liste des collections ci-dessus.
create or replace function public.appliquer_operations(p_entreprise uuid, p_operations jsonb, p_client text default null)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text := public.role_dans(p_entreprise);
  v_auteur text := coalesce(auth.jwt() ->> 'email', '');
  v_contenu jsonb;
  v_op jsonb;
  v_type text;
  v_collection text;
  v_id text;
  v_tableau jsonb;
  v_pos integer;
  v_avant jsonb;
  v_apres jsonb;
  v_champs jsonb;
  v_cle text;
  v_date timestamptz;
begin
  if v_role is null or v_role = 'lecteur' then
    raise exception 'acces_refuse' using errcode = '42501';
  end if;
  if jsonb_typeof(p_operations) <> 'array' then
    raise exception 'operations_invalides' using errcode = '22023';
  end if;

  select contenu into v_contenu from public.espaces where entreprise_id = p_entreprise for update;
  if v_contenu is null then
    select jsonb_build_object(
      'version', 1, 'entreprise', nom, 'services', '[]'::jsonb, 'unites', '[]'::jsonb, 'duerp', '[]'::jsonb, 'actions', '[]'::jsonb,
      'salaries', '[]'::jsonb, 'articles', '[]'::jsonb, 'mouvements', '[]'::jsonb
    ) into v_contenu from public.entreprises where id = p_entreprise;
    insert into public.espaces (entreprise_id, contenu) values (p_entreprise, v_contenu);
  end if;

  for v_op in select * from jsonb_array_elements(p_operations) loop
    v_type := v_op ->> 'type';
    v_collection := coalesce(v_op ->> 'collection', case v_type when 'racine' then 'entreprise' when 'signature' then 'signatures' end);
    v_id := coalesce(v_op ->> 'id', v_op ->> 'cle');

    -- Droits : le contributeur ne touche qu'aux mouvements d'EPI et aux signatures.
    if v_role = 'contributeur' and v_collection not in ('mouvements', 'signatures') then
      raise exception 'acces_refuse' using errcode = '42501';
    end if;

    if v_type in ('ajout', 'modification', 'suppression') then
      if not (v_collection = any (public.collections_frisk())) or v_id is null then
        raise exception 'operation_invalide' using errcode = '22023';
      end if;
      v_tableau := coalesce(v_contenu -> v_collection, '[]'::jsonb);
      v_pos := public.position_element(v_tableau, v_id);

      if v_type = 'ajout' then
        v_apres := v_op -> 'valeur';
        if v_apres ->> 'id' is distinct from v_id then
          raise exception 'operation_invalide' using errcode = '22023';
        end if;
        if v_pos is not null then
          v_avant := v_tableau -> v_pos;
          v_tableau := jsonb_set(v_tableau, array[v_pos::text], v_apres);
        else
          v_avant := null;
          if v_op -> 'apres' is null or jsonb_typeof(v_op -> 'apres') = 'null' then
            v_tableau := jsonb_build_array(v_apres) || v_tableau;
          else
            v_pos := public.position_element(v_tableau, v_op ->> 'apres');
            if v_pos is null then
              v_tableau := v_tableau || jsonb_build_array(v_apres);
            else
              v_tableau := jsonb_insert(v_tableau, array[v_pos::text], v_apres, true);
            end if;
          end if;
        end if;
        insert into public.journal (entreprise_id, user_id, auteur, collection, element_id, action, avant, apres)
          values (p_entreprise, auth.uid(), v_auteur, v_collection, v_id,
                  case when v_avant is null then 'ajout' else 'modification' end, v_avant, v_apres);

      elsif v_type = 'modification' then
        continue when v_pos is null;
        v_champs := coalesce(v_op -> 'champs', '{}'::jsonb);
        select coalesce(jsonb_object_agg(k, (v_tableau -> v_pos) -> k), '{}'::jsonb)
          into v_avant
          from jsonb_object_keys(v_champs) as k
          where (v_tableau -> v_pos) -> k is distinct from v_champs -> k;
        continue when v_avant = '{}'::jsonb;
        select jsonb_object_agg(k, v_champs -> k) into v_apres from jsonb_object_keys(v_avant) as k;
        v_tableau := jsonb_set(v_tableau, array[v_pos::text], (v_tableau -> v_pos) || v_champs);
        insert into public.journal (entreprise_id, user_id, auteur, collection, element_id, action, avant, apres)
          values (p_entreprise, auth.uid(), v_auteur, v_collection, v_id, 'modification', v_avant, v_apres);

      else
        continue when v_pos is null;
        v_avant := v_tableau -> v_pos;
        v_tableau := v_tableau - v_pos;
        insert into public.journal (entreprise_id, user_id, auteur, collection, element_id, action, avant, apres)
          values (p_entreprise, auth.uid(), v_auteur, v_collection, v_id, 'suppression', v_avant, null);
      end if;
      v_contenu := jsonb_set(v_contenu, array[v_collection], v_tableau);

    elsif v_type = 'racine' then
      v_cle := v_op ->> 'cle';
      if v_cle not in ('entreprise', 'fiche', 'services', 'unites', 'preferences') then
        raise exception 'operation_invalide' using errcode = '22023';
      end if;
      v_avant := v_contenu -> v_cle;
      v_apres := v_op -> 'valeur';
      continue when v_avant is not distinct from v_apres;
      v_contenu := jsonb_set(v_contenu, array[v_cle], v_apres);
      insert into public.journal (entreprise_id, user_id, auteur, collection, element_id, action, avant, apres)
        values (p_entreprise, auth.uid(), v_auteur, 'entreprise', v_cle, 'modification', v_avant, v_apres);

    elsif v_type = 'signature' then
      v_apres := v_op -> 'valeur';
      if v_id is null or jsonb_typeof(v_apres) <> 'object' then
        raise exception 'operation_invalide' using errcode = '22023';
      end if;
      continue when (v_contenu -> 'signatures') ? v_id;
      v_contenu := jsonb_set(v_contenu, '{signatures}', coalesce(v_contenu -> 'signatures', '{}'::jsonb) || jsonb_build_object(v_id, v_apres));
      -- L'image de la signature n'est pas recopiée dans le journal.
      insert into public.journal (entreprise_id, user_id, auteur, collection, element_id, action, avant, apres)
        values (p_entreprise, auth.uid(), v_auteur, 'signatures', v_id, 'ajout', null, v_apres - 'image');

    else
      raise exception 'operation_invalide' using errcode = '22023';
    end if;
  end loop;

  v_date := clock_timestamp();
  update public.espaces
    set contenu = v_contenu, updated_client = p_client
    where entreprise_id = p_entreprise;
  return v_date;
end;
$$;

revoke all on function public.appliquer_operations(uuid, jsonb, text) from public, anon;
grant execute on function public.appliquer_operations(uuid, jsonb, text) to authenticated;

-- ---------------------------------------------------------------
-- Registre des accidents (migration 005)

create or replace function public.frisk_version()
returns integer
language sql
immutable
set search_path = ''
as $$ select 5; $$;
grant execute on function public.frisk_version() to authenticated, anon;

-- Nouvelle liste « evenements », modifiable par le responsable (le contributeur reste limité
-- aux mouvements d'EPI et aux signatures, voir appliquer_operations).
create or replace function public.collections_frisk()
returns text[]
language sql
immutable
set search_path = ''
as $$ select array['duerp', 'actions', 'evenements', 'salaries', 'articles', 'mouvements']; $$;

-- ---------------------------------------------------------------
-- Formations et habilitations (migration 006)

create or replace function public.frisk_version()
returns integer
language sql
immutable
set search_path = ''
as $$ select 6; $$;
grant execute on function public.frisk_version() to authenticated, anon;

-- Nouvelles listes « formations » et « exigences » (formations exigées par poste),
-- modifiables par le responsable.
create or replace function public.collections_frisk()
returns text[]
language sql
immutable
set search_path = ''
as $$ select array['duerp', 'actions', 'evenements', 'formations', 'exigences', 'salaries', 'articles', 'mouvements']; $$;

-- Attestations (PDF ou photo, 5 Mo au plus), rangées par entreprise : <entreprise>/<formation>/<fichier>.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('attestations', 'attestations', false, 5242880, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Entreprise propriétaire d'un fichier, d'après le premier dossier de son chemin (null si invalide).
create or replace function public.entreprise_du_fichier(chemin text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return split_part(chemin, '/', 1)::uuid;
exception when others then
  return null;
end;
$$;
grant execute on function public.entreprise_du_fichier(text) to authenticated;

-- Tous les membres de l'entreprise consultent les attestations ; responsable et Frisk les gèrent.
drop policy if exists "attestations_lecture" on storage.objects;
create policy "attestations_lecture" on storage.objects for select to authenticated
  using (bucket_id = 'attestations' and public.role_dans(public.entreprise_du_fichier(name)) is not null);

drop policy if exists "attestations_ajout" on storage.objects;
create policy "attestations_ajout" on storage.objects for insert to authenticated
  with check (bucket_id = 'attestations' and public.role_dans(public.entreprise_du_fichier(name)) in ('admin', 'responsable'));

drop policy if exists "attestations_suppression" on storage.objects;
create policy "attestations_suppression" on storage.objects for delete to authenticated
  using (bucket_id = 'attestations' and public.role_dans(public.entreprise_du_fichier(name)) in ('admin', 'responsable'));

-- ---------------------------------------------------------------
-- Vérifications périodiques (migration 007)

create or replace function public.frisk_version()
returns integer
language sql
immutable
set search_path = ''
as $$ select 7; $$;
grant execute on function public.frisk_version() to authenticated, anon;

-- Nouvelles listes « equipements » et « verifications », modifiables par le responsable.
create or replace function public.collections_frisk()
returns text[]
language sql
immutable
set search_path = ''
as $$ select array['duerp', 'actions', 'evenements', 'formations', 'exigences', 'equipements', 'verifications', 'salaries', 'articles', 'mouvements']; $$;

-- ---------------------------------------------------------------
-- Produits chimiques (migration 008)

create or replace function public.frisk_version()
returns integer
language sql
immutable
set search_path = ''
as $$ select 8; $$;
grant execute on function public.frisk_version() to authenticated, anon;

-- Nouvelle liste « produits », modifiable par le responsable.
create or replace function public.collections_frisk()
returns text[]
language sql
immutable
set search_path = ''
as $$ select array['duerp', 'actions', 'evenements', 'formations', 'exigences', 'equipements', 'verifications', 'produits', 'salaries', 'articles', 'mouvements']; $$;

-- ---------------------------------------------------------------
-- Multi-établissements (migration 009)

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

-- ---------------------------------------------------------------
-- Double authentification exigée par la base (migration 010)

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

-- ---------- Migration 011 : entreprises extérieures ----------

create or replace function public.frisk_version()
returns integer
language sql
immutable
set search_path = ''
as $$ select 11; $$;
grant execute on function public.frisk_version() to authenticated, anon;

-- Nouvelle liste « interventions », modifiable par le responsable.
create or replace function public.collections_frisk()
returns text[]
language sql
immutable
set search_path = ''
as $$ select array['duerp', 'actions', 'evenements', 'formations', 'exigences', 'equipements', 'verifications', 'produits', 'interventions', 'salaries', 'articles', 'mouvements']; $$;
