-- Suppression définitive d'un client (console Frisk, clé serveur) : les versions figées bloquent la
-- suppression directe ; une fois effacées, tout le reste suit en cascade.

\set ON_ERROR_STOP 1
set client_min_messages = warning;
reset role;

delete from public.entreprises where id = '10000000-0000-0000-0000-000000000009';
insert into public.entreprises (id, nom) values ('10000000-0000-0000-0000-000000000009', 'Client à supprimer');
insert into public.membres (user_id, entreprise_id, email, role)
  values ('00000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-000000000009', 'responsable@e1.fr', 'responsable');
insert into public.espaces (entreprise_id, contenu) values ('10000000-0000-0000-0000-000000000009', '{"version":1}');
insert into public.versions (entreprise_id, motif, contenu, auteur) values ('10000000-0000-0000-0000-000000000009', 'Première version', '{}', 'a');
insert into public.journal (entreprise_id, collection, element_id, action) values ('10000000-0000-0000-0000-000000000009', 'duerp', 'x', 'ajout');

-- Les versions figées empêchent une suppression par mégarde.
do $$ begin
  begin
    delete from public.entreprises where id = '10000000-0000-0000-0000-000000000009';
    raise exception 'entreprise supprimée malgré ses versions figées';
  exception when foreign_key_violation then null;
  end;
end $$;

-- Ordre suivi par la console : versions, puis entreprise.
delete from public.versions where entreprise_id = '10000000-0000-0000-0000-000000000009';
delete from public.entreprises where id = '10000000-0000-0000-0000-000000000009';
do $$ begin
  assert not exists (select 1 from public.espaces where entreprise_id = '10000000-0000-0000-0000-000000000009'), 'données supprimées';
  assert not exists (select 1 from public.membres where entreprise_id = '10000000-0000-0000-0000-000000000009'), 'accès supprimés';
  assert not exists (select 1 from public.journal where entreprise_id = '10000000-0000-0000-0000-000000000009'), 'journal supprimé';
  assert exists (select 1 from public.membres where user_id = '00000000-0000-0000-0000-00000000000a'), 'l''utilisateur garde ses autres accès';
end $$;

-- Les utilisateurs ne peuvent pas supprimer de versions, même les leurs.
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","email":"responsable@e1.fr","aal":"aal2"}', false);
do $$ begin
  begin
    delete from public.versions;
    raise exception 'un utilisateur a supprimé des versions';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;
select 'Tests de la suppression d''un client passés.' as resultat;
