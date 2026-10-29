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

## Inscription libre et essai gratuit

Les nouveaux clients s'inscrivent eux-mêmes sur `/inscription` et disposent de 7 jours d'essai
(document unique, plan d'actions, salariés ; les autres modules sont présentés en aperçu). Sans
abonnement à la fin de l'essai, l'espace passe en lecture seule. Dans Supabase :

1. *Authentication > Sign In / Providers* : activer **Allow new users to sign up** et **Confirm email**.
2. *Authentication > URL Configuration* : *Site URL* = l'adresse de Frisk DU, et ajouter
   `https://<adresse>/auth/callback` dans *Redirect URLs*.
3. *Authentication > Emails* : traduire en français l'e-mail « Confirm signup ».

Depuis la console Frisk, un administrateur peut accorder l'abonnement (client conseil, paiement hors
ligne) ou prolonger un essai.

## Paiement en ligne (Stripe)

Tant que Stripe n'est pas configuré, la page Abonnement invite à contacter Frisk. Pour l'activer
(possible d'abord en mode test, sans société créée) :

1. Créer un compte sur stripe.com, puis un produit « Frisk DU » avec **six prix récurrents**, en euros,
   hors taxes, chacun avec sa **clé de recherche** (*lookup key*) :

   | Tranche | Mensuel | Annuel |
   | --- | --- | --- |
   | 1 à 10 salariés | `frisk_du_tpe_mois` | `frisk_du_tpe_an` |
   | 11 à 49 salariés | `frisk_du_pe_mois` | `frisk_du_pe_an` |
   | 50 à 249 salariés | `frisk_du_pme_mois` | `frisk_du_pme_an` |

   Les prix se changent ensuite dans Stripe (nouveau prix avec la même clé, en cochant le transfert
   de la clé), sans toucher au code.
2. *Paramètres > Facturation > Portail client* : activer le portail (moyen de paiement, factures,
   changement d'offre entre les six prix, résiliation en fin de période).
3. *Développeurs > Webhooks* : ajouter le point de terminaison `https://<adresse>/api/stripe/webhook`
   avec les événements `checkout.session.completed`, `customer.subscription.created`,
   `customer.subscription.updated`, `customer.subscription.deleted`, `customer.subscription.paused`,
   `customer.subscription.resumed`, `invoice.paid` et `invoice.payment_failed`.
4. Dans Vercel, ajouter les variables `STRIPE_SECRET_KEY` (clé secrète) et `STRIPE_WEBHOOK_SECRET`
   (secret de signature du webhook), puis redéployer.
5. Facultatif : *Paramètres > Taxes* pour la TVA, *Paramètres > Facturation* pour les relances
   automatiques en cas d'échec de paiement.

## Suivi des erreurs

Les erreurs rencontrées par les utilisateurs (navigateur) et par le serveur sont enregistrées dans la
table `erreurs` et affichées dans la console Frisk, rubrique « Erreurs rencontrées ». Elles sont
conservées 90 jours. Aucune donnée saisie par les clients n'y figure.

Les captures des modules présentés pendant l'essai (`public/apercus`) se régénèrent avec
`scripts/captures-apercus.mjs` (voir l'en-tête du script).
