# Suivi de l'évolution « Guider – Centraliser – Anticiper »

*Point de reprise au 31 octobre 2026 (mis à jour avec la phase 3, point 1). À lire avant de continuer ce chantier, quel que soit le compte ou la session.*

Le cahier des charges (version 1.0 du 31/10/2026) demande de faire évoluer Frisk Plateforme d'un logiciel de gestion QHSE vers un outil de pilotage, **sans reconstruire ni supprimer l'existant**, en quatre phases après un audit. Le détail de l'existant, des limites et des propositions est dans [`audit-phase-0.md`](audit-phase-0.md).

## Décisions prises par l'utilisateur

1. **Alertes : on garde le calcul à partir des données** (`lib/alertes.ts`, 43 règles, 3 niveaux). Pas de table de notifications stockées : c'est ce qui garantit l'absence de doublons et la résolution automatique. On ajoute seulement ce qui manque (voir phase 3).
2. **Profil d'entreprise : 5 questions** (secteur, effectif, intervenants extérieurs, produits chimiques, équipements à vérifier). Fait.
3. **E-mails immédiats** (sans attendre le lundi) pour : **accident à déclarer**, **rupture de stock d'EPI**, et **toute nouvelle urgence** (un e-mail groupé par jour). L'e-mail existant pour un signalement terrain est conservé.
4. **Ordre** : tableau de bord, liens directs, parcours, puis alertes. Les trois premiers sont faits.

## Ce qui est fait (fusionné dans `main`)

| PR | Contenu |
| --- | --- |
| #44 | **Tableau de bord** : 6 indicateurs, « Prochaines échéances » filtrables (`lib/echeances.ts`), date et tri à niveau égal dans « À traiter », règles de priorité expliquées, « Activité récente » (journal). |
| #45 | **Liens directs** : `?action=`, `?equipement=`, `?produit=`, `?formation=`, `?article=`, `?onglet=` (EPI) mettent l'élément en évidence (`lib/cible.ts`) ; alertes et échéances y pointent quand elles ne concernent qu'un élément. |
| #46 | **Mon parcours QHSE** (`/parcours`, `lib/parcours.ts`) : profil en 5 questions rangé dans `fiche.profil` (aucune migration), étapes en 3 groupes, une réponse « non » devient une piste à vérifier (jamais retirée), avancement présenté comme un repère et non une conformité ; l'assistant de démarrage existant est relié au parcours. |
| #48 | **Préférences d'e-mail par personne** : table `preferences_email` (migration `019_preferences_email.sql`, test SQL `18_preferences_email.test.sql`), une ligne par personne et par entreprise, écrite seulement par `changer_preferences_email` ; sans ligne, tout est envoyé. Carte « E-mails que je reçois » dans *Mon compte* (récapitulatif du lundi, e-mails immédiats). Appliquées au récapitulatif du lundi (`/api/alertes`) et à l'e-mail de signalement terrain ; le réglage de l'entreprise (`preferences.alertesEmail`) reste prioritaire. `lib/preferences-email.ts`. |
| #49 | **E-mails immédiats des urgences** : tâche planifiée quotidienne `/api/urgences` (6 h 30 UTC, `vercel.json`, à côté de `/api/alertes` du lundi), un e-mail par entreprise avec les seules urgences (gravité « critique », dont accident à déclarer et rupture d'EPI) apparues depuis le dernier envoi, aux personnes dont la préférence `immediats` est active. Chaque urgence critique porte désormais `elements` (identifiants concernés) ; `lib/urgences.ts` en tire des clés (`alerte:élément`) retenues dans la table `alertes_envoyees` (migration `020_urgences_signalees.sql`, test SQL `19_…`) : jamais deux fois la même, une urgence réglée est oubliée et signalée de nouveau si elle revient, un envoi échoué repart le lendemain. Mode `?apercu=1`. Premier passage : les urgences déjà présentes partent une fois. |

## Prochaine étape : phase 3, les alertes

À faire, dans cet ordre conseillé (chaque point = une PR, avec ses tests) :

1. ~~**Préférences d'e-mail par personne**~~ : **fait** (#48).
2. ~~**E-mails immédiats**~~ : **fait** (#49).
3. **Statut « vu » par personne** pour distinguer les nouvelles alertes (même table que ci-dessus ou une table dédiée) ; affichage « nouveau » dans « À traiter ».
4. **Contenu des e-mails selon le rôle** : un lecteur ne reçoit pas les détails qu'il ne peut pas traiter.
5. **Trace des envois et des échecs** visible dans la console Frisk (aujourd'hui, seulement dans la réponse de la tâche planifiée).
6. **Récapitulatif du lundi enrichi** (`lib/email-alertes.ts`) : urgences, échéances de la semaine (`calculerEcheances`), prochaine étape du parcours (`calculerParcours`).

## Ensuite : phase 4

- Alerte « unité de travail modifiée → réexaminer ses risques » (seul lien entre modules manquant).
- Parcours complets de bout en bout et performances.

## Méthode à suivre (rappel de `CLAUDE.md`)

- Partir d'un `main` à jour, **une branche et une PR par tâche**, tout en français.
- Avant chaque PR : `npm run lint`, `npm test`, `npm run build`, `npm run test:parcours`. Le test « affichage rapide » peut échouer quand toute la suite tourne sur une machine chargée : relancer `npx playwright test e2e/performance.spec.ts` seul.
- **Attention aux noms de fichiers de test** : `e2e/parcours.spec.ts` existe déjà (parcours utilisateurs) ; le test de la page « Mon parcours » s'appelle `e2e/mon-parcours.spec.ts`.
- Toute nouvelle donnée de l'entreprise passe par les opérations (`lib/operations.ts`) et une migration ; les tests SQL ne tournent qu'en CI (pas de PostgreSQL en local).
- À la fin de chaque phase, résumer : modifications, fichiers, tests exécutés, résultats, problèmes restants (exigence du cahier des charges).
