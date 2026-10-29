-- Tests du signalement terrain (migration 013) : lien de signalement et enregistrement par le serveur.
-- À lancer après 01_roles_journal.test.sql (réutilise ses comptes et entreprises).

\set ON_ERROR_STOP 1
set client_min_messages = warning;
reset role;

-- Les tests précédents relancent des migrations antérieures : on réapplique la 013.
\ir ../migrations/013_signalement_terrain.sql

do $$ begin assert public.frisk_version() >= 13, 'version de la base'; end $$;

-- Le lecteur ne peut pas ouvrir le lien.
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c","email":"lecteur@e1.fr"}', false);
do $$ begin
  begin
    perform public.changer_lien_signalement('10000000-0000-0000-0000-000000000001', true);
    raise exception 'le lecteur a ouvert le lien de signalement';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Un responsable ne peut pas ouvrir le lien d'une autre entreprise.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000d","email":"responsable@e2.fr"}', false);
do $$ begin
  begin
    perform public.changer_lien_signalement('10000000-0000-0000-0000-000000000001', true);
    raise exception 'un responsable a ouvert le lien d''une autre entreprise';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Le responsable ouvre le lien.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","email":"responsable@e1.fr"}', false);
select public.changer_lien_signalement('10000000-0000-0000-0000-000000000001', true) as jeton \gset
select set_config('frisk.jeton', :'jeton', false);
do $$ begin
  assert length(current_setting('frisk.jeton')) = 64, 'jeton de 64 caractères';
end $$;

-- Un utilisateur connecté ne peut pas écrire directement par cette fonction : seul le serveur le peut.
do $$ begin
  begin
    perform public.signaler_evenement('x', '{}'::jsonb);
    raise exception 'un utilisateur a appelé signaler_evenement';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;
set role service_role;
select set_config('request.jwt.claims', '', false);

-- Mauvais jeton : refusé.
do $$ begin
  begin
    perform public.signaler_evenement(repeat('a', 64), '{"id":"s1","type":"presque-accident"}');
    raise exception 'un faux lien a été accepté';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Type inconnu : refusé.
do $$ begin
  begin
    perform public.signaler_evenement(current_setting('frisk.jeton'), '{"id":"s0","type":"autre"}');
    raise exception 'un type inconnu a été accepté';
  exception when invalid_parameter_value then null;
  end;
end $$;

-- Signalement accepté, puis renvoyé une deuxième fois (réseau instable) : une seule fois au registre.
select public.signaler_evenement(:'jeton', '{"id":"s1","type":"presque-accident","description":"Palette instable","photos":[{"chemin":"10000000-0000-0000-0000-000000000001/s1/photo.jpg","nom":"photo.jpg"}]}');
select public.signaler_evenement(:'jeton', '{"id":"s1","type":"presque-accident","description":"Palette instable"}');
reset role;
do $$ begin
  assert (select contenu -> 'evenements' -> 0 ->> 'description' from public.espaces where entreprise_id = '10000000-0000-0000-0000-000000000001') = 'Palette instable', 'signalement enregistré';
  assert (select count(*) from public.espaces e, jsonb_array_elements(e.contenu -> 'evenements') x
          where e.entreprise_id = '10000000-0000-0000-0000-000000000001' and x ->> 'id' = 's1') = 1, 'pas de doublon';
  assert (select count(*) from public.journal where auteur = 'Signalement terrain' and element_id = 's1') = 1, 'signalement journalisé';
  assert (select updated_client from public.espaces where entreprise_id = '10000000-0000-0000-0000-000000000001') is null, 'tous les onglets relisent';
end $$;

-- Lien désactivé : l'ancien lien ne fonctionne plus.
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","email":"responsable@e1.fr"}', false);
select public.changer_lien_signalement('10000000-0000-0000-0000-000000000001', false);
reset role;
set role service_role;
do $$ begin
  begin
    perform public.signaler_evenement(current_setting('frisk.jeton'), '{"id":"s2","type":"presque-accident"}');
    raise exception 'un lien désactivé a été accepté';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;
select 'Tests du signalement terrain passés.' as resultat;
