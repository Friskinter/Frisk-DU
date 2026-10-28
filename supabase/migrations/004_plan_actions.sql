-- Frisk DU : plan d'actions (plusieurs actions par risque).
-- À exécuter une fois dans Supabase : SQL Editor > New query > coller ce fichier > Run.
-- Le script peut être relancé sans risque.

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
