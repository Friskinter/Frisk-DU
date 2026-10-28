-- Tests des formations (migration 006) : droits sur les listes et sur les attestations.
-- À lancer après 01_roles_journal.test.sql (réutilise ses comptes et entreprises).

\set ON_ERROR_STOP 1
set client_min_messages = warning;
reset role;

-- Les tests précédents relancent des migrations antérieures : on réapplique la 006.
\ir ../migrations/006_formations.sql
delete from storage.objects where bucket_id = 'attestations';

do $$ begin
  assert public.frisk_version() = 6, 'version de la base';
  assert (select not public from storage.buckets where id = 'attestations'), 'attestations privées';
  assert public.entreprise_du_fichier('pas-un-uuid/x.pdf') is null, 'chemin invalide';
end $$;

-- Le responsable enregistre une formation et une exigence.
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","email":"responsable@e1.fr"}', false);
select public.appliquer_operations('10000000-0000-0000-0000-000000000001',
  '[{"type":"ajout","collection":"formations","id":"f1","apres":null,"valeur":{"id":"f1","salarieId":"s1","type":"sst","obtenueLe":"2026-01-10","expireLe":"2028-01-10"}},
    {"type":"ajout","collection":"exigences","id":"x1","apres":null,"valeur":{"id":"x1","poste":"Cariste","type":"caces-r489"}}]');
do $$ begin
  assert (select jsonb_array_length(contenu -> 'formations') from public.espaces where entreprise_id = '10000000-0000-0000-0000-000000000001') = 1, 'formation enregistrée';
  assert (select count(*) from public.journal where collection in ('formations', 'exigences')) = 2, 'formations journalisées';
end $$;

-- Attestations : le responsable dépose dans son entreprise, pas dans une autre.
insert into storage.objects (bucket_id, name) values ('attestations', '10000000-0000-0000-0000-000000000001/f1/sst.pdf');
do $$ begin
  begin
    insert into storage.objects (bucket_id, name) values ('attestations', '10000000-0000-0000-0000-000000000002/f1/sst.pdf');
    raise exception 'dépôt dans une autre entreprise accepté';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Le lecteur consulte mais ne dépose ni ne supprime.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c","email":"lecteur@e1.fr"}', false);
do $$ begin
  assert (select count(*) from storage.objects where bucket_id = 'attestations') = 1, 'le lecteur voit l''attestation';
  begin
    insert into storage.objects (bucket_id, name) values ('attestations', '10000000-0000-0000-0000-000000000001/f2/x.pdf');
    raise exception 'le lecteur a déposé une attestation';
  exception when insufficient_privilege then null;
  end;
  delete from storage.objects where bucket_id = 'attestations';
  assert (select count(*) from storage.objects where bucket_id = 'attestations') = 1, 'le lecteur n''a rien supprimé';
end $$;

-- Un membre d'une autre entreprise ne voit pas l'attestation.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000d","email":"responsable@e2.fr"}', false);
do $$ begin
  assert (select count(*) from storage.objects where bucket_id = 'attestations') = 0, 'attestation invisible pour une autre entreprise';
end $$;

-- Le contributeur ne modifie pas les formations.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","email":"contributeur@e1.fr"}', false);
do $$ begin
  begin
    perform public.appliquer_operations('10000000-0000-0000-0000-000000000001',
      '[{"type":"suppression","collection":"formations","id":"f1"}]');
    raise exception 'le contributeur a modifié les formations';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;
select 'Tests des formations passés.' as resultat;
