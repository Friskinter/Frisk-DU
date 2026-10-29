// Modèle de données de Frisk Plateforme (DUERP, pénibilité, EPI).

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
  visiteId?: string; // visite ou audit à l'origine de l'action (non-conformité relevée)
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
  photos?: { chemin: string; nom: string }[]; // fichiers dans le stockage Supabase (bucket « attestations »)
  signalement?: { par: string; recuLe: string }; // signalé par un salarié depuis le lien de signalement (date et heure ISO)
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

// Produit chimique utilisé dans l'entreprise (inventaire du risque chimique).
export type Produit = {
  id: string;
  nom: string;
  fournisseur: string;
  reference: string; // référence commerciale
  usage: string; // à quoi il sert, comment il est utilisé
  unite: string; // unité de travail du DUERP
  stockage: string;
  quantite: string; // quantité utilisée par an, en texte libre (ex. « 40 L »)
  mentionsH: string[]; // mentions de danger de la FDS (ex. « H225 », « H350 »)
  fds?: { chemin: string; nom: string }; // fiche de données de sécurité (stockage Supabase)
  fdsDate: string; // date de révision de la FDS, AAAA-MM-JJ
  epi: string; // protections à porter (notice de poste)
  consignes: string; // consignes d'utilisation et en cas d'accident (notice de poste)
  risqueId: string; // risque du DUERP concerné
  substitution: string; // recherche d'un produit moins dangereux (obligatoire pour les CMR)
  salariesExposes: string[];
  actif: boolean; // false : produit retiré, conservé pour mémoire
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
  salarieId: string; // "" pour un signataire qui n'est pas salarié (entreprise extérieure…)
  nom?: string; // nom et qualité du signataire, quand ce n'est pas un salarié
};

// Plan de prévention d'une entreprise extérieure (art. R4512-6 et suivants du Code du travail).
export type RisqueIntervention = {
  id: string;
  phase: string; // phase de travail, zone ou situation d'interférence
  risque: string;
  mesures: string;
  charge: "eu" | "ee" | "commun"; // mesures à la charge de l'entreprise utilisatrice, extérieure, ou des deux
};

export type SuiviIntervention = {
  id: string;
  date: string;
  type: "inspection" | "reunion";
  observations: string;
};

// Accueil sécurité d'un nouvel arrivant (art. R4141-2 et suivants du Code du travail).
export type Accueil = {
  id: string;
  salarieId: string; // "" : personne absente de la liste des salariés (intérimaire, stagiaire…)
  nom: string; // nom de la personne quand elle n'est pas dans la liste
  contrat: "cdi" | "cdd" | "interim" | "stage" | "apprentissage" | "autre";
  poste: string;
  unite: string; // unité de travail : ses risques du DUERP figurent sur la fiche d'accueil
  arriveeLe: string;
  accueilLe: string; // "" tant que l'accueil n'a pas eu lieu
  animateur: string;
  points: string[]; // codes des points abordés (lib/accueils.ts)
  posteARisque: boolean; // poste présentant des risques particuliers : formation renforcée (art. L4154-2)
  complement: string;
  signatureId?: string; // signature du nouvel arrivant (Donnees.signatures)
};

// Causerie sécurité (« quart d'heure sécurité ») avec émargement des participants.
export type Causerie = {
  id: string;
  date: string;
  theme: string;
  animateur: string;
  duree: number; // minutes
  messages: string; // messages clés transmis
  remarques: string; // questions et remontées des participants
  participants: { id: string; salarieId: string; nom: string; signatureId?: string }[];
};

// Visites et audits terrain : une grille de points à contrôler, remplie sur place.
export type PointGrille = { id: string; theme: string; question: string };

export type GrilleAudit = {
  id: string;
  nom: string;
  description: string;
  points: PointGrille[];
};

export type ResultatPoint = "" | "conforme" | "non-conforme" | "sans-objet";

export type ReponseVisite = {
  id: string; // identifiant du point de la grille
  theme: string;
  question: string; // recopiés : modifier la grille ne change pas les visites passées
  resultat: ResultatPoint;
  commentaire: string;
  photo?: { chemin: string; nom: string };
  actionId?: string; // action du plan créée pour une non-conformité
};

export type Visite = {
  id: string;
  grille: string; // nom de la grille utilisée
  date: string;
  unite: string;
  auditeur: string;
  participants: string;
  reponses: ReponseVisite[];
  synthese: string;
  clotureeLe: string; // AAAA-MM-JJ, "" tant que la visite est en cours
};

// Protocole de sécurité des opérations de chargement et de déchargement (art. R4515-4 et suivants) :
// il remplace le plan de prévention pour les transporteurs.
export type Protocole = {
  id: string;
  transporteur: string;
  siret: string;
  contact: string; // représentant du transporteur (nom, fonction)
  telephone: string;
  email: string;
  operation: "chargement" | "dechargement" | "les-deux";
  permanent: boolean; // opérations répétitives : un protocole unique (art. R4515-8)
  debut: string; // date de l'opération, ou début de validité
  fin: string; // fin de validité (égale au début pour une opération ponctuelle)
  // Informations de l'entreprise d'accueil (art. R4515-6)
  lieu: string; // lieu de livraison ou de prise en charge
  acces: string; // modalités d'accès et de stationnement
  circulation: string; // plan et consignes de circulation
  materiels: string; // matériels et engins utilisés pour l'opération
  consignes: string; // consignes de sécurité de l'opération
  secours: string; // moyens de secours en cas d'accident ou d'incident
  responsable: string; // responsable désigné par l'entreprise d'accueil
  // Informations du transporteur (art. R4515-7)
  vehicules: string; // caractéristiques, aménagement et équipements des véhicules
  marchandises: string; // nature et conditionnement
  precautions: string; // précautions particulières liées aux marchandises
  matieresDangereuses: boolean; // transport soumis à la réglementation des matières dangereuses (ADR)
  signatureAccueil?: string; // identifiants dans Donnees.signatures
  signatureTransporteur?: string;
  notes: string;
};

export type Intervention = {
  id: string;
  entreprise: string; // entreprise extérieure
  siret: string;
  responsable: string; // représentant de l'entreprise extérieure (nom, fonction)
  telephone: string;
  email: string;
  objet: string; // nature des travaux
  lieux: string; // lieux et unités de travail concernés
  debut: string;
  fin: string;
  effectif: number; // nombre prévisible de travailleurs de l'entreprise extérieure
  heures: number; // durée prévisible des travaux, en heures, sur 12 mois
  sousTraitants: string;
  travauxDangereux: string[]; // codes de la liste de l'arrêté du 19 mars 1993
  coordinateur: string; // représentant de l'entreprise utilisatrice
  inspectionLe: string; // inspection commune préalable
  inspectionPar: string;
  risques: RisqueIntervention[];
  consignes: string; // instructions données aux travailleurs : accès, circulation, zones interdites
  materiels: string; // matériels et installations mis à disposition, adaptations
  secours: string; // premiers secours, moyens d'alerte, numéros d'urgence
  suivi: SuiviIntervention[];
  signatureEu?: string; // identifiants dans Donnees.signatures
  signatureEe?: string;
  notes: string;
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
  produits: Produit[];
  interventions: Intervention[];
  protocoles: Protocole[];
  grilles: GrilleAudit[];
  visites: Visite[];
  accueils: Accueil[];
  causeries: Causerie[];
  salaries: Salarie[];
  articles: Article[];
  mouvements: Mouvement[];
  signatures?: Record<string, Signature>;
  identite?: Identite; // logo et couleur de l'entreprise (lib/identite.ts)
  preferences?: {
    alertesEmail?: boolean; // récapitulatif hebdomadaire par e-mail (activé par défaut)
    syntheses?: Record<string, string>; // synthèse de l'employeur du rapport annuel, par année
    assistantMasque?: boolean; // assistant de démarrage masqué par le responsable
  };
};

export type Identite = {
  logo?: string; // image PNG en data URL, redimensionnée dans le navigateur
  couleur?: string; // « #rrggbb », choisie par le client
  site?: string; // site web dont le logo et la couleur ont été tirés
};
