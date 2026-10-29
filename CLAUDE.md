@AGENTS.md

# Frisk Plateforme

Mémoire commune des sessions Claude Code sur ce projet (application sur le PC et claude.ai/code,
plusieurs comptes). Ce qui est appris d'important et qui n'est pas déjà dans le code ou le README
s'ajoute ici, par une PR.

## Le projet

- Application de prévention des risques professionnels de **Frisk** pour les TPE et PME : DUERP,
  pénibilité, EPI, accidents, formations, vérifications, signalement terrain, bilans. Détail et mise
  en place : [README.md](README.md).
- Anciennement **Frisk DU** : le dépôt (`Friskinter/Frisk-DU`), le dossier `frisk-du` et l'adresse
  Vercel gardent ce nom. Dans les textes, toujours écrire « Frisk Plateforme ».
- Le site vitrine est un autre dépôt, `Friskinter/Frisk`, qui renvoie vers Frisk Plateforme.
- Hébergé sur Vercel, déployé automatiquement à chaque fusion dans `main`. **Pas encore ouvert au
  public** : la [liste de lancement](README.md#liste-de-lancement) dit ce qui reste à faire.

## Façon de travailler

- **Une branche et une PR par tâche**, jamais de commit direct sur `main`. Plusieurs sessions
  travaillent en parallèle sur le dépôt : toujours partir d'un `main` à jour (`git pull`) et ne pas
  reprendre la branche d'une autre session.
- Tout est en **français** : code (noms de variables et de fonctions), commentaires, messages de
  commit, PR, textes de l'interface. Ton simple et clair, pour des utilisateurs non techniciens.
- Avant chaque PR : `npm run lint`, `npm test`, `npm run build`, et `npm run test:parcours` quand
  l'interface change.

## Pièges connus

- **Next.js 16** avec `cacheComponents` : lire la doc de `node_modules/next/dist/docs/` avant
  d'écrire du code (voir AGENTS.md). Pas de CSP à nonces : incompatible avec le prérendu partiel.
- **Mode de test** (`NEXT_PUBLIC_FRISK_E2E=1`) : l'application tourne sans compte sur les données de
  démonstration ; c'est ce qu'utilisent les tests Playwright. Jamais sur Vercel.
- **Toutes les données d'une entreprise** sont un seul JSON (`espaces.contenu`), modifié par
  opérations (`lib/operations.ts`, fonction SQL `appliquer_operations`) et synchronisé en direct
  (`lib/stockage.ts`). Toute nouvelle donnée passe par ce mécanisme et par une migration SQL
  numérotée dans `supabase/migrations`.
- **Content-Security-Policy** dans `next.config.ts` : un nouveau service externe (script, image,
  appel réseau) doit y être ajouté, sinon le navigateur le bloque sans erreur visible. Vérifier avec
  la console du navigateur.
- **Anti-robot Turnstile** : n'activer le captcha dans Supabase qu'**après** avoir déployé
  `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, sinon plus personne ne peut se connecter.
- Le test Playwright « affichage rapide » (moins de 5 s par page) échoue parfois en local quand toute
  la suite tourne sur une machine chargée ; il passe lancé seul.
