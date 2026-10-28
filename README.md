# Frisk DU

Application de prévention des risques professionnels proposée par Frisk aux entreprises :

- **DUERP** en tableau éditable, avec guide de cotation (gravité, fréquence, maîtrise, criticité)
- **Pénibilité** : les 10 facteurs de risques professionnels et leurs seuils
- **EPI & stocks** : remises par salarié, stock par taille, stock tampon, quantités à commander
- **Bilans** de consommation façon Power BI (filtres et filtrage croisé)
- **Comptes clients** : chaque entreprise a son espace, ses utilisateurs et ses données en ligne
- **Console Frisk** (`/console`) : création des clients, gestion des accès et des rôles, ouverture de leur espace
- **Rôles** : responsable (tout), contributeur (remises d'EPI et signatures), lecteur (consultation)
- **Journal des modifications** (`/journal`) : qui a modifié quoi et quand, avec l'ancienne et la nouvelle valeur
- **Travail à plusieurs** : les modifications des collègues arrivent en direct, sans écraser les siennes

## Mise en place de Supabase (une seule fois)

1. **Créer les tables** : Supabase > *SQL Editor* > *New query* > coller le contenu de
   [`supabase/schema.sql`](supabase/schema.sql) > *Run*. Pour une base déjà en place, exécuter seulement les
   nouvelles migrations de [`supabase/migrations`](supabase/migrations), dans l'ordre.
2. **Couper les inscriptions publiques** (c'est Frisk qui crée les comptes) :
   *Authentication* > *Sign In / Providers* > décocher *Allow new users to sign up* > *Save*.
3. **Créer le compte administrateur Frisk** :
   *Authentication* > *Users* > *Add user* > *Create new user*, cocher *Auto Confirm User*.
   Puis dans le *SQL Editor* (en remplaçant l'e-mail) :
   ```sql
   insert into public.admins_frisk (user_id)
   select id from auth.users where email = 'votre-email@exemple.fr';
   ```
4. **Adresses autorisées** (pour les e-mails « mot de passe oublié ») :
   *Authentication* > *URL Configuration* > *Site URL* = l'adresse de Frisk DU en ligne,
   et ajouter `http://localhost:3000/**` dans *Redirect URLs*.

## Lancer en local

1. Copier `.env.example` en `.env.local` et y coller la **clé secrète** Supabase
   (*Project Settings* > *API Keys* > *Secret keys*). Elle sert uniquement à la console Frisk pour créer
   les comptes ; ne jamais la partager.
2. Puis :
   ```bash
   npm install
   npm run dev
   ```
3. Ouvrir http://localhost:3000 et se connecter avec le compte administrateur.

## Vérifications

```bash
npm run lint   # règles de code
npm test       # tests automatiques (calculs, alertes, opérations, journal, référentiels, PDF)
npm run build  # compilation et vérification des types
```

Les règles de la base (droits, journal, versions) ont leurs propres tests SQL, à lancer sur une base
PostgreSQL de test : `supabase/tests/lancer.sh` (variables `PGHOST`, `PGUSER`…).

Elles sont lancées automatiquement par GitHub à chaque demande de fusion (`.github/workflows/verifications.yml`).

## Mise en ligne (Vercel)

Importer le dépôt sur Vercel et ajouter la variable d'environnement `SUPABASE_SECRET_KEY`.
Reporter ensuite l'adresse obtenue dans Supabase (*Site URL*) et dans le lien « Espace client » du site Frisk.
