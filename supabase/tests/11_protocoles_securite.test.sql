-- Tests des protocoles de sécurité (migration 012) : droits, signatures et journal.
-- À lancer après 01_roles_journal.test.sql (réutilise ses comptes et entreprises).

\set ON_ERROR_STOP 1
set client_min_messages = warning;
reset role;

-- Les tests précédents relancent des migrations antérieures : on réapplique la 012.
\ir ../migrations/012_protocoles_securite.sql

do $$ begin assert public.frisk_version() >= 12, 'version de la base'; end $$;

-- Le responsable prépare le protocole puis le fait signer.
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","email":"responsable@e1.fr"}', false);
select public.appliquer_operations('10000000-0000-0000-0000-000000000001',
  '[{"type":"ajout","collection":"protocoles","id":"p1","apres":null,"valeur":{"id":"p1","transporteur":"Rhône Express","permanent":true}},
    {"type":"signature","id":"sig-t","valeur":{"image":"data:image/png;base64,AAAA","date":"2026-10-29","salarieId":"","nom":"K. B."}},
    {"type":"modification","collection":"protocoles","id":"p1","champs":{"signatureTransporteur":"sig-t"}}]');
do $$ begin
  assert (select contenu -> 'protocoles' -> 0 ->> 'signatureTransporteur' from public.espaces where entreprise_id = '10000000-0000-0000-0000-000000000001') = 'sig-t', 'protocole signé';
  assert (select contenu -> 'signatures' -> 'sig-t' ->> 'nom' from public.espaces where entreprise_id = '10000000-0000-0000-0000-000000000001') = 'K. B.', 'signataire enregistré';
  assert (select count(*) from public.journal where collection = 'protocoles') = 2, 'protocoles journalisés';
end $$;

-- Le contributeur ne modifie pas les protocoles.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","email":"contributeur@e1.fr"}', false);
do $$ begin
  begin
    perform public.appliquer_operations('10000000-0000-0000-0000-000000000001',
      '[{"type":"suppression","collection":"protocoles","id":"p1"}]');
    raise exception 'le contributeur a supprimé un protocole de sécurité';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;
select 'Tests des protocoles de sécurité passés.' as resultat;
