-- Frisk DU : signalement des accidents et presque-accidents par les salariés, depuis leur téléphone.
-- Chaque entreprise peut ouvrir un lien de signalement (affiché en QR code), utilisable sans compte.
-- Les signalements sont reçus par le serveur de Frisk DU, qui seul peut les enregistrer.
-- À exécuter une fois dans Supabase : SQL Editor > New query > coller ce fichier > Run.
-- Le script peut être relancé sans risque.

create or replace function public.frisk_version()
returns integer
language sql
immutable
set search_path = ''
as $$ select 13; $$;
grant execute on function public.frisk_version() to authenticated, anon;

-- Jeton secret du lien de signalement (null : lien désactivé).
alter table public.entreprises add column if not exists jeton_signalement text;
create unique index if not exists entreprises_jeton_signalement on public.entreprises (jeton_signalement) where jeton_signalement is not null;

-- Le responsable active, change (l'ancien lien cesse de fonctionner) ou désactive le lien.
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

-- Enregistre un signalement reçu par le serveur (clé secrète uniquement) dans le registre des accidents.
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
    where p_jeton is not null and length(p_jeton) >= 32 and jeton_signalement = p_jeton and actif;
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
