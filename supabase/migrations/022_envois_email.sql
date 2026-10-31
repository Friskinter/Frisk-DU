-- Frisk Plateforme : journal des e-mails envoyés (récapitulatif du lundi, urgences, signalements
-- terrain), réussis ou en échec, consultable par Frisk dans la console.
-- À exécuter une fois dans Supabase : SQL Editor > New query > coller ce fichier > Run.
-- Le script peut être relancé sans risque.

create or replace function public.frisk_version()
returns integer
language sql
immutable
set search_path = ''
as $$ select 22; $$;
grant execute on function public.frisk_version() to authenticated, anon;

-- Une ligne par e-mail (un destinataire). Le contenu de l'e-mail n'est pas conservé : seulement le
-- type, l'entreprise, l'adresse, le résultat et, en cas d'échec, la raison donnée par Resend.
-- Écrit par le serveur (clé secrète) ; conservé 90 jours ; supprimé avec l'entreprise.
create table if not exists public.envois_email (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  type text not null check (type in ('recapitulatif', 'urgences', 'signalement')),
  entreprise_id uuid references public.entreprises (id) on delete cascade,
  destinataire text not null check (char_length(destinataire) <= 320),
  reussi boolean not null,
  erreur text not null default '' check (char_length(erreur) <= 500)
);
create index if not exists envois_email_date on public.envois_email (created_at desc);

alter table public.envois_email enable row level security;
drop policy if exists "envois_email_lecture" on public.envois_email;
create policy "envois_email_lecture" on public.envois_email for select to authenticated
  using (public.est_admin());
revoke all on public.envois_email from anon;
revoke insert, update, delete on public.envois_email from authenticated;
