# Suivi de l'évolution « Guider – Centraliser – Anticiper »

*Point de reprise au 31 octobre 2026 : **chantier terminé** (phases 0 à 4). À lire avant de continuer ce chantier, quel que soit le compte ou la session.*

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
| #50 | **Alertes nouvelles depuis la dernière visite** : repère « Nouveau » sur chaque alerte de « À traiter », et nombre de nouvelles dans le titre. Chaque alerte est résumée par une empreinte courte (`lib/alertes-vues.ts` : identifiant + éléments, ou titre et détail), une alerte dont le contenu change redevient nouvelle. Table `alertes_vues` par personne et par entreprise (migration `021_alertes_vues.sql`, test SQL `20_…`), remplacée à chaque visite par `marquer_alertes_vues` (la table reste petite, une alerte réglée puis revenue redevient nouvelle). Première visite : rien n'est marqué. Les alertes de mise à jour annuelle du DUERP ne sont pas suivies (elles dépendent du chargement des versions). Les administrateurs Frisk ne sont pas suivis. |
| #51 | **Contenu des e-mails selon le rôle** (récapitulatif du lundi et urgences du matin) : le responsable reçoit tout le détail, le contributeur le détail des alertes EPI qu'il gère et les seuls titres pour le reste, le lecteur un résumé (les titres, qui ne donnent que des nombres, sans le détail qui peut citer des salariés ou des produits) avec une mention en bas de l'e-mail. Règle dans `alerteTraitable` (`lib/email-alertes.ts`), rôle lu dans `membres` (`destinatairesAvecRole`, `lib/preferences-email.ts`), un e-mail construit par personne. Rôle inconnu : traité en lecteur. Pas de migration. Le signalement terrain n'est pas concerné : il ne part qu'aux responsables et ne contient déjà aucun détail. |
| #52 | **Journal des e-mails dans la console Frisk** : chaque e-mail envoyé (récapitulatif du lundi, urgences du matin, signalement terrain) est noté, réussi ou en échec avec la raison donnée par Resend (`lib/envoi-email.ts` : `envoyerEmail`, qui ne lève jamais d'erreur, et `journaliserEnvois`). Table `envois_email` (migration `022_envois_email.sql`, test SQL `21_…`), lisible par Frisk seulement, sans le contenu de l'e-mail, conservée 90 jours (purge chaque matin) et supprimée avec l'entreprise. Carte « E-mails envoyés » dans la console : bilan de la semaine, échecs en rouge, liste complète sur demande. Une tâche planifiée qui ne peut pas envoyer faute de `RESEND_API_KEY` ou `ALERTES_EXPEDITEUR` le note dans « Erreurs rencontrées ». |
| #53 | **Récapitulatif du lundi enrichi** : dans l'ordre, les urgences (alertes critiques), les échéances de la semaine (du lundi au dimanche, `calculerEcheances` sur 6 jours, sans celles en retard qui sont déjà des alertes), les autres points à traiter et à surveiller, puis la prochaine étape de « Mon parcours QHSE » (`calculerParcours`, contexte lu par la tâche : versions figées, lien de signalement). Préparé par `preparerRecapitulatif` (`lib/recapitulatif.ts`), mis en forme par `emailRecapitulatif` (`lib/email-alertes.ts`, remplace `emailAlertes`). Sujet : « 1 urgence, 3 points à traiter, 2 échéances cette semaine ». Selon le rôle : le responsable a le détail des échéances et la prochaine étape ; le contributeur et le lecteur un décompte des échéances par type, sans noms ni parcours. Aucun e-mail si rien n'est à signaler (la prochaine étape seule ne suffit pas). Aperçu : `urgences`, `echeances`, `alertes` par entreprise. Pas de migration. |
| #55 | **Unité de travail modifiée → réexaminer ses risques** (phase 4) : dans le DUERP filtré sur une unité, « Signaler un changement » (motif proposé : nouvel équipement, réaménagement, nouveau procédé, organisation, accident) marque tous ses risques à réexaminer (champ `reexamen` de la ligne, `lib/reexamen.ts`). Lignes surlignées, bandeau récapitulatif, bouton « ✓ Réexaminé » ; revoir gravité, fréquence, maîtrise, mesures ou effectif vaut aussi réexamen. Alertes « N risques à réexaminer après un changement » et « N unités de travail sans risque évalué » (unité nouvelle ou renommée), qui ouvrent `/duerp?unite=…`. Visible dans le journal. Pas de migration (champ d'une ligne existante). |
| #NN | **Parcours complets et performances** (phase 4, fin) : `e2e/parcours-complets.spec.ts`, trois parcours à travers plusieurs modules sans recharger la page — nouvelle entreprise (questionnaire, DUERP express, plan d'actions, le parcours avance de lui-même, tableau de bord), alerte traitée jusqu'au bout (actions en retard réalisées, l'alerte disparaît), unité modifiée (signalement, alerte, réexamen, l'alerte disparaît). `tests/performance-calculs.test.ts` : alertes, échéances, parcours, récapitulatif et urgences mesurés sur le très gros client de `e2e/volume.ts` (désormais avec 100 risques à réexaminer) ; en local, environ 15 ms pour les alertes, 13 ms pour le récapitulatif, 1 ms pour les échéances. Le test de saisie du DUERP attend la page aussi longtemps que les tests d'affichage (il mesure la saisie, pas le chargement). |

## Phase 3, les alertes : terminée

Les six points, chacun dans sa PR avec ses tests :

1. ~~**Préférences d'e-mail par personne**~~ : **fait** (#48).
2. ~~**E-mails immédiats**~~ : **fait** (#49).
3. ~~**Statut « vu » par personne**~~ : **fait** (#50).
4. ~~**Contenu des e-mails selon le rôle**~~ : **fait** (#51).
5. ~~**Trace des envois et des échecs**~~ : **fait** (#52).
6. ~~**Récapitulatif du lundi enrichi**~~ : **fait** (#53).

## Phase 4, optimisation : terminée

1. ~~**Alerte « unité de travail modifiée → réexaminer ses risques »**~~ : **fait** (#55).
2. ~~**Parcours complets de bout en bout et performances**~~ : **fait** (#NN).

## Après le chantier

Plus rien de prévu dans ce chantier. Pour la suite, partir de la [liste de lancement](../README.md#liste-de-lancement) (mise en ligne publique) : informations légales, envoi des e-mails (Resend), paiement réel, domaine définitif.

## Méthode à suivre (rappel de `CLAUDE.md`)

- Partir d'un `main` à jour, **une branche et une PR par tâche**, tout en français.
- Avant chaque PR : `npm run lint`, `npm test`, `npm run build`, `npm run test:parcours`. Le test « affichage rapide » peut échouer quand toute la suite tourne sur une machine chargée : relancer `npx playwright test e2e/performance.spec.ts` seul.
- **Attention aux noms de fichiers de test** : `e2e/parcours.spec.ts` existe déjà (parcours utilisateurs) ; le test de la page « Mon parcours » s'appelle `e2e/mon-parcours.spec.ts`.
- Toute nouvelle donnée de l'entreprise passe par les opérations (`lib/operations.ts`) et une migration ; les tests SQL ne tournent qu'en CI (pas de PostgreSQL en local).
- À la fin de chaque phase, résumer : modifications, fichiers, tests exécutés, résultats, problèmes restants (exigence du cahier des charges).
