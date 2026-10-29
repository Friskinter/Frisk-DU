// Bibliothèque de risques par métier : éléments communs (types, situations partagées, blocs réutilisables).
// Les cotations sont des valeurs typiques, à ajuster à la situation réelle de l'entreprise.

export type ModeleRisque = {
  unite: string;
  activite: string;
  danger: string;
  risque: string;
  gravite: number;
  frequence: number;
  prevention: string; // mesure de prévention conseillée
  penibilite?: string; // code du facteur de pénibilité éventuel
};

export type Metier = {
  id: string;
  nom: string;
  domaine: string; // identifiant du domaine d'activité (lib/bibliotheque.ts)
  description: string;
  risques: ModeleRisque[];
};

export const r = (
  unite: string,
  activite: string,
  danger: string,
  risque: string,
  gravite: number,
  frequence: number,
  prevention: string,
  penibilite?: string,
): ModeleRisque => ({ unite, activite, danger, risque, gravite, frequence, prevention, penibilite });

// Situations communes à presque toutes les entreprises.
export const communs: ModeleRisque[] = [
  r("Toute l'entreprise", "Déplacements dans les locaux", "Chute de plain-pied", "Entorse, fracture", 2, 3, "Sols dégagés et entretenus, nettoyage des zones humides, éclairage suffisant des passages"),
  r("Toute l'entreprise", "Utilisation des installations électriques", "Électricité", "Électrisation, brûlure", 4, 1, "Vérification périodique des installations, interdiction des multiprises en cascade"),
  r("Toute l'entreprise", "Présence dans les locaux", "Incendie et explosion", "Brûlures, intoxication par les fumées", 4, 1, "Extincteurs vérifiés, consignes et plan d'évacuation affichés, exercice annuel, désignation de guides-files"),
];

export const bureau: ModeleRisque[] = [
  r("Bureaux", "Travail sur écran", "Travail sur écran", "Fatigue visuelle, TMS de la nuque et des poignets", 2, 4, "Postes réglables (écran, siège, éclairage), pauses régulières, sensibilisation aux bonnes postures"),
  r("Bureaux", "Organisation et charge de travail", "Risques psychosociaux", "Stress, épuisement professionnel", 3, 3, "Entretiens réguliers, répartition de la charge, droit à la déconnexion, procédure de signalement"),
  r("Bureaux", "Déplacements professionnels", "Déplacements routiers", "Accident de la route", 4, 2, "Privilégier la visioconférence, planification des trajets, entretien des véhicules, pas de téléphone au volant"),
  r("Bureaux", "Rangement et archivage", "Chute de hauteur", "Chute d'un escabeau, fracture", 3, 1, "Escabeau stable avec garde-corps, archives lourdes rangées en bas"),
  r("Bureaux", "Accueil du public", "Agression physique ou verbale", "Choc psychologique, blessures", 3, 2, "Formation à la gestion des conflits, aménagement de l'accueil, procédure d'alerte"),
];


// Blocs de risques réutilisés d'un métier à l'autre, pour une unité de travail donnée.
export const b = {
  hauteur: (u: string, activite = "Travail en hauteur (échafaudage, nacelle, toiture)") =>
    r(u, activite, "Chute de hauteur", "Fracture grave, décès", 4, 3, "Protections collectives (garde-corps, filets), échafaudages et nacelles vérifiés, harnais en dernier recours, formation au travail en hauteur"),
  escabeau: (u: string) =>
    r(u, "Travail sur escabeau ou plateforme", "Chute de hauteur", "Entorse, fracture", 3, 2, "Plateformes individuelles roulantes, escabeau avec garde-corps, pas de travail sur échelle simple ni sur chaise"),
  manutention: (u: string, activite = "Port de charges", gravite = 3, frequence = 3) =>
    r(u, activite, "Manutention manuelle", "Lombalgies, TMS", gravite, frequence, "Aides à la manutention (diable, chariot, transpalette, palan), charges limitées, travail à deux pour les charges lourdes, formation gestes et postures", "manutention"),
  postures: (u: string, activite = "Travail dans des postures contraignantes") =>
    r(u, activite, "Postures pénibles", "TMS du dos, des épaules et des genoux", 3, 3, "Plans de travail à bonne hauteur, genouillères ou sièges adaptés, alternance des tâches, pauses", "postures"),
  repetitif: (u: string, activite = "Gestes répétés à cadence soutenue") =>
    r(u, activite, "Gestes répétitifs", "TMS des membres supérieurs", 3, 4, "Rotation des postes, outils ergonomiques, cadences adaptées, étude ergonomique des postes", "repetitif"),
  bruit: (u: string, activite = "Travail sur machines et outils bruyants") =>
    r(u, activite, "Bruit", "Surdité, acouphènes, fatigue", 3, 4, "Machines et outils moins bruyants, capotage, protections auditives adaptées, mesure du bruit, suivi audiométrique", "bruit"),
  vibrations: (u: string, activite = "Utilisation d'outils vibrants") =>
    r(u, activite, "Vibrations", "Troubles vasculaires et articulaires", 3, 3, "Outils à faibles vibrations, gants anti-vibrations, limitation de la durée d'exposition, entretien des outils", "vibrations"),
  chimique: (u: string, activite: string, risque: string, gravite = 3, frequence = 3) =>
    r(u, activite, "Produits chimiques", risque, gravite, frequence, "Substitution par des produits moins dangereux, ventilation ou captage, gants et protections adaptés, fiches de données de sécurité disponibles, formation au risque chimique", "chimique"),
  poussieres: (u: string, activite: string, risque: string) =>
    r(u, activite, "Produits chimiques", risque, 4, 3, "Outils avec aspiration, travail à l'humide, nettoyage par aspiration et non au balai, masque FFP3, suivi médical", "chimique"),
  entretien: (u: string) =>
    r(u, "Nettoyage et désinfection", "Produits chimiques", "Irritations, brûlures chimiques, allergies", 2, 3, "Produits moins dangereux et prédosés, gants et lunettes, ne jamais mélanger les produits, fiches de données de sécurité disponibles", "chimique"),
  coupures: (u: string, activite = "Utilisation de couteaux, cutters et outils tranchants") =>
    r(u, activite, "Coupures", "Coupures des mains", 2, 4, "Outils adaptés et entretenus, cutters à lame rétractable, gants anti-coupure, rangement sécurisé des lames"),
  machines: (u: string, activite: string, risque = "Coupure, écrasement, amputation") =>
    r(u, activite, "Machines et outils", risque, 4, 3, "Machines conformes avec protecteurs et arrêt d'urgence, vérifications périodiques, consignation avant maintenance, formation à l'utilisation"),
  electrique: (u: string, activite = "Interventions sur installations ou équipements électriques") =>
    r(u, activite, "Électricité", "Électrocution, brûlures", 4, 2, "Habilitation électrique, consignation et vérification d'absence de tension, outillage isolé, interdiction des interventions improvisées"),
  pointChaud: (u: string, activite = "Soudage, découpe, travaux par point chaud") =>
    r(u, activite, "Incendie et explosion", "Brûlures, incendie", 3, 3, "Permis de feu, extincteur à portée, éloignement des matières combustibles, surveillance après travaux"),
  route: (u = "Trajets", activite = "Déplacements professionnels en véhicule") =>
    r(u, activite, "Déplacements routiers", "Accident de la route", 4, 3, "Véhicules entretenus et équipés, chargement arrimé, trajets planifiés, pas de téléphone au volant"),
  engins: (u: string, activite = "Circulation et manœuvres d'engins") =>
    r(u, activite, "Circulation interne (chariots, piétons)", "Écrasement, collision", 4, 3, "Plan de circulation, séparation piétons-engins, conducteurs formés et autorisés, gilets haute visibilité, vérification des engins"),
  chaleur: (u: string, activite = "Travail en extérieur") =>
    r(u, activite, "Ambiances thermiques", "Coup de chaleur, hypothermie", 3, 3, "Horaires adaptés en cas de canicule ou de grand froid, eau fraîche, abris, vêtements adaptés", "temperatures"),
  froid: (u: string, activite = "Travail en chambre froide ou au froid") =>
    r(u, activite, "Ambiances thermiques", "Engelures, troubles musculaires", 3, 3, "Vêtements chauds fournis, temps de séjour limité, ouverture intérieure des portes de chambre froide", "temperatures"),
  isole: (u: string, activite = "Travail seul") =>
    r(u, activite, "Travail isolé", "Absence de secours en cas d'accident ou de malaise", 3, 2, "Dispositif d'alarme pour travailleur isolé, téléphone, procédure de contact régulier"),
  agression: (u: string, activite = "Relation avec le public ou la clientèle") =>
    r(u, activite, "Agression physique ou verbale", "Choc psychologique, blessures", 3, 2, "Formation à la gestion des conflits, aménagement des lieux d'accueil, procédure d'alerte et de signalement"),
  rps: (u: string, activite = "Charge de travail et organisation", risque = "Stress, épuisement professionnel") =>
    r(u, activite, "Risques psychosociaux", risque, 3, 3, "Répartition de la charge, plannings anticipés, entretiens réguliers, soutien de l'encadrement"),
  nuit: (u: string, activite = "Travail de nuit ou en horaires décalés") =>
    r(u, activite, "Risques psychosociaux", "Fatigue, troubles du sommeil", 3, 3, "Plannings stables et anticipés, temps de repos respectés, suivi médical renforcé du travail de nuit", "nuit"),
  ecran: (u: string) =>
    r(u, "Travail sur écran", "Travail sur écran", "Fatigue visuelle, TMS de la nuque et des poignets", 2, 4, "Postes réglables (écran, siège, éclairage), pauses régulières, sensibilisation aux bonnes postures"),
  glissade: (u: string, activite = "Déplacements sur sols glissants ou encombrés") =>
    r(u, activite, "Chute de plain-pied", "Entorse, fracture", 2, 4, "Chaussures antidérapantes, nettoyage immédiat des déversements, passages dégagés et éclairés"),
  biologique: (u: string, activite: string, risque = "Infections") =>
    r(u, activite, "Agents biologiques", risque, 3, 3, "Gants, hygiène des mains, vaccinations recommandées, procédure en cas d'exposition"),
  chuteObjets: (u: string, activite = "Stockage et travail sous des charges") =>
    r(u, activite, "Chute d'objets", "Traumatisme, écrasement", 3, 3, "Rayonnages et stockages stables et vérifiés, charges lourdes en bas, casque et chaussures de sécurité"),
};
