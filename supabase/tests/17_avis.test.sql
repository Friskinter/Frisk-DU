-- Tests des avis clients (migration 018) : dépôt, relecture, publication et confidentialité.
-- À lancer après 01_roles_journal.test.sql (réutilise ses comptes et entreprises).

\set ON_ERROR_STOP 1
set client_min_messages = warning;
reset role;

\ir ../migrations/018_avis.sql
truncate public.avis;

do $$ begin assert public.frisk_version() >= 18, 'version de la base'; end $$;

-- Le lecteur de l'entreprise 1 dépose un avis : il part en relecture.
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c","email":"lecteur@e1.fr"}', false);
select public.deposer_avis('10000000-0000-0000-0000-000000000001', 5,
  '  Très simple à prendre en main, notre DUERP est enfin à jour.  ', 'Marie D.', 'Gérante', 'Entreprise 1');
do $$ begin
  assert (select statut from public.avis) = 'en_attente', 'avis en relecture';
  assert (select texte from public.avis) = 'Très simple à prendre en main, notre DUERP est enfin à jour.', 'espaces retirés';
end $$;

-- Pas encore visible sur le site vitrine.
set role anon;
select set_config('request.jwt.claims', '{}', false);
do $$ begin assert (select count(*) from public.avis_publies()) = 0, 'avis non relu invisible'; end $$;

-- Un visiteur ne lit pas la table ni ne dépose d'avis.
do $$ begin
  begin
    perform count(*) from public.avis;
    raise exception 'la table des avis est lisible sans compte';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.deposer_avis('10000000-0000-0000-0000-000000000001', 5, 'Avis déposé sans être connecté.', 'Robot', '', '');
    raise exception 'avis déposé sans compte';
  exception when insufficient_privilege then null;
  end;
end $$;

-- On ne dépose pas d'avis pour une entreprise dont on n'est pas membre.
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000d","email":"responsable@e2.fr"}', false);
do $$ begin
  begin
    perform public.deposer_avis('10000000-0000-0000-0000-000000000001', 1, 'Avis au nom d''une autre entreprise.', 'Intrus', '', '');
    raise exception 'avis déposé pour une autre entreprise';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Un avis trop court ou mal noté est refusé.
do $$ begin
  begin
    perform public.deposer_avis('10000000-0000-0000-0000-000000000002', 6, 'Note impossible à six étoiles.', 'Paul', '', '');
    raise exception 'note hors limites acceptée';
  exception when check_violation then null;
  end;
  begin
    perform public.deposer_avis('10000000-0000-0000-0000-000000000002', 4, 'Trop court', 'Paul', '', '');
    raise exception 'avis trop court accepté';
  exception when check_violation then null;
  end;
end $$;

-- Chacun ne voit que son propre avis, et ne le publie pas lui-même.
select public.deposer_avis('10000000-0000-0000-0000-000000000002', 3, 'Bon outil, quelques réglages à apprendre.', 'Paul R.', '', '');
do $$ begin
  assert (select count(*) from public.avis) = 1, 'seul son avis est visible';
  begin
    perform public.moderer_avis((select id from public.avis), 'publie');
    raise exception 'un client a publié son avis';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.avis set statut = 'publie';
    raise exception 'un client a modifié la table des avis';
  exception when insufficient_privilege then null;
  end;
end $$;

-- L'administrateur Frisk voit tout et publie l'avis de l'entreprise 1.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000f","email":"admin@frisk.fr"}', false);
do $$ begin assert (select count(*) from public.avis) = 2, 'Frisk voit tous les avis'; end $$;
select public.moderer_avis((select id from public.avis where auteur = 'Marie D.'), 'publie');

-- Le site vitrine le voit, sans identifiant ni e-mail.
set role anon;
select set_config('request.jwt.claims', '{}', false);
do $$
declare a record;
begin
  assert (select count(*) from public.avis_publies()) = 1, 'un seul avis publié';
  select * into a from public.avis_publies();
  assert a.auteur = 'Marie D.' and a.note = 5 and a.entreprise = 'Entreprise 1', 'avis publié affiché';
end $$;

-- L'auteur modifie son avis : il repart en relecture et disparaît du site en attendant.
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c","email":"lecteur@e1.fr"}', false);
select public.deposer_avis('10000000-0000-0000-0000-000000000001', 4, 'Très pratique, il manque juste un export Excel.', 'Marie D.', 'Gérante', '');
do $$ begin
  assert (select statut from public.avis) = 'en_attente', 'avis modifié renvoyé en relecture';
  assert (select count(*) from public.avis) = 1, 'toujours un seul avis par personne';
end $$;
set role anon;
select set_config('request.jwt.claims', '{}', false);
do $$ begin assert (select count(*) from public.avis_publies()) = 0, 'avis modifié retiré du site'; end $$;

reset role;
select 'Tests des avis passés.' as resultat;
