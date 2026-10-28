-- Frisk DU : formations et habilitations des salariés, avec leurs attestations.
-- À exécuter une fois dans Supabase : SQL Editor > New query > coller ce fichier > Run.
-- Le script peut être relancé sans risque.

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
