-- Tests des produits chimiques (migration 008) : droits et journal.
-- À lancer après 01_roles_journal.test.sql (réutilise ses comptes et entreprises).

\set ON_ERROR_STOP 1
set client_min_messages = warning;
reset role;

-- Les tests précédents relancent des migrations antérieures : on réapplique la 008.
\ir ../migrations/008_produits.sql

do $$ begin assert public.frisk_version() >= 8, 'version de la base'; end $$;

-- Le responsable enregistre un produit puis ses mentions de danger.
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","email":"responsable@e1.fr"}', false);
select public.appliquer_operations('10000000-0000-0000-0000-000000000001',
  '[{"type":"ajout","collection":"produits","id":"p1","apres":null,"valeur":{"id":"p1","nom":"Solvant","mentionsH":[],"actif":true}},
    {"type":"modification","collection":"produits","id":"p1","champs":{"mentionsH":["H225","H350"]}}]');
do $$ begin
  assert (select contenu -> 'produits' -> 0 -> 'mentionsH' from public.espaces where entreprise_id = '10000000-0000-0000-0000-000000000001') = '["H225","H350"]', 'mentions enregistrées';
  assert (select count(*) from public.journal where collection = 'produits') = 2, 'produits journalisés';
end $$;

-- Le contributeur ne modifie pas l'inventaire.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","email":"contributeur@e1.fr"}', false);
do $$ begin
  begin
    perform public.appliquer_operations('10000000-0000-0000-0000-000000000001',
      '[{"type":"suppression","collection":"produits","id":"p1"}]');
    raise exception 'le contributeur a modifié l''inventaire des produits';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;
select 'Tests des produits chimiques passés.' as resultat;
