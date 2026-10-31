# Audit d'utilisation de Frisk Plateforme

*31 octobre 2026, après le chantier « Guider – Centraliser – Anticiper ». Parcours de toute
l'application comme un client, sur ordinateur (1440 px) et sur téléphone (390 px), avec les données
de démonstration (Logistique Démo SAS, 14 salariés). Aucune erreur dans la console du navigateur,
aucune page qui déborde en largeur sur téléphone.*

Les propositions sont classées par utilité pour le client, de la plus utile à la moins utile. L'effort
est indicatif : **petit** (une PR courte), **moyen** (une PR complète), **grand** (plusieurs PR).
Rien n'est décidé : l'ordre et le choix reviennent à l'utilisateur.

## 1. Tableau de bord : l'essentiel d'abord

**Constat** : sur l'entreprise de démonstration, la liste « À traiter » compte 23 alertes, toutes
dépliées. Les indicateurs (risques, actions en retard, échéances…) n'arrivent qu'après. Sur téléphone,
la page mesure près de 10 000 pixels, soit une dizaine d'écrans à faire défiler. La pastille « 5 » du
menu (les urgences) ne correspond pas au « 23 » de la liste, sans explication.

**Proposition** :

- les indicateurs en haut ;
- les urgences toujours affichées, puis les 5 points suivants, avec « Voir les 18 autres » ;
- un filtre par module ;
- une infobulle sur la pastille du menu : « 5 urgences ».

**Effort** : petit.

## 2. Document unique : lisible sans faire défiler de côté

**Constat** : le tableau du DUERP compte 15 colonnes. Sur un écran de 1440 px, on ne voit que les six
premières (jusqu'à la fréquence). La criticité, le risque résiduel et les actions sont hors de l'écran,
alors que ce sont les informations qu'on cherche le plus. Sur téléphone, le tableau est
inutilisable pour saisir.

**Proposition** :

- garder la colonne « Unité / danger » fixe à gauche et rapprocher la criticité et les actions ;
- ajouter une **fiche du risque** qui s'ouvre au clic, avec tous les champs les uns sous les autres.
  C'est la seule vue sur téléphone, et une alternative au tableau sur ordinateur.

**Effort** : moyen.

## 3. Des actions confiées à une personne, et « Mes actions »

**Constat** : le responsable d'une action est un texte libre (« Direction », « Responsable entrepôt »).
Frisk ne peut donc pas prévenir la personne, ni lui montrer ce qu'elle a à faire. Un contributeur se
connecte sans savoir ce qui l'attend.

**Proposition** :

- pouvoir choisir le responsable parmi les utilisateurs de l'espace (le texte libre reste possible) ;
- une page **« Mes actions »**, avec mes actions, mes échéances et mes formations à organiser ;
- l'action confiée apparaît dans le récapitulatif du lundi de la personne.

**Effort** : moyen.

## 4. Fiche salarié complète

**Constat** : les salariés sont une liste dans « Salariés & réglages », mêlée aux réglages de
l'entreprise. Pour savoir où en est une personne (habilitations, EPI remis, accueil, causeries,
expositions, accidents), il faut ouvrir six modules.

**Proposition** :

- une page « Salariés » à part ;
- une **fiche par salarié** qui réunit tout, avec un PDF à remettre ou à montrer lors d'un contrôle ;
- les réglages ne gardent que l'entreprise, les unités, les services et l'identité visuelle.

**Effort** : moyen.

## 5. Moins de boutons en tête de page

**Constat** : le DUERP a 8 boutons en tête de page. Sur téléphone, ils occupent tout le premier écran
avant le premier risque. C'est la même chose, dans une moindre mesure, pour les accidents (6 boutons)
et les formations (4).

**Proposition** : garder l'action principale (« + Ajouter un risque ») et un ou deux boutons utiles.
Le reste (guide, export, import, versions, bibliothèque) passe dans un menu « Plus ». Sur téléphone,
les indicateurs passent sur deux colonnes au lieu d'une : aujourd'hui, les quatre cartes du plan
d'actions occupent tout un écran.

**Effort** : petit.

## 6. Menu regroupé

**Constat** : le menu latéral aligne 18 entrées sans regroupement. Pour un nouveau client, il est
difficile de savoir par où commencer et ce qui va ensemble.

**Proposition** : quatre groupes titrés.

| Groupe | Entrées |
|---|---|
| Piloter | Tableau de bord, Mon parcours, Bilans, Rapport annuel |
| Évaluer | DUERP, Plan d'actions, Pénibilité, Produits chimiques |
| Suivre | Accidents, Vérifications, Visites, Entreprises extérieures |
| Salariés | Formations, Accueil et causeries, EPI, fiches salariés |

Journal, réglages et abonnement passent en bas.

**Effort** : petit.

## 7. Recherche dans toute l'application

**Constat** : chaque module a sa recherche, mais rien ne permet de chercher partout à la fois (un
salarié, un équipement, un produit, une entreprise extérieure).

**Proposition** : un champ de recherche en haut du menu (raccourci Ctrl+K) qui ouvre directement
l'élément, grâce aux liens directs de la phase 2.

**Effort** : moyen.

## 8. Visites et audits sur tablette, même sans réseau

**Constat** : les visites se font sur le terrain (entrepôt, chantier), souvent avec un réseau faible.
Aujourd'hui, une saisie faite sans connexion attend en mémoire et repart toutes les 5 secondes : si la page est fermée ou rechargée avant le retour du réseau, elle est perdue.

**Proposition** : garder la saisie d'une visite sur l'appareil et l'envoyer au retour du réseau, avec
un message clair « Hors ligne : enregistré sur cet appareil ».

**Effort** : grand. La synchronisation en direct (`lib/stockage.ts`) est à adapter.

## 9. Petits détails

- Le bouton d'envoi de fichier (logo, attestations, FDS) prend la langue du navigateur : « Choose
  file / No file chosen » sur un navigateur en anglais. Un bouton maison « Choisir un fichier »
  l'évite. **Effort** : petit.
- « Mon parcours » affiche 92 % avec, comme prochaine étape, la toute première (« Décrire votre
  entreprise »). C'est exact mais déroutant. On pourrait dire « Il vous reste 1 étape : décrire votre
  entreprise ». **Effort** : petit.

## Ce qui fonctionne bien

- Le **plan d'actions** groupé par risque, avec la criticité, le budget et l'efficacité, est clair.
- Les **accidents** : les indicateurs (jours sans accident, taux de fréquence et de gravité) et
  l'avancement de chaque événement (déclaration, analyse, DUERP) se lisent d'un coup d'œil.
- Les **EPI** : la quantité à commander et le bon de commande sont prêts à l'emploi.
- Les **alertes** sont datées, expliquées, et ouvrent l'élément précis.
- **Performances** : toutes les pages s'affichent en moins de 4 secondes sur un client de 500
  risques.

## Ordre conseillé

1. Les petits efforts qui changent la première impression : tableau de bord (1), boutons (5), menu
   (6) et détails (9).
2. Puis la fiche du risque (2), « Mes actions » (3) et la fiche salarié (4).
3. Enfin la recherche (7) et le hors-ligne (8).

## Suivi

| Proposition | État |
|---|---|
| 1. Tableau de bord | **Fait** (#58). Chiffres clés en haut. Les urgences, les nouveautés et les 5 points suivants sont affichés, avec « Voir les N autres ». Filtre par module. « dont N urgents » en face de la pastille du menu. Règle d'affichage : `alertesAffichees` (`lib/alertes.ts`). |
| 2. Document unique lisible | **Fait** (#63). Tableau : unité de travail fixe à gauche, puis danger, risque résiduel et actions, le détail de la cotation ensuite ; l'export Excel garde l'ordre habituel. Fiche du risque (`components/fiche-risque.tsx`) : tous les champs les uns sous les autres, ouverte par « Ouvrir la fiche » ou `?fiche=…`, en lecture seule pour un lecteur. Sur téléphone (moins de 768 px), une carte par risque qui ouvre sa fiche (`lib/ecran.ts`). |
| 3. Actions confiées et « Mes actions » | **Fait** (#65, migration 023). Plan d'actions : « Confier à… » parmi les utilisateurs de l'espace (`Action.responsableEmail`, fonction `utilisateurs_espace`), le texte libre reste possible. Page « Mes actions » : en retard, à venir, sans échéance, réalisées récemment, et formations à organiser pour un responsable (`lib/mes-actions.ts`). Récapitulatif du lundi : « Vos actions » en tête. |
| 4. Fiche salarié complète | **Fait** (#67). Page « Salariés » (`/salaries`) : la liste avec, pour chacun, « À jour » ou le nombre de points d'attention. Fiche par salarié (`?salarie=…`, `lib/salarie.ts`) : identité et tailles, points d'attention, formations (et celles exigées pour son poste), EPI remis, accueil et causeries, risques de son unité de travail (connue par son accueil) et pénibilité, produits chimiques, accidents ; chaque ligne ouvre l'élément dans son module. PDF « Fiche prévention du salarié ». « Salariés & réglages » devient « Réglages », en bas du menu. |
| 5. Moins de boutons en tête de page | **Fait** (#60). Menu « Plus » dans l'en-tête de page (`EnTetePage`, propriété `plus`) : il s'ouvre entièrement à l'écran et se referme après un choix. DUERP : 3 boutons et « Plus » au lieu de 8 (restent Versions, Document unique (PDF), + Ajouter un risque). Accidents : 3 boutons et « Plus » au lieu de 6. Chiffres clés sur deux colonnes sur téléphone dans tous les modules. |
| 6. Menu regroupé | **Fait** (#59). Quatre groupes titrés sur ordinateur (Piloter, Évaluer, Suivre, Salariés), puis Journal et Abonnement. Sur téléphone, le menu reste une ligne qui défile, sans titres. Le menu défile désormais en hauteur : sur un écran de 900 pixels, « Salariés & réglages » et « Abonnement » étaient coupés et inaccessibles. |
| 7. Recherche dans toute l'application | **Fait** (#69). Champ « Rechercher… » en haut du menu, aussi ouvert par Ctrl+K (⌘K sur Mac) : salariés, risques, actions, accidents, formations, équipements, produits, entreprises extérieures, visites, accueils, causeries, EPI et pages du menu (`lib/recherche.ts`). Sans accents ni majuscules, tous les mots doivent correspondre ; Entrée ou un clic ouvre l'élément par son lien direct. La fenêtre est rendue hors du menu (`createPortal`), sinon les en-têtes fixes des tableaux passent par-dessus. |
| 9. Petits détails | **Fait** (#61). Dépôt du logo : bouton maison « Choisir un fichier… » (le dernier bouton de fichier qui s'affichait dans la langue du navigateur). Parcours : « Il vous reste 1 étape : … » sur le tableau de bord et « Dernière étape » sur « Mon parcours », au lieu de « Prochaine étape » quand il ne reste qu'une étape. |
