// Modèle de données de Frisk DU (DUERP, pénibilité, EPI).

export type NiveauMaitrise = "insuffisante" | "partielle" | "bonne" | "tres-bonne";

export type StatutAction = "a-faire" | "en-cours" | "fait";

export type SeuilPenibilite = "non" | "a-evaluer" | "oui";

export type LigneDuerp = {
  id: string;
  unite: string;
  activite: string;
  danger: string;
  risque: string;
  effectif: number;
  gravite: number;
  frequence: number;
  mesures: string;
  maitrise: NiveauMaitrise;
  penibilite: string; // code du facteur, "" si aucun
  seuilPenibilite: SeuilPenibilite;
  // Ancien format (une seule action par risque) : conservé pour relire les versions figées
  // antérieures au plan d'actions. Les actions sont désormais dans Donnees.actions.
  action?: string;
  responsable?: string;
  echeance?: string;
  statut?: StatutAction;
};

// Principes généraux de prévention (art. L4121-2), du plus efficace au moins efficace.
export type PrincipePrevention = "" | "eviter" | "substituer" | "collective" | "organisation" | "formation" | "epi";

export type Efficacite = "non-evaluee" | "efficace" | "partielle" | "inefficace";

// Action de prévention, rattachée à un risque du DUERP (plusieurs actions possibles par risque).
export type Action = {
  id: string;
  risqueId: string;
  intitule: string;
  principe: PrincipePrevention;
  responsable: string;
  echeance: string; // AAAA-MM-JJ
  statut: StatutAction;
  cout: number | null; // € HT estimés
  ressources: string; // moyens humains, prestataire…
  indicateur: string; // indicateur de résultat
  realiseeLe: string; // AAAA-MM-JJ
  efficacite: Efficacite;
  commentaire: string; // constat de la vérification d'efficacité
  evenementId?: string; // accident ou presque-accident à l'origine de l'action
};

export type TypeEvenement = "accident-travail" | "accident-trajet" | "presque-accident" | "situation-dangereuse";

export type Soins = "aucun" | "premiers-soins" | "soins-medicaux" | "arret";

export type Declaration = "a-faire" | "faite" | "registre" | "non-requise";

export type FacteurAnalyse = "individu" | "tache" | "materiel" | "milieu";

// Accident, presque-accident ou situation dangereuse, avec l'analyse de ses causes.
export type Evenement = {
  id: string;
  type: TypeEvenement;
  date: string; // AAAA-MM-JJ
  heure: string; // HH:MM
  lieu: string;
  unite: string; // unité de travail du DUERP
  salarieId: string; // "" : personne, "externe" : intérimaire, prestataire… (nom dans `victime`)
  victime: string;
  temoins: string;
  description: string; // circonstances
  lesions: string; // nature et siège des lésions
  soins: Soins;
  joursArret: number;
  secouriste: string; // qui a donné les premiers soins (registre des accidents bénins)
  declaration: Declaration;
  declareeLe: string; // AAAA-MM-JJ
  gravitePotentielle: number; // 1 à 4 : ce qui aurait pu arriver ; 0 si non évaluée
  pourquoi: string[]; // méthode des 5 pourquoi
  facteurs: Record<FacteurAnalyse, string>;
  enseignements: string;
  analyseeLe: string; // AAAA-MM-JJ
  analysePar: string;
  risqueId: string; // risque du DUERP concerné
  reevalueLe: string; // date de la revue de la cotation du risque après l'événement
};

// Formation ou habilitation obtenue par un salarié (une ligne par session suivie).
export type Formation = {
  id: string;
  salarieId: string;
  type: string; // code du référentiel (lib/formations.ts), "autre" pour une formation libre
  intitule: string; // précision : catégories CACES, niveau d'habilitation, intitulé d'une formation libre…
  obtenueLe: string; // AAAA-MM-JJ
  expireLe: string; // AAAA-MM-JJ, "" si sans limite de validité
  organisme: string;
  attestation?: { chemin: string; nom: string }; // fichier dans le stockage Supabase (bucket « attestations »)
  actionId?: string; // action du plan de prévention à l'origine de la formation
};

// Formation exigée pour un poste (ex. CACES R489 pour les caristes).
export type Exigence = {
  id: string;
  poste: string;
  type: string;
};

// Équipement soumis à vérification périodique (extincteurs, installation électrique, chariots…).
export type Equipement = {
  id: string;
  type: string; // code du référentiel (lib/verifications.ts), "autre" pour un équipement libre
  nom: string; // désignation : « Chariot Linde n° 3 », « Parc d'extincteurs (18) »…
  localisation: string;
  reference: string; // numéro de série ou d'inventaire
  periodicite: number; // en mois
  prestataire: string; // organisme ou entreprise qui vérifie habituellement
};

export type ResultatVerification = "conforme" | "observations" | "non-conforme";

// Observation d'un rapport de vérification, suivie jusqu'à sa levée.
export type Observation = {
  id: string;
  texte: string;
  leveeLe: string; // AAAA-MM-JJ, "" tant qu'elle n'est pas levée
  actionId?: string; // action du plan de prévention créée pour la lever
};

export type Verification = {
  id: string;
  equipementId: string;
  date: string; // AAAA-MM-JJ
  prestataire: string;
  resultat: ResultatVerification;
  prochaine: string; // AAAA-MM-JJ, date de la prochaine vérification
  observations: Observation[];
  rapport?: { chemin: string; nom: string }; // fichier dans le stockage Supabase
};

export type Salarie = {
  id: string;
  nom: string;
  service: string;
  poste: string;
  // Taille habituelle par catégorie d'EPI (ex. { Mains: "9", Pieds: "42" })
  tailles: Record<string, string>;
};

export type Article = {
  id: string;
  nom: string;
  categorie: string;
  tailles: string[];
  prix: number; // € HT unitaire
  delai: number; // délai de livraison en jours
  lot: number; // conditionnement minimal de commande
  tampons: Record<string, number>; // stock tampon par taille
};

export type Mouvement = {
  id: string;
  date: string; // AAAA-MM-JJ
  type: "entree" | "sortie";
  articleId: string;
  taille: string;
  quantite: number;
  salarieId: string; // "" pour une entrée
  service: string;
  motif: string;
  signatureId?: string; // signature du salarié reconnaissant la remise (voir Donnees.signatures)
};

// Une signature peut couvrir plusieurs remises : l'image n'est stockée qu'une fois.
export type Signature = {
  image: string; // PNG en data URL
  date: string; // AAAA-MM-JJ
  salarieId: string;
};

// Informations reprises sur la page de garde du document unique.
export type FicheEntreprise = {
  siret: string;
  adresse: string;
  activite: string;
  effectif: string;
  responsable: string; // employeur ou personne qui établit le document
  heures?: string; // heures travaillées sur 12 mois, pour les taux de fréquence et de gravité
};

export type Donnees = {
  version: 1;
  entreprise: string;
  fiche?: FicheEntreprise;
  services: string[];
  unites: string[];
  duerp: LigneDuerp[];
  actions: Action[];
  evenements: Evenement[];
  formations: Formation[];
  exigences: Exigence[];
  equipements: Equipement[];
  verifications: Verification[];
  salaries: Salarie[];
  articles: Article[];
  mouvements: Mouvement[];
  signatures?: Record<string, Signature>;
  preferences?: { alertesEmail?: boolean }; // récapitulatif hebdomadaire par e-mail (activé par défaut)
};
