#!/usr/bin/env bash
# Lance les tests SQL sur une base PostgreSQL de test (jamais sur la base de production).
# Connexion via les variables habituelles : PGHOST, PGPORT, PGUSER, PGDATABASE.
set -euo pipefail
cd "$(dirname "$0")/.."
psql() { command psql -v ON_ERROR_STOP=1 -q "$@"; }

psql -f tests/00_imitation_supabase.sql
psql -f schema.sql
# Relancer le schéma doit être sans effet (scripts idempotents).
psql -f schema.sql
for f in migrations/*.sql; do psql -f "$f"; done
psql -At -f tests/01_roles_journal.test.sql | grep -v '^$' | tail -1
psql -At -f tests/02_plan_actions.test.sql | grep -v '^$' | tail -1
psql -At -f tests/03_accidents.test.sql | grep -v '^$' | tail -1
psql -At -f tests/04_formations.test.sql | grep -v '^$' | tail -1
psql -At -f tests/05_verifications.test.sql | grep -v '^$' | tail -1
psql -At -f tests/06_produits.test.sql | grep -v '^$' | tail -1
psql -At -f tests/07_groupes.test.sql | grep -v '^$' | tail -1
psql -At -f tests/08_double_authentification.test.sql | grep -v '^$' | tail -1
psql -At -f tests/09_suppression_client.test.sql | grep -v '^$' | tail -1
psql -At -f tests/10_entreprises_exterieures.test.sql | grep -v '^$' | tail -1
psql -At -f tests/11_protocoles_securite.test.sql | grep -v '^$' | tail -1
psql -At -f tests/12_signalement_terrain.test.sql | grep -v '^$' | tail -1
psql -At -f tests/13_visites.test.sql | grep -v '^$' | tail -1
