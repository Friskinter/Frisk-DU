-- Frisk DU : abonnements (essai gratuit de 7 jours, paiement en ligne) et suivi des erreurs.
-- À exécuter une fois dans Supabase : SQL Editor > New query > coller ce fichier > Run.
-- Le script peut être relancé sans risque.

create or replace function public.frisk_version()
returns integer
language sql
immutable
set search_path = ''
as $$ select 17; $$;
grant execute on function public.frisk_version() to authenticated, anon;

-- Abonnement de chaque entreprise. Les entreprises déjà créées par Frisk restent actives.
--   essai   : essai gratuit jusqu'à essai_fin (document unique, plan d'actions, salariés)
--   actif   : abonnement payé (ou accordé par Frisk depuis la console)
--   impaye  : paiement refusé, Stripe relance le client ; l'accès est maintenu en attendant
--   termine : essai expiré sans abonnement, ou abonnement résilié : lecture seule
alter table public.entreprises add column if not exists abonnement text not null default 'actif';
alter table public.entreprises drop constraint if exists entreprises_abonnement_valide;
alter table public.entreprises add constraint entreprises_abonnement_valide check (abonnement in ('essai', 'actif', 'impaye', 'termine'));
alter table public.entreprises add column if not exists essai_fin timestamptz;
alter table public.entreprises add column if not exists offre text; -- tranche d'effectif (lib/abonnement.ts)
alter table public.entreprises add column if not exists periodicite text; -- mois ou an
alter table public.entreprises add column if not exists abonnement_fin timestamptz; -- fin de la période payée
alter table public.entreprises add column if not exists stripe_client text;
alter table public.entreprises add column if not exists stripe_abonnement text;
alter table public.entreprises add column if not exists inscription_libre boolean not null default false;
create unique index if not exists entreprises_stripe_client on public.entreprises (stripe_client) where stripe_client is not null;

-- Ce que l'abonnement permet : complet, essai (fonctions de base) ou lecture (consultation seule).
create or replace function public.acces_entreprise(e uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when public.est_admin() then 'complet'
    when en.abonnement in ('actif', 'impaye') then 'complet'
    when en.abonnement = 'essai' and en.essai_fin > now() then 'essai'
    else 'lecture'
  end
  from public.entreprises en where en.id = e;
$$;
grant execute on function public.acces_entreprise(uuid) to authenticated, service_role;

-- Listes modifiables pendant l'essai gratuit.
create or replace function public.collections_essai()
returns text[]
language sql
immutable
set search_path = ''
as $$ select array['duerp', 'actions', 'salaries']; $$;

-- Inscription libre : le nouvel utilisateur crée son entreprise, en essai gratuit pour 7 jours.
-- Un compte déjà rattaché à une entreprise ne peut pas en créer une autre.
create or replace function public.creer_mon_espace(p_nom text, p_effectif text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_email text := coalesce(auth.jwt() ->> 'email', '');
  v_nom text := left(trim(coalesce(p_nom, '')), 120);
  v_entreprise uuid;
begin
  if v_user is null or v_email = '' then
    raise exception 'acces_refuse' using errcode = '42501';
  end if;
  if v_nom = '' then
    raise exception 'operation_invalide' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtext(v_user::text));
  if exists (select 1 from public.membres where user_id = v_user) then
    raise exception 'deja_inscrit' using errcode = '23505';
  end if;
  insert into public.entreprises (nom, abonnement, essai_fin, inscription_libre)
    values (v_nom, 'essai', now() + interval '7 days', true)
    returning id into v_entreprise;
  insert into public.membres (user_id, entreprise_id, email, role) values (v_user, v_entreprise, v_email, 'responsable');
  insert into public.espaces (entreprise_id, contenu) values (v_entreprise, jsonb_build_object(
    'version', 1, 'entreprise', v_nom,
    'fiche', jsonb_build_object('siret', '', 'adresse', '', 'activite', '', 'effectif', left(coalesce(p_effectif, ''), 40), 'responsable', ''),
    'services', '[]'::jsonb, 'unites', '[]'::jsonb, 'duerp', '[]'::jsonb, 'actions', '[]'::jsonb,
    'salaries', '[]'::jsonb, 'articles', '[]'::jsonb, 'mouvements', '[]'::jsonb
  ));
  insert into public.journal (entreprise_id, user_id, auteur, collection, element_id, action, avant, apres)
    values (v_entreprise, v_user, v_email, 'entreprise', 'inscription', 'ajout', null, to_jsonb('Inscription et essai gratuit de 7 jours'::text));
  return v_entreprise;
end;
$$;
revoke all on function public.creer_mon_espace(text, text) from public, anon;
grant execute on function public.creer_mon_espace(text, text) to authenticated;

-- Seuls les abonnés figent une version officielle du document unique.
drop policy if exists "versions_creation" on public.versions;
create policy "versions_creation" on public.versions for insert to authenticated
  with check (public.role_dans(entreprise_id) in ('admin', 'responsable') and public.acces_entreprise(entreprise_id) = 'complet');

-- Attestations de formation : module réservé aux abonnés.
drop policy if exists "attestations_ajout" on storage.objects;
create policy "attestations_ajout" on storage.objects for insert to authenticated
  with check (bucket_id = 'attestations' and public.role_dans(public.entreprise_du_fichier(name)) in ('admin', 'responsable')
              and public.acces_entreprise(public.entreprise_du_fichier(name)) = 'complet');

-- Signalement par QR code : réservé aux abonnés.
create or replace function public.changer_lien_signalement(p_entreprise uuid, p_actif boolean)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_jeton text;
begin
  if coalesce(public.role_dans(p_entreprise), '') not in ('admin', 'responsable') then
    raise exception 'acces_refuse' using errcode = '42501';
  end if;
  if p_actif and public.acces_entreprise(p_entreprise) <> 'complet' then
    raise exception 'abonnement_requis' using errcode = '42501';
  end if;
  if p_actif then
    v_jeton := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  end if;
  update public.entreprises set jeton_signalement = v_jeton where id = p_entreprise;
  insert into public.journal (entreprise_id, user_id, auteur, collection, element_id, action, avant, apres)
    values (p_entreprise, auth.uid(), coalesce(auth.jwt() ->> 'email', ''), 'entreprise', 'lien_signalement', 'modification', null,
            to_jsonb(case when p_actif then 'Lien activé ou renouvelé' else 'Lien désactivé' end));
  return v_jeton;
end;
$$;
revoke all on function public.changer_lien_signalement(uuid, boolean) from public, anon;
grant execute on function public.changer_lien_signalement(uuid, boolean) to authenticated;

create or replace function public.signaler_evenement(p_jeton text, p_evenement jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entreprise uuid;
  v_id text := p_evenement ->> 'id';
begin
  select id into v_entreprise from public.entreprises
    where p_jeton is not null and length(p_jeton) >= 32 and jeton_signalement = p_jeton and actif
      and public.acces_entreprise(id) = 'complet';
  if v_entreprise is null then
    raise exception 'lien_invalide' using errcode = '42501';
  end if;
  if jsonb_typeof(p_evenement) is distinct from 'object' or v_id is null or length(v_id) > 64
     or coalesce(p_evenement ->> 'type', '') not in ('accident-travail', 'accident-trajet', 'presque-accident', 'situation-dangereuse') then
    raise exception 'operation_invalide' using errcode = '22023';
  end if;
  -- Garde-fou contre les envois en masse : 30 signalements par heure et par entreprise.
  if (select count(*) from public.journal
        where entreprise_id = v_entreprise and auteur = 'Signalement terrain' and created_at > now() - interval '1 hour') >= 30 then
    raise exception 'trop_de_signalements' using errcode = '54000';
  end if;
  -- Un même envoi répété (réseau instable) n'est enregistré qu'une fois.
  if exists (select 1 from public.espaces e, jsonb_array_elements(coalesce(e.contenu -> 'evenements', '[]'::jsonb)) x
             where e.entreprise_id = v_entreprise and x ->> 'id' = v_id) then
    return v_entreprise;
  end if;
  update public.espaces
    set contenu = jsonb_set(contenu, '{evenements}', jsonb_build_array(p_evenement) || coalesce(contenu -> 'evenements', '[]'::jsonb)),
        updated_client = null
    where entreprise_id = v_entreprise;
  if not found then
    raise exception 'espace_absent' using errcode = '22023';
  end if;
  insert into public.journal (entreprise_id, user_id, auteur, collection, element_id, action, avant, apres)
    values (v_entreprise, null, 'Signalement terrain', 'evenements', v_id, 'ajout', null, p_evenement);
  return v_entreprise;
end;
$$;
revoke all on function public.signaler_evenement(text, jsonb) from public, anon, authenticated;
grant execute on function public.signaler_evenement(text, jsonb) to service_role;

-- Erreurs rencontrées dans Frisk DU (navigateur et serveur), consultables par Frisk dans la console.
-- Écrites par le serveur (clé secrète) ; conservées 90 jours.
create table if not exists public.erreurs (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  origine text not null check (origine in ('navigateur', 'serveur')),
  message text not null,
  detail text not null default '',
  page text not null default '',
  user_id uuid,
  entreprise_id uuid,
  navigateur text not null default ''
);
create index if not exists erreurs_date on public.erreurs (created_at desc);
alter table public.erreurs enable row level security;
drop policy if exists "erreurs_lecture" on public.erreurs;
create policy "erreurs_lecture" on public.erreurs for select to authenticated using (public.est_admin());
revoke all on public.erreurs from anon;

-- Enregistrement : même fonction qu'en migration 016, avec la lecture seule hors abonnement et les
-- limites de l'essai gratuit.
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
  v_acces text;
begin
  if v_role is null or v_role = 'lecteur' then
    raise exception 'acces_refuse' using errcode = '42501';
  end if;
  -- Essai terminé ou abonnement arrêté : l'espace reste consultable, plus modifiable.
  v_acces := public.acces_entreprise(p_entreprise);
  if v_acces = 'lecture' then
    raise exception 'abonnement_requis' using errcode = '42501';
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

    -- Essai gratuit : document unique, plan d'actions, salariés et informations générales seulement.
    if v_acces = 'essai' and not (
      (v_type in ('ajout', 'modification', 'suppression') and v_collection = any (public.collections_essai()))
      or (v_type = 'racine' and v_id <> 'identite')
    ) then
      raise exception 'abonnement_requis' using errcode = '42501';
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
      if not (v_cle = any (public.cles_racine_frisk())) then
        raise exception 'operation_invalide' using errcode = '22023';
      end if;
      v_avant := v_contenu -> v_cle;
      v_apres := v_op -> 'valeur';
      if v_cle = 'identite' and not public.identite_valide(v_apres) then
        raise exception 'operation_invalide' using errcode = '22023';
      end if;
      continue when v_avant is not distinct from v_apres;
      v_contenu := jsonb_set(v_contenu, array[v_cle], v_apres);
      -- L'image du logo n'est pas recopiée dans le journal : on note seulement sa présence.
      if v_cle = 'identite' then
        v_avant := case when jsonb_typeof(v_avant) = 'object' then (v_avant - 'logo') || jsonb_build_object('logo', v_avant ? 'logo') end;
        v_apres := case when jsonb_typeof(v_apres) = 'object' then (v_apres - 'logo') || jsonb_build_object('logo', v_apres ? 'logo') end;
      end if;
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
