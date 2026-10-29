-- Tests des plans de prévention (migration 011) : droits, signatures et journal.
-- À lancer après 01_roles_journal.test.sql (réutilise ses comptes et entreprises).

\set ON_ERROR_STOP 1
set client_min_messages = warning;
reset role;

-- Les tests précédents relancent des migrations antérieures : on réapplique la 011.
\ir ../migrations/011_entreprises_exterieures.sql

do $$ begin assert public.frisk_version() >= 11, 'version de la base'; end $$;

-- Le responsable prépare le plan puis le fait signer.
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","email":"responsable@e1.fr"}', false);
select public.appliquer_operations('10000000-0000-0000-0000-000000000001',
  '[{"type":"ajout","collection":"interventions","id":"i1","apres":null,"valeur":{"id":"i1","entreprise":"Net Indus","risques":[],"travauxDangereux":["hauteur"]}},
    {"type":"signature","id":"sig-ee","valeur":{"image":"data:image/png;base64,AAAA","date":"2026-10-29","salarieId":"","nom":"K. B."}},
    {"type":"modification","collection":"interventions","id":"i1","champs":{"signatureEe":"sig-ee"}}]');
do $$ begin
  assert (select contenu -> 'interventions' -> 0 ->> 'signatureEe' from public.espaces where entreprise_id = '10000000-0000-0000-0000-000000000001') = 'sig-ee', 'plan signé';
  assert (select contenu -> 'signatures' -> 'sig-ee' ->> 'nom' from public.espaces where entreprise_id = '10000000-0000-0000-0000-000000000001') = 'K. B.', 'signataire enregistré';
  assert (select count(*) from public.journal where collection = 'interventions') = 2, 'interventions journalisées';
end $$;

-- Le contributeur ne modifie pas les plans de prévention.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","email":"contributeur@e1.fr"}', false);
do $$ begin
  begin
    perform public.appliquer_operations('10000000-0000-0000-0000-000000000001',
      '[{"type":"suppression","collection":"interventions","id":"i1"}]');
    raise exception 'le contributeur a supprimé un plan de prévention';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;
select 'Tests des entreprises extérieures passés.' as resultat;
