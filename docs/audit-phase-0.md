# Frisk Plateforme — Rapport d'audit (phase 0)

*31 octobre 2026. En réponse au cahier des charges « Guider – Centraliser – Anticiper » (version 1.0).*
*Aucune modification du code pendant cette phase.*

---

## Synthèse

Le cahier des charges est **déjà en partie réalisé** : la plateforme calcule une quarantaine d'alertes sur trois niveaux, les affiche par priorité sur le tableau de bord, les envoie chaque lundi par e-mail, et la plupart des liens entre modules demandés existent (une non-conformité de visite devient une action, un signalement devient un événement, etc.).

Les vrais manques sont ciblés :

1. **Pas de profil d'entreprise** : l'assistant de démarrage est le même pour tous, et il disparaît une fois terminé.
2. **Pas de vue chronologique des échéances**, pas de filtres, pas d'activité récente sur le tableau de bord.
3. **Des liens qui mènent au module plutôt qu'à l'élément précis** (actions, formations, vérifications, produits, EPI).
4. **Des e-mails peu personnalisables** : une seule préférence par entreprise, envoyée à tous les membres quel que soit leur rôle, et des échecs d'envoi non conservés.

Recommandation principale : **garder le calcul actuel des alertes** (à partir des données, donc sans doublon et résolues d'elles-mêmes) plutôt que de créer un système de notifications stockées, et ajouter seulement ce qui manque (statut « vu », préférences par personne, rappels urgents).

---

## 1. Assistant de démarrage

**Ce qui existe** (`lib/demarrage.ts`, `components/assistant-demarrage.tsx`)
- Encart « Bien démarrer avec Frisk Plateforme » en haut du tableau de bord, avec barre d'avancement.
- Six à huit étapes **qui se cochent d'elles-mêmes d'après les données** (aucune saisie en double) : fiche de l'entreprise, unités de travail, salariés, au moins trois risques évalués, une action pour chaque risque prioritaire, première version figée du DUERP, QR code de signalement activé.
- Pour chaque étape : une explication courte et un bouton vers le bon écran (DUERP express, import Excel…).
- Quatre suggestions « pour aller plus loin » : formations exigées par poste, équipements à vérifier, produits chimiques, catalogue des EPI.
- Visible du responsable seulement ; il peut le masquer et le réafficher dans *Salariés & réglages*.

**Limites**
- **Aucune personnalisation** : la fiche de l'entreprise ne contient qu'un texte libre « activité » et un effectif en texte ; pas de secteur, de nombre d'établissements, d'intérimaires, de produits chimiques, etc. Une entreprise de bureaux et un atelier voient les mêmes étapes.
- **Disparaît une fois terminé** : pas de « Mon parcours QHSE » durable, ni d'étape de suivi régulier (mise à jour annuelle, revue des actions).
- Les métiers choisis dans le **DUERP express** (75 métiers, 10 domaines) ne sont pas réutilisés pour orienter la suite.

**Proposition (phase 1)**
- Un **profil court** (cinq questions au plus au départ, complétables ensuite) : secteur (réutiliser les 10 domaines du DUERP express), effectif (en tranches), présence d'intérimaires ou de sous-traitants, de produits chimiques, d'équipements à vérifier. Les réponses « je ne sais pas » restent possibles.
- **« Mon parcours QHSE »** : faire évoluer l'assistant existant en page durable, avec les étapes terminées, en cours, à faire, et un pourcentage présenté comme l'**avancement du parcours dans Frisk**, jamais comme une conformité.
- Étapes **ajoutées selon le profil**, présentées comme des pistes à valider (ex. « Vous utilisez des produits chimiques : faites l'inventaire et récupérez les fiches de sécurité »). Aucune étape retirée à cause du secteur.
- Une étape de **suivi régulier** (mise à jour annuelle du DUERP, revue des actions) une fois les bases posées.

**Contrainte technique** : les données d'une entreprise sont un seul document ; ajouter le profil demande une **migration SQL** pour autoriser ces nouveaux champs (comme pour l'identité visuelle), et des tests.

---

## 2. Tableau de bord

**Ce qui existe** (`app/(espace)/page.tsx`)
- L'assistant de démarrage, puis l'encart **« À traiter »** (toutes les alertes, classées urgent → à traiter → à surveiller, chacune avec un lien), ou « Rien d'urgent » quand tout va bien.
- Quatre indicateurs : risques évalués, risques prioritaires, part des actions réalisées, actions en retard.
- Neuf cartes : matrice des risques, répartition par niveau, priorités d'action, risque le plus élevé par unité, produits chimiques, vérifications, formations, accidents, EPI à commander.
- Une vue d'ensemble séparée pour les groupes de plusieurs établissements.
- Toutes les valeurs sont calculées sur les données réelles (les données fictives n'existent qu'en mode démonstration).

**Limites**
- **Pas de vue « Prochaines échéances »** chronologique, alors que toutes les dates existent (actions, formations, vérifications, protocoles, interventions).
- **Pas de filtres** (type, module, période, responsable).
- **Pas d'« Activité récente »**, alors que le journal enregistre tout.
- Indicateurs absents : échéances à venir, formations qui expirent, vérifications à faire, avancement du parcours.
- Dans l'encart « À traiter », le tri se fait **seulement par niveau** : à niveau égal, pas de tri par date ou par proximité de l'échéance.

**Proposition (phase 2)**
- **Rangée d'indicateurs** revue : actions en cours / en retard, échéances dans les 30 jours, formations qui expirent, vérifications à faire, avancement du parcours.
- **« À traiter en priorité »** conservé et enrichi : date concernée et action proposée sur chaque ligne ; à niveau égal, l'échéance la plus proche ou la plus dépassée d'abord. Règles de priorité **documentées** (une page « Comment sont classées les priorités ? »).
- **« Prochaines échéances »** : frise sur 90 jours, filtrable par type, module, période et responsable.
- **« Activité récente »** : les dix dernières entrées du journal, en langage clair, avec lien.
- Garder les cartes actuelles plus bas, éventuellement repliables.

---

## 3. Alertes et récapitulatif

**Ce qui existe** (`lib/alertes.ts`, `app/api/alertes/route.ts`, `lib/email-alertes.ts`)
- **43 règles d'alerte** sur trois niveaux (urgent, à traiter, à surveiller), couvrant DUERP (version annuelle, actions en retard ou proches, risques critiques sans action), accidents (à déclarer, à analyser, à reporter dans le DUERP, signalements terrain), formations (manquantes, expirées, à 30 et 90 jours), vérifications (en retard, non conformes, jamais faites, proches, observations à lever), produits chimiques (CMR, fiche manquante ou ancienne), entreprises extérieures (plans et protocoles), accueils et causeries, EPI (rupture, stock tampon, remises non signées), visites, pénibilité.
- **Calculées à partir des données à chaque affichage** : une alerte ne peut pas exister en double, et elle disparaît d'elle-même dès que la situation est réglée, sans jamais toucher à l'information source.
- **Récapitulatif chaque lundi** par e-mail (tâche planifiée Vercel), un e-mail par destinataire, avec un mode aperçu sans envoi ; option pour le désactiver par entreprise.
- **E-mail immédiat** aux responsables lors d'un signalement terrain.

**Limites**
- **Pas de statut « vu »** : impossible de distinguer une alerte nouvelle d'une alerte déjà connue.
- **Préférence d'e-mail par entreprise, pas par personne**, et le récapitulatif part à **tous les membres**, y compris lecteurs et contributeurs, avec le même contenu.
- **Pas de rappel immédiat** pour les urgences (en dehors des signalements) : il faut attendre le lundi.
- **Échecs d'envoi non conservés** : seulement visibles dans la réponse de la tâche planifiée.
- Les délais (30 et 90 jours pour les formations, etc.) sont fixés dans le code, non réglables.

**Proposition (phase 3)**
- **Garder le calcul actuel** comme source unique : c'est ce qui garantit l'absence de doublons et la résolution automatique demandées par le cahier des charges. Un système de notifications stockées (lu, résolu, J-30, J-15, J-7…) recréerait ces problèmes et multiplierait les e-mails pour des TPE.
- Ajouter :
  1. un **statut « vu » par personne** (petite table dédiée), pour signaler les nouveautés ;
  2. des **préférences par personne** : récapitulatif du lundi oui ou non, rappel immédiat des urgences oui ou non ;
  3. un **rappel quotidien des seules nouvelles urgences**, regroupé en un e-mail ;
  4. un **contenu adapté au rôle** (un lecteur ne reçoit pas les détails qu'il ne peut pas traiter) ;
  5. la **trace des envois et des échecs**, visible dans la console Frisk ;
  6. un **récapitulatif du lundi enrichi** : urgences, échéances de la semaine, prochaines étapes du parcours.

---

## 4. Liens entre modules

| Lien demandé (cahier des charges, §6.2) | État | Détail |
| --- | --- | --- |
| DUERP → plan d'actions | ✅ | Chaque action est rattachée à un risque ; alerte « risques critiques sans action ». |
| Action en retard → tableau de bord et alertes | ✅ | |
| Non-conformité de visite → plan d'actions | ✅ | L'action garde la référence de la visite (une seule action, pas de copie). |
| Accident → tableau de bord et suivi | ✅ | Alertes « à déclarer », « à analyser », « à reporter dans le DUERP » ; une action peut naître d'un accident. |
| Signalement terrain → traitement | ✅ | Devient un événement du registre, e-mail aux responsables. |
| Formations → alertes | ✅ | Une formation peut aussi naître d'une action. |
| Vérifications → alertes et tableau de bord | ✅ | |
| Produits chimiques → tableau de bord | ✅ | Fiche manquante, CMR, produit à reporter dans le DUERP. |
| Nouvel arrivant → accueil sécurité | ✅ | Alerte « nouvel arrivant sans accueil ». |
| EPI → stock insuffisant | ✅ | Rupture et stock tampon. |
| Entreprises extérieures → plan de prévention | ✅ | Plans et protocoles à préparer, compléter ou renouveler. |
| **Unité de travail modifiée → réexaminer les risques** | ❌ | À créer : signaler les risques de l'unité concernée. |
| **Ouvrir l'élément précis depuis une alerte** | ⚠️ Partiel | Oui pour accidents, accueils, causeries, interventions, protocoles, visites ; non pour actions (filtre par risque seulement), formations, vérifications, produits, EPI. |

**Traçabilité** : toutes les modifications passent par une fonction de la base qui vérifie les droits et écrit le journal (auteur, date, ancienne et nouvelle valeur, module). Le journal n'est ni modifiable ni effaçable. **Rien à changer.**

**Proposition (phase 4)** : ouvrir l'élément précis dans les cinq modules manquants (paramètre dans l'adresse, ligne mise en évidence), et l'alerte « unité de travail modifiée ».

---

## 5. Contraintes techniques relevées

- **Données** : tout le contenu d'une entreprise est un document unique, modifié par opérations contrôlées par la base. Tout nouveau champ (profil, préférences) passe par une **migration SQL numérotée** et des tests SQL.
- **Données par personne** (statut « vu », préférences d'e-mail) : elles ne peuvent pas vivre dans le document de l'entreprise, partagé par tous ; il faut une **petite table dédiée**, protégée par les règles d'accès.
- **Tâches planifiées** : le récapitulatif utilise une tâche Vercel ; un rappel quotidien en demande une deuxième (possible, à vérifier selon le plan Vercel retenu).
- **Performances** : les alertes sont recalculées à chaque affichage ; les tests de volume (un client avec 500 risques, 8 000 mouvements d'EPI, 900 signatures) restent sous les 5 secondes par page. La frise des échéances doit réutiliser les mêmes calculs, sans requête supplémentaire.
- **Sécurité** : règles d'accès par entreprise et par rôle dans la base, double authentification, anti-robot, journal. Aucune proposition ne les modifie ; les nouvelles tables suivront les mêmes règles.
- **Tests** : environ 320 tests automatiques, plus d'une centaine de tests de parcours (dont accessibilité, mobile, performances) et des tests SQL. Chaque phase ajoutera les siens, sans en retirer.

---

## 6. Plan proposé

| Ordre | Phase | Contenu | Taille |
| --- | --- | --- | --- |
| 1 | **2. Tableau de bord** | Indicateurs, échéances (frise et filtres), activité récente, tri à niveau égal, règles documentées | Moyenne |
| 2 | **4 (partie). Liens directs** | Ouvrir l'élément précis depuis une alerte ou une échéance (5 modules) | Petite |
| 3 | **1. Parcours** | Profil court, « Mon parcours QHSE », étapes selon le profil, suivi régulier | Moyenne |
| 4 | **3. Alertes** | Statut « vu », préférences par personne, rappel quotidien des urgences, contenu selon le rôle, trace des envois, récapitulatif enrichi | Grande |
| 5 | **4 (fin). Optimisation** | Alerte « unité modifiée », parcours complets, performances | Petite |

Commencer par le tableau de bord : c'est le plus visible, le moins risqué (aucune nouvelle donnée), et la frise des échéances servira ensuite au parcours et aux e-mails.

---

## 7. Décisions à prendre

1. ~~**Alertes** : garder le calcul à partir des données et ajouter « vu » et préférences (recommandé), ou créer un système de notifications stockées comme décrit au §5.6 du cahier des charges ?~~
   **Décidé le 31/10/2026 : on garde le calcul à partir des données**, complété par le statut « vu » et les préférences par personne.
2. **Profil** : **décidé** : les cinq questions proposées (secteur, effectif, intérimaires ou sous-traitants, produits chimiques, équipements à vérifier).
3. **E-mails immédiats** : **décidé** : accident à déclarer, rupture de stock d'EPI et toute nouvelle urgence (un e-mail groupé par jour). L'e-mail existant pour un signalement terrain est conservé.
4. **Ordre des phases** : **décidé** : tableau de bord d'abord.
