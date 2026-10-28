-- Frisk DU : rôles des utilisateurs, journal des modifications et travail à plusieurs.
-- À exécuter une fois dans Supabase : SQL Editor > New query > coller ce fichier > Run.
-- Le script peut être relancé sans risque.

-- ---------------------------------------------------------------------------
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
