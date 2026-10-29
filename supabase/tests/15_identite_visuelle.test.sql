-- Tests de l'identité visuelle (migration 016) : droits, contrôle du contenu et journal.
-- À lancer après 01_roles_journal.test.sql (réutilise ses comptes et entreprises).

\set ON_ERROR_STOP 1
set client_min_messages = warning;
reset role;

-- Les tests précédents relancent des migrations antérieures : on réapplique la 016.
\ir ../migrations/016_identite_visuelle.sql

do $$ begin assert public.frisk_version() >= 16, 'version de la base'; end $$;

-- Le responsable enregistre son logo et sa couleur.
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","email":"responsable@e1.fr"}', false);
select public.appliquer_operations('10000000-0000-0000-0000-000000000001',
  '[{"type":"racine","cle":"identite","valeur":{"logo":"data:image/png;base64,iVBORw0KGgo=","couleur":"#1f5fa8","site":"https://exemple.fr/"}}]');
do $$ begin
  assert (select contenu -> 'identite' ->> 'couleur' from public.espaces where entreprise_id = '10000000-0000-0000-0000-000000000001') = '#1f5fa8', 'couleur enregistrée';
  assert (select apres from public.journal where element_id = 'identite' order by id desc limit 1) = '{"logo":true,"couleur":"#1f5fa8","site":"https://exemple.fr/"}'::jsonb, 'logo absent du journal';
end $$;

-- Un contenu inattendu est refusé : image d'un autre format, couleur mal écrite, champ inconnu.
do $$
declare v text;
begin
  foreach v in array array[
    '{"logo":"data:image/svg+xml;base64,PHN2Zz4="}',
    '{"logo":"javascript:alert(1)"}',
    '{"couleur":"red"}',
    '{"autre":1}',
    '"texte"'
  ] loop
    begin
      perform public.appliquer_operations('10000000-0000-0000-0000-000000000001',
        jsonb_build_array(jsonb_build_object('type', 'racine', 'cle', 'identite', 'valeur', v::jsonb)));
      raise exception 'identité acceptée : %', v;
    exception when invalid_parameter_value then null;
    end;
  end loop;
end $$;

-- Retour à l'identité Frisk.
select public.appliquer_operations('10000000-0000-0000-0000-000000000001', '[{"type":"racine","cle":"identite","valeur":null}]');
do $$ begin
  assert (select jsonb_typeof(contenu -> 'identite') from public.espaces where entreprise_id = '10000000-0000-0000-0000-000000000001') = 'null', 'identité retirée';
end $$;

-- Le contributeur ne modifie pas l'identité visuelle.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","email":"contributeur@e1.fr"}', false);
do $$ begin
  begin
    perform public.appliquer_operations('10000000-0000-0000-0000-000000000001',
      '[{"type":"racine","cle":"identite","valeur":{"couleur":"#000000"}}]');
    raise exception 'le contributeur a modifié l''identité';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;
select 'Tests de l''identité visuelle passés.' as resultat;
