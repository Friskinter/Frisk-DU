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
2. **Inscriptions** : les clients s'inscrivent eux-mêmes, voir
   [Inscription libre et essai gratuit](#inscription-libre-et-essai-gratuit) et
   [Protection anti-robot](#protection-anti-robot).
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

## Liste de lancement

À dérouler dans l'ordre le jour de la mise en ligne publique. Chaque étape renvoie à la section qui la
détaille.

### 1. Avant tout : l'entreprise et les documents légaux

- [ ] Renseigner les informations de Frisk dans [`lib/legal.ts`](lib/legal.ts) : raison sociale, forme
      juridique, capital, siège, RCS ou SIREN, TVA, téléphone, e-mail, directeur de la publication, ville.
      Tant qu'un champ manque, il s'affiche en rouge « à compléter » sur les pages publiques et la console
      Frisk le signale.
- [ ] Renseigner `regionDonnees` (même fichier) : *Supabase > Project Settings > General > Region*.
- [ ] Faire relire par un juriste les CGV ([`app/legal/cgv`](app/legal/cgv/page.tsx)), et idéalement
      CGU, politique de confidentialité et accord de traitement.
- [ ] Accepter les accords de traitement des données (DPA) de Supabase, Vercel, Stripe et Resend
      (proposés dans leurs tableaux de bord ou sur leurs sites).
- [ ] Tenir le registre des traitements RGPD de Frisk (comptes clients, données des salariés des
      clients, paiements).

### 2. Supabase (base de production)

- [ ] **Passer au plan payant** : en gratuit, un projet sans activité pendant une semaine est mis en
      pause et les sauvegardes quotidiennes ne sont pas incluses.
- [ ] Vérifier que `supabase/schema.sql` et **toutes** les migrations de `supabase/migrations` ont
      été exécutées (la dernière : `017_abonnements.sql`).
- [ ] Compte administrateur Frisk créé (voir [Mise en place de Supabase](#mise-en-place-de-supabase-une-seule-fois))
      et **double authentification activée** dessus.
- [ ] *Authentication > Sign In / Providers* : **Allow new users to sign up** et **Confirm email**
      activés (voir [Inscription libre et essai gratuit](#inscription-libre-et-essai-gratuit)).
- [ ] *Authentication > URL Configuration* : *Site URL* = adresse définitive (ex.
      `https://app.frisk.fr`), et `https://<adresse>/auth/callback` dans *Redirect URLs*.
- [ ] **E-mails d'authentification par un vrai serveur d'envoi** : *Authentication > Emails > SMTP
      Settings*. Le serveur intégré de Supabase n'envoie qu'une poignée d'e-mails par heure et ne sert
      qu'aux essais : sans SMTP personnalisé, les confirmations d'inscription se perdent. Resend fournit
      un accès SMTP (même compte que les alertes).
- [ ] *Authentication > Emails > Templates* : traduire en français « Confirm signup » et « Reset
      password ».
- [ ] *Authentication > Attack Protection* : activer la protection contre les mots de passe divulgués
      si le plan le permet. **Le captcha attend l'étape 6.**

### 3. Envoi des e-mails (Resend)

- [ ] Créer le compte Resend et **vérifier le domaine d'envoi** (enregistrements DNS SPF et DKIM
      fournis par Resend), sinon les e-mails partent en courrier indésirable.
- [ ] Noter la clé d'API (`RESEND_API_KEY`) et choisir l'expéditeur (`ALERTES_EXPEDITEUR`, ex.
      `Frisk DU <alertes@frisk.fr>`).

### 4. Stripe (paiement réel)

- [ ] Activer le compte Stripe (informations de la société, compte bancaire).
- [ ] **Refaire en mode réel** tout ce qui a été préparé en mode test : rien n'est copié d'un mode à
      l'autre. Produit et six prix avec leurs clés de recherche, portail client, webhook (voir
      [Paiement en ligne](#paiement-en-ligne-stripe)).
- [ ] Noter la clé secrète réelle (`sk_live_…`) et le secret du webhook réel (`whsec_…`).
- [ ] Facultatif mais conseillé : TVA (*Paramètres > Taxes*) et relances des impayés.

### 5. Vercel (hébergement)

- [ ] Créer le projet à partir du dépôt GitHub. **Plan Pro** : le plan gratuit est réservé aux usages
      non commerciaux.
- [ ] Brancher le nom de domaine définitif (*Settings > Domains*) ; le HTTPS est automatique.
- [ ] Ajouter les variables d'environnement (voir [Mise en ligne](#mise-en-ligne-vercel)) :
      `SUPABASE_SECRET_KEY`, `URL_APPLICATION` (adresse définitive), `CRON_SECRET` (longue
      chaîne aléatoire), `RESEND_API_KEY`, `ALERTES_EXPEDITEUR`, `STRIPE_SECRET_KEY`,
      `STRIPE_WEBHOOK_SECRET`. **Jamais** `NEXT_PUBLIC_FRISK_E2E` (la compilation la refuse).
- [ ] Déployer, puis vérifier que la tâche planifiée `/api/alertes` apparaît dans *Settings > Cron Jobs*.

### 6. Protection anti-robot (Turnstile)

Dans cet ordre, sinon plus personne ne peut se connecter (voir [Protection anti-robot](#protection-anti-robot)) :

- [ ] Cloudflare : créer le widget Turnstile pour le domaine définitif.
- [ ] Vercel : ajouter `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, **redéployer**, vérifier que la vérification
      s'affiche sur `/inscription` et `/connexion`.
- [ ] Supabase : *Attack Protection* > activer le captcha (Turnstile, clé secrète).

### 7. Essais en conditions réelles

- [ ] **Inscription** avec une vraie adresse : e-mail de confirmation reçu (en français, pas en
      indésirables), espace ouvert, essai de 7 jours affiché.
- [ ] **Connexion**, déconnexion, **mot de passe oublié** jusqu'au bout.
- [ ] **Paiement** avec une vraie carte sur la plus petite offre : abonnement actif dans l'espace, puis
      rembourser et résilier depuis Stripe ; vérifier que l'espace suit (webhook).
- [ ] **Signalement terrain** : scanner le QR code depuis un téléphone, envoyer un signalement avec
      photo, vérifier l'e-mail reçu par le responsable.
- [ ] **Alertes** : aperçu sans envoi, qui liste les e-mails qui partiraient :
      `curl -H "Authorization: Bearer <CRON_SECRET>" "https://<adresse>/api/alertes?apercu=1"`
- [ ] **PDF** : document unique, rapport annuel, registre des accidents.
- [ ] Console Frisk > « Erreurs rencontrées » : rien d'anormal après ces essais.

### 8. Ouverture

- [ ] Site vitrine Frisk : faire pointer le lien « Espace client » et les boutons d'essai gratuit vers
      l'adresse définitive.
- [ ] Site vitrine Frisk : autoriser les moteurs de recherche (`INDEXATION_AUTORISEE = true` dans
      son `next.config.ts`). Frisk DU, lui, reste toujours hors des moteurs.
- [ ] Supprimer les comptes et entreprises créés pendant les essais (console Frisk et Stripe).
- [ ] Les jours suivants : surveiller la console (erreurs), Stripe (paiements, webhooks en échec) et
      Resend (e-mails refusés).

## Mise en ligne (Vercel)

Importer le dépôt sur Vercel et ajouter les variables d'environnement (détail dans `.env.example`) :

| Variable | Rôle |
| --- | --- |
| `SUPABASE_SECRET_KEY` | Console Frisk, signalements, alertes et webhook Stripe (obligatoire) |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Protection anti-robot de l'inscription et de la connexion |
| `CRON_SECRET`, `RESEND_API_KEY`, `ALERTES_EXPEDITEUR`, `URL_APPLICATION` | Récapitulatif hebdomadaire des alertes par e-mail |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Paiement en ligne |

Reporter ensuite l'adresse obtenue dans Supabase (*Site URL*) et dans le lien « Espace client » du site Frisk.

## Inscription libre et essai gratuit

Les nouveaux clients s'inscrivent eux-mêmes sur `/inscription` et disposent de 7 jours d'essai
(document unique, plan d'actions, salariés ; les autres modules sont présentés en aperçu). Sans
abonnement à la fin de l'essai, l'espace passe en lecture seule. Dans Supabase :

1. *Authentication > Sign In / Providers* : activer **Allow new users to sign up** et **Confirm email**.
2. *Authentication > URL Configuration* : *Site URL* = l'adresse de Frisk DU, et ajouter
   `https://<adresse>/auth/callback` dans *Redirect URLs*.
3. *Authentication > Emails* : traduire en français l'e-mail « Confirm signup ».

Sans protection anti-robot, n'importe quel programme peut créer des comptes en masse : la mettre en
place avant d'ouvrir l'inscription au public (section suivante).

Depuis la console Frisk, un administrateur peut accorder l'abonnement (client conseil, paiement hors
ligne) ou prolonger un essai.

## Protection anti-robot

L'inscription, la connexion et « mot de passe oublié » affichent une vérification Cloudflare Turnstile
(gratuite, le plus souvent sans action de l'utilisateur), contrôlée par Supabase.

1. Sur dash.cloudflare.com : *Turnstile* > *Add widget*, ajouter le domaine de Frisk DU (et
   `localhost` pour les essais), mode *Managed*. Noter la **clé du site** et la **clé secrète**.
2. Dans Vercel : ajouter `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (clé du site), puis **redéployer**.
3. **Une fois le déploiement en ligne**, dans Supabase : *Authentication* > *Attack Protection* >
   activer *Enable Captcha protection*, fournisseur *Turnstile*, coller la clé secrète.

L'ordre compte : si Supabase exige la vérification avant que le site l'affiche, plus personne ne peut
se connecter. Pour revenir en arrière, désactiver d'abord l'option dans Supabase.

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

## Avis clients

Chaque utilisateur peut laisser un avis (note et texte) dans *Mon compte*. Frisk le relit dans la
console, rubrique « Avis clients » (*Publier* ou *Ne pas publier*), puis il apparaît sur la page
d'accueil du site vitrine, qui le lit sur `/api/avis` (mis en cache quelques minutes). Modifier un
avis le renvoie en relecture. Règle annoncée sur le site vitrine : les avis positifs comme négatifs
sont publiés ; seuls sont écartés les propos injurieux, hors sujet ou contenant des données
personnelles. Tables et droits : migration `018_avis.sql`.

## Suivi des erreurs

Les erreurs rencontrées par les utilisateurs (navigateur) et par le serveur sont enregistrées dans la
table `erreurs` et affichées dans la console Frisk, rubrique « Erreurs rencontrées ». Elles sont
conservées 90 jours. Aucune donnée saisie par les clients n'y figure.

Les captures des modules présentés pendant l'essai (`public/apercus`) se régénèrent avec
`scripts/captures-apercus.mjs` (voir l'en-tête du script).
