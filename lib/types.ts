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
};

export type Donnees = {
  version: 1;
  entreprise: string;
  fiche?: FicheEntreprise;
  services: string[];
  unites: string[];
  duerp: LigneDuerp[];
  actions: Action[];
  salaries: Salarie[];
  articles: Article[];
  mouvements: Mouvement[];
  signatures?: Record<string, Signature>;
  preferences?: { alertesEmail?: boolean }; // récapitulatif hebdomadaire par e-mail (activé par défaut)
};
