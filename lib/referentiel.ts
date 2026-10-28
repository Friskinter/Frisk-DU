// Méthode de cotation Frisk : grilles expliquées pour un non-spécialiste.

import type {
  Declaration,
  Efficacite,
  FacteurAnalyse,
  NiveauMaitrise,
  PrincipePrevention,
  SeuilPenibilite,
  Soins,
  StatutAction,
  TypeEvenement,
} from "./types";

export type Echelon = {
  valeur: number;
  libelle: string;
  definition: string;
  exemples: string;
};

export const grilleGravite: Echelon[] = [
  {
    valeur: 1,
    libelle: "Faible",
    definition:
      "Blessure ou gêne légère, soignée sur place, sans arrêt de travail.",
    exemples: "Petite coupure, égratignure, ampoule, mal de tête passager.",
  },
  {
    valeur: 2,
    libelle: "Moyenne",
    definition:
      "Accident ou atteinte à la santé entraînant un arrêt de travail court (moins de 8 jours), sans séquelle.",
    exemples: "Entorse, brûlure superficielle, lombalgie aiguë, coupure avec points de suture.",
  },
  {
    valeur: 3,
    libelle: "Grave",
    definition:
      "Arrêt de travail long, maladie professionnelle ou séquelle durable partielle.",
    exemples: "Fracture, hernie discale, troubles musculo-squelettiques, surdité partielle, burn-out.",
  },
  {
    valeur: 4,
    libelle: "Très grave",
    definition:
      "Incapacité permanente lourde ou décès.",
    exemples: "Chute de hauteur, électrocution, écrasement, amputation, cancer professionnel.",
  },
];

export const grilleFrequence: Echelon[] = [
  {
    valeur: 1,
    libelle: "Rare",
    definition:
      "Le salarié est exposé exceptionnellement : moins d'une fois par an.",
    exemples: "Intervention en toiture une fois tous les deux ans.",
  },
  {
    valeur: 2,
    libelle: "Occasionnelle",
    definition: "Exposition quelques fois par an, au plus une fois par mois.",
    exemples: "Inventaire annuel, nettoyage trimestriel des locaux techniques.",
  },
  {
    valeur: 3,
    libelle: "Fréquente",
    definition: "Exposition plusieurs fois par mois ou chaque semaine.",
    exemples: "Réception des livraisons chaque semaine, déplacements clients réguliers.",
  },
  {
    valeur: 4,
    libelle: "Permanente",
    definition: "Exposition tous les jours ou en continu pendant le poste.",
    exemples: "Travail sur écran, port de charges quotidien, bruit des machines.",
  },
];

export type EchelonMaitrise = {
  valeur: NiveauMaitrise;
  libelle: string;
  coefficient: number;
  definition: string;
};

export const grilleMaitrise: EchelonMaitrise[] = [
  {
    valeur: "insuffisante",
    libelle: "Insuffisante",
    coefficient: 1,
    definition: "Aucune mesure de prévention, ou des mesures inefficaces.",
  },
  {
    valeur: "partielle",
    libelle: "Partielle",
    coefficient: 0.75,
    definition:
      "Des mesures existent mais sont incomplètes ou pas toujours appliquées (EPI fournis mais peu portés, consignes orales…).",
  },
  {
    valeur: "bonne",
    libelle: "Bonne",
    coefficient: 0.5,
    definition:
      "Mesures adaptées, appliquées et connues : salariés formés, EPI portés, consignes écrites.",
  },
  {
    valeur: "tres-bonne",
    libelle: "Très bonne",
    coefficient: 0.25,
    definition:
      "Risque supprimé à la source ou protections collectives en place, vérifiées régulièrement.",
  },
];

export type NiveauCriticite = {
  code: "faible" | "modere" | "important" | "critique";
  libelle: string;
  min: number; // borne basse incluse
  couleur: string;
  texte: string; // couleur du texte posé sur la pastille
  delai: string;
  definition: string;
};

// Couleurs de statut réservées : toujours accompagnées d'un libellé.
export const niveauxCriticite: NiveauCriticite[] = [
  {
    code: "faible",
    libelle: "Faible",
    min: 0,
    couleur: "#0ca30c",
    texte: "#ffffff",
    delai: "Surveiller",
    definition:
      "Risque acceptable en l'état. On le surveille et on le réévalue lors de la mise à jour annuelle.",
  },
  {
    code: "modere",
    libelle: "Modéré",
    min: 4,
    couleur: "#fab219",
    texte: "#0b0b0b",
    delai: "Dans l'année",
    definition:
      "Risque à réduire. Une action est à planifier dans l'année.",
  },
  {
    code: "important",
    libelle: "Important",
    min: 8,
    couleur: "#ec835a",
    texte: "#0b0b0b",
    delai: "Sous 3 mois",
    definition:
      "Risque prioritaire. Une action doit être engagée dans les trois mois.",
  },
  {
    code: "critique",
    libelle: "Critique",
    min: 12,
    couleur: "#d03b3b",
    texte: "#ffffff",
    delai: "Immédiat",
    definition:
      "Risque inacceptable. Action immédiate ; si besoin, arrêt de l'activité jusqu'à sa mise en sécurité.",
  },
];

export const statutsAction: { valeur: StatutAction; libelle: string }[] = [
  { valeur: "a-faire", libelle: "À faire" },
  { valeur: "en-cours", libelle: "En cours" },
  { valeur: "fait", libelle: "Réalisée" },
];

export type EchelonPrincipe = { valeur: PrincipePrevention; libelle: string; definition: string };

// Hiérarchie des mesures de prévention : on privilégie toujours les premières.
export const principesPrevention: EchelonPrincipe[] = [
  { valeur: "eviter", libelle: "1. Supprimer le risque", definition: "Éviter le risque ou le combattre à la source (supprimer l'opération, le produit, la situation)." },
  { valeur: "substituer", libelle: "2. Remplacer", definition: "Remplacer ce qui est dangereux par ce qui l'est moins (produit, procédé, équipement)." },
  { valeur: "collective", libelle: "3. Protection collective", definition: "Protéger tout le monde à la fois : garde-corps, aspiration, capotage, signalisation…" },
  { valeur: "organisation", libelle: "4. Organisation", definition: "Adapter le travail : planification, rotation, procédures, aménagement des postes." },
  { valeur: "formation", libelle: "5. Formation et information", definition: "Former et informer les salariés : consignes, habilitations, sensibilisation." },
  { valeur: "epi", libelle: "6. Protection individuelle", definition: "Équipements de protection individuelle, en complément des mesures précédentes." },
];

export const efficacites: { valeur: Efficacite; libelle: string; couleur: string; texte: string }[] = [
  { valeur: "non-evaluee", libelle: "Non vérifiée", couleur: "#d9cfc1", texte: "#0c0b0a" },
  { valeur: "efficace", libelle: "Efficace", couleur: "#0ca30c", texte: "#ffffff" },
  { valeur: "partielle", libelle: "Partiellement efficace", couleur: "#fab219", texte: "#0b0b0b" },
  { valeur: "inefficace", libelle: "Inefficace", couleur: "#d03b3b", texte: "#ffffff" },
];

// ---------- Accidents et presque-accidents ----------

export const typesEvenement: { valeur: TypeEvenement; libelle: string; definition: string; couleur: string; texte: string }[] = [
  {
    valeur: "accident-travail", libelle: "Accident du travail", couleur: "#d03b3b", texte: "#ffffff",
    definition: "Survenu par le fait ou à l'occasion du travail et ayant causé une lésion, même légère.",
  },
  {
    valeur: "accident-trajet", libelle: "Accident de trajet", couleur: "#ec835a", texte: "#0b0b0b",
    definition: "Survenu sur le trajet entre le domicile et le travail, ou entre le travail et le lieu du repas.",
  },
  {
    valeur: "presque-accident", libelle: "Presque-accident", couleur: "#fab219", texte: "#0b0b0b",
    definition: "Aurait pu blesser quelqu'un, mais sans conséquence cette fois (ex. un colis tombe à côté d'un salarié).",
  },
  {
    valeur: "situation-dangereuse", libelle: "Situation dangereuse", couleur: "#d9cfc1", texte: "#0c0b0a",
    definition: "Repérée avant tout incident et pouvant conduire à un accident (ex. garde-corps manquant, flaque d'huile).",
  },
];

export const niveauxSoins: { valeur: Soins; libelle: string }[] = [
  { valeur: "aucun", libelle: "Aucune lésion" },
  { valeur: "premiers-soins", libelle: "Premiers soins sur place" },
  { valeur: "soins-medicaux", libelle: "Soins médicaux, sans arrêt" },
  { valeur: "arret", libelle: "Arrêt de travail" },
];

export const declarations: { valeur: Declaration; libelle: string; definition: string }[] = [
  { valeur: "a-faire", libelle: "À déclarer", definition: "Déclaration d'accident du travail (DAT) à faire à la CPAM dans les 48 heures." },
  { valeur: "faite", libelle: "Déclarée à la CPAM", definition: "La déclaration d'accident du travail a été envoyée (net-entreprises.fr ou formulaire Cerfa 14463)." },
  {
    valeur: "registre", libelle: "Inscrit au registre des accidents bénins",
    definition: "Possible seulement sans arrêt ni soins médicaux, si l'entreprise tient ce registre (secouriste présent en permanence, poste de secours, CSE informé).",
  },
  { valeur: "non-requise", libelle: "Pas de déclaration", definition: "Presque-accident ou situation dangereuse : pas de déclaration à la CPAM, mais une analyse." },
];

// Méthode ITMaMi (INRS) : les quatre familles de faits à rechercher pour comprendre un accident.
export const facteursAnalyse: { cle: FacteurAnalyse; libelle: string; question: string }[] = [
  { cle: "individu", libelle: "Individu", question: "La personne : formation, expérience, ancienneté au poste, fatigue, intérimaire ou nouvel arrivant ?" },
  { cle: "tache", libelle: "Tâche", question: "Le travail : mode opératoire, tâche inhabituelle, urgence, consignes absentes ou inadaptées ?" },
  { cle: "materiel", libelle: "Matériel", question: "Les équipements : machine, outil, EPI, état, entretien, adaptés à la tâche ?" },
  { cle: "milieu", libelle: "Milieu", question: "L'environnement : sol, éclairage, bruit, encombrement, météo, travail à plusieurs entreprises ?" },
];

export const seuilsPenibilite: { valeur: SeuilPenibilite; libelle: string }[] = [
  { valeur: "non", libelle: "Sous le seuil" },
  { valeur: "a-evaluer", libelle: "À évaluer" },
  { valeur: "oui", libelle: "Seuil dépassé" },
];

export type FacteurPenibilite = {
  code: string;
  libelle: string;
  famille: string;
  seuil: string;
  c2p: boolean; // ouvre des points sur le compte professionnel de prévention
};

// Les 10 facteurs de risques professionnels (art. L4161-1 et D4163-2 du Code du travail).
export const facteursPenibilite: FacteurPenibilite[] = [
  {
    code: "manutention",
    libelle: "Manutentions manuelles de charges",
    famille: "Contraintes physiques marquées",
    seuil:
      "Lever ou porter une charge d'au moins 15 kg, pousser ou tirer au moins 250 kg, ou se déplacer avec une charge d'au moins 10 kg : 600 heures par an. Ou cumul de 7,5 tonnes par jour : 120 jours par an.",
    c2p: false,
  },
  {
    code: "postures",
    libelle: "Postures pénibles",
    famille: "Contraintes physiques marquées",
    seuil:
      "Bras au-dessus des épaules, position accroupie ou à genoux, torse en torsion d'au moins 30° ou fléchi d'au moins 45° : 900 heures par an.",
    c2p: false,
  },
  {
    code: "vibrations",
    libelle: "Vibrations mécaniques",
    famille: "Contraintes physiques marquées",
    seuil:
      "Vibrations transmises aux mains et aux bras d'au moins 2,5 m/s², ou à l'ensemble du corps d'au moins 0,5 m/s² : 450 heures par an.",
    c2p: false,
  },
  {
    code: "chimique",
    libelle: "Agents chimiques dangereux (y compris poussières et fumées)",
    famille: "Environnement physique agressif",
    seuil:
      "Exposition au-delà du seuil fixé par la grille d'évaluation réglementaire (selon le produit, le procédé et la protection) : 150 heures par an.",
    c2p: false,
  },
  {
    code: "hyperbare",
    libelle: "Activités en milieu hyperbare",
    famille: "Environnement physique agressif",
    seuil: "Interventions à une pression d'au moins 1 200 hectopascals : 60 interventions par an.",
    c2p: true,
  },
  {
    code: "temperatures",
    libelle: "Températures extrêmes",
    famille: "Environnement physique agressif",
    seuil: "Température inférieure ou égale à 5 °C, ou au moins égale à 30 °C : 900 heures par an.",
    c2p: true,
  },
  {
    code: "bruit",
    libelle: "Bruit",
    famille: "Environnement physique agressif",
    seuil:
      "Au moins 81 dB(A) sur une journée de 8 heures : 600 heures par an. Ou bruit de crête d'au moins 135 dB(C) : 120 fois par an.",
    c2p: true,
  },
  {
    code: "nuit",
    libelle: "Travail de nuit",
    famille: "Rythmes de travail",
    seuil: "Au moins une heure de travail entre minuit et 5 heures : 120 nuits par an.",
    c2p: true,
  },
  {
    code: "equipes",
    libelle: "Travail en équipes successives alternantes",
    famille: "Rythmes de travail",
    seuil:
      "Équipes alternantes (2×8, 3×8…) comprenant au moins une heure entre minuit et 5 heures : 50 nuits par an.",
    c2p: true,
  },
  {
    code: "repetitif",
    libelle: "Travail répétitif",
    famille: "Rythmes de travail",
    seuil:
      "Même geste répété à cadence contrainte : au moins 15 actions techniques pour un cycle de 30 secondes ou moins, ou 30 actions par minute pour un cycle plus long : 900 heures par an.",
    c2p: true,
  },
];

// Suggestions proposées dans la colonne « Danger » (saisie libre possible).
export const famillesDangers = [
  "Chute de plain-pied",
  "Chute de hauteur",
  "Chute d'objets",
  "Manutention manuelle",
  "Postures pénibles",
  "Gestes répétitifs",
  "Circulation interne (chariots, piétons)",
  "Déplacements routiers",
  "Machines et outils",
  "Coupures",
  "Électricité",
  "Incendie et explosion",
  "Produits chimiques",
  "Agents biologiques",
  "Bruit",
  "Vibrations",
  "Ambiances thermiques",
  "Éclairage insuffisant",
  "Travail sur écran",
  "Risques psychosociaux",
  "Travail isolé",
  "Agression physique ou verbale",
];

export const categoriesEpi = [
  "Mains",
  "Pieds",
  "Tête",
  "Yeux",
  "Auditif",
  "Respiratoire",
  "Corps",
  "Haute visibilité",
];
