// Bibliothèque de risques par métier : situations courantes pour démarrer un DUERP.
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
  description: string;
  risques: ModeleRisque[];
};

const r = (
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
const communs: ModeleRisque[] = [
  r("Toute l'entreprise", "Déplacements dans les locaux", "Chute de plain-pied", "Entorse, fracture", 2, 3, "Sols dégagés et entretenus, nettoyage des zones humides, éclairage suffisant des passages"),
  r("Toute l'entreprise", "Utilisation des installations électriques", "Électricité", "Électrisation, brûlure", 4, 1, "Vérification périodique des installations, interdiction des multiprises en cascade"),
  r("Toute l'entreprise", "Présence dans les locaux", "Incendie et explosion", "Brûlures, intoxication par les fumées", 4, 1, "Extincteurs vérifiés, consignes et plan d'évacuation affichés, exercice annuel, désignation de guides-files"),
];

const bureau: ModeleRisque[] = [
  r("Bureaux", "Travail sur écran", "Travail sur écran", "Fatigue visuelle, TMS de la nuque et des poignets", 2, 4, "Postes réglables (écran, siège, éclairage), pauses régulières, sensibilisation aux bonnes postures"),
  r("Bureaux", "Organisation et charge de travail", "Risques psychosociaux", "Stress, épuisement professionnel", 3, 3, "Entretiens réguliers, répartition de la charge, droit à la déconnexion, procédure de signalement"),
  r("Bureaux", "Déplacements professionnels", "Déplacements routiers", "Accident de la route", 4, 2, "Privilégier la visioconférence, planification des trajets, entretien des véhicules, pas de téléphone au volant"),
  r("Bureaux", "Rangement et archivage", "Chute de hauteur", "Chute d'un escabeau, fracture", 3, 1, "Escabeau stable avec garde-corps, archives lourdes rangées en bas"),
  r("Bureaux", "Accueil du public", "Agression physique ou verbale", "Choc psychologique, blessures", 3, 2, "Formation à la gestion des conflits, aménagement de l'accueil, procédure d'alerte"),
];

export const metiers: Metier[] = [
  {
    id: "bureau",
    nom: "Bureaux et services",
    description: "Activités administratives, conseil, agences, professions libérales.",
    risques: [...bureau, ...communs],
  },
  {
    id: "commerce",
    nom: "Commerce de détail",
    description: "Magasins, boutiques, supérettes.",
    risques: [
      r("Réserve", "Réception et rangement des livraisons", "Manutention manuelle", "Lombalgies, TMS", 3, 3, "Diable ou transpalette, colis limités en poids, formation gestes et postures", "manutention"),
      r("Réserve", "Rangement en hauteur", "Chute de hauteur", "Chute d'escabeau, fracture", 3, 2, "Escabeau ou plateforme avec garde-corps, produits lourds stockés en bas"),
      r("Réserve", "Ouverture des cartons", "Coupures", "Coupure des mains", 2, 4, "Cutters à lame rétractable, gants anti-coupure"),
      r("Surface de vente", "Mise en rayon", "Postures pénibles", "TMS des épaules et du dos", 2, 4, "Alternance des tâches, marchepieds, rangement des produits lourds à hauteur de taille", "postures"),
      r("Caisse", "Encaissement", "Gestes répétitifs", "TMS des poignets et des épaules", 2, 4, "Poste de caisse ergonomique, siège assis-debout, rotation des postes"),
      r("Caisse", "Relation avec la clientèle", "Agression physique ou verbale", "Choc psychologique, blessures", 3, 2, "Formation à la gestion des conflits, vidéoprotection, procédure en cas de vol ou d'agression"),
      r("Surface de vente", "Ouverture et fermeture du magasin", "Travail isolé", "Absence de secours en cas d'accident ou d'agression", 3, 2, "Ouverture et fermeture à deux, téléphone ou alarme portative"),
      ...communs,
    ],
  },
  {
    id: "restauration",
    nom: "Restauration",
    description: "Restaurants, cafés, cantines, traiteurs.",
    risques: [
      r("Cuisine", "Cuisson et utilisation des fours", "Ambiances thermiques", "Brûlures, coup de chaleur", 3, 4, "Gants et manchettes anti-chaleur, hotte entretenue, pauses et hydratation", "temperatures"),
      r("Cuisine", "Découpe et préparation", "Coupures", "Coupures des mains", 2, 4, "Couteaux affûtés et rangés, gant anti-coupure pour les découpes, trancheuse avec protecteur"),
      r("Cuisine", "Déplacements sur sols gras ou humides", "Chute de plain-pied", "Entorse, fracture, brûlure", 3, 4, "Chaussures antidérapantes, nettoyage immédiat des déversements, sol antidérapant"),
      r("Cuisine", "Utilisation de produits d'entretien", "Produits chimiques", "Irritations, brûlures chimiques", 2, 3, "Produits moins dangereux, gants et lunettes, fiches de données de sécurité disponibles", "chimique"),
      r("Réserve", "Chambre froide", "Ambiances thermiques", "Engelures, enfermement", 3, 3, "Ouverture intérieure de la porte, vêtements adaptés, temps de séjour limité"),
      r("Réserve", "Réception des livraisons", "Manutention manuelle", "Lombalgies", 3, 3, "Chariot, livraisons au plus près du stockage, charges réduites", "manutention"),
      r("Salle", "Service en salle", "Postures pénibles", "Fatigue, TMS, troubles veineux", 2, 4, "Plateaux légers, organisation des déplacements, pauses"),
      r("Salle", "Horaires du soir et coupures", "Risques psychosociaux", "Fatigue, stress", 2, 3, "Plannings anticipés, respect des temps de repos, coupures limitées"),
      ...communs,
    ],
  },
  {
    id: "btp",
    nom: "BTP",
    description: "Gros œuvre, second œuvre, rénovation, travaux publics.",
    risques: [
      r("Chantier", "Travail en hauteur (toiture, échafaudage)", "Chute de hauteur", "Fracture grave, décès", 4, 3, "Protections collectives (garde-corps, filets), échafaudages vérifiés, harnais en dernier recours, formation"),
      r("Chantier", "Port de matériaux", "Manutention manuelle", "Lombalgies, hernie discale", 3, 4, "Aides à la manutention (grue, monte-charge, diable), sacs de 25 kg maximum, travail en binôme", "manutention"),
      r("Chantier", "Travail à genoux, bras levés", "Postures pénibles", "TMS des genoux, des épaules et du dos", 3, 4, "Genouillères, outils à manche long, plateformes de travail, rotation des tâches", "postures"),
      r("Chantier", "Utilisation d'outils électroportatifs", "Vibrations", "Troubles vasculaires et articulaires", 3, 3, "Outils à faibles vibrations, gants anti-vibrations, limitation de la durée d'exposition", "vibrations"),
      r("Chantier", "Découpe, perçage, démolition", "Bruit", "Surdité", 3, 4, "Outils moins bruyants, protections auditives adaptées, suivi audiométrique", "bruit"),
      r("Chantier", "Découpe de matériaux, ponçage", "Produits chimiques", "Maladies respiratoires (silice, poussières de bois)", 4, 3, "Découpe à l'eau ou avec aspiration, masques FFP3, repérage amiante avant travaux", "chimique"),
      r("Chantier", "Circulation d'engins", "Circulation interne (chariots, piétons)", "Écrasement, collision", 4, 3, "Plan de circulation, balisage, conducteurs formés et autorisés, gilets haute visibilité"),
      r("Chantier", "Travail en extérieur", "Ambiances thermiques", "Coup de chaleur, hypothermie", 3, 3, "Aménagement des horaires en cas de canicule, eau fraîche, abris, vêtements adaptés", "temperatures"),
      r("Chantier", "Interventions près de réseaux", "Électricité", "Électrocution", 4, 2, "Déclaration de travaux (DT-DICT), consignation, habilitation électrique"),
      r("Trajets", "Déplacements vers les chantiers", "Déplacements routiers", "Accident de la route", 4, 4, "Véhicules entretenus et équipés, chargement arrimé, temps de trajet planifiés"),
    ],
  },
  {
    id: "logistique",
    nom: "Logistique et entrepôt",
    description: "Entreposage, préparation de commandes, messagerie.",
    risques: [
      r("Quai", "Chargement et déchargement", "Manutention manuelle", "Lombalgies, TMS", 3, 4, "Transpalettes électriques, tables élévatrices, formation gestes et postures", "manutention"),
      r("Quai", "Circulation près des quais", "Chute de hauteur", "Chute du quai, fractures", 4, 3, "Barrières de quai, cales de roues, signalisation des niveleurs"),
      r("Entrepôt", "Conduite de chariots élévateurs", "Circulation interne (chariots, piétons)", "Collision, écrasement, renversement", 4, 4, "Autorisation de conduite et CACES, allées piétonnes séparées, vérification des chariots", "vibrations"),
      r("Entrepôt", "Prélèvement en hauteur", "Chute d'objets", "Traumatisme crânien", 3, 3, "Rayonnages vérifiés, filets anti-chute, casques, charges lourdes en bas"),
      r("Préparation", "Préparation de commandes", "Gestes répétitifs", "TMS des membres supérieurs", 3, 4, "Rotation des postes, aménagement des hauteurs de prise, cadences adaptées", "repetitif"),
      r("Entrepôt", "Ouverture des colis", "Coupures", "Coupures", 2, 4, "Cutters à lame rétractable, gants anti-coupure"),
      r("Entrepôt", "Travail en équipes ou de nuit", "Risques psychosociaux", "Fatigue, troubles du sommeil", 3, 3, "Plannings stables, limitation des postes de nuit, suivi médical adapté", "nuit"),
      ...communs,
    ],
  },
  {
    id: "atelier",
    nom: "Industrie et atelier",
    description: "Fabrication, mécanique, métallerie, menuiserie.",
    risques: [
      r("Atelier", "Utilisation de machines", "Machines et outils", "Coupure, écrasement, amputation", 4, 3, "Machines conformes avec protecteurs, vérifications périodiques, consignation pour la maintenance, formation"),
      r("Atelier", "Usinage, meulage, découpe", "Bruit", "Surdité", 3, 4, "Capotage des machines, protections auditives, mesure du bruit, suivi audiométrique", "bruit"),
      r("Atelier", "Soudage", "Produits chimiques", "Intoxication par les fumées, brûlures oculaires", 3, 3, "Aspiration à la source, écran de soudage, vêtements ignifugés", "chimique"),
      r("Atelier", "Projection de copeaux et particules", "Machines et outils", "Blessure aux yeux", 3, 3, "Lunettes de protection, écrans sur machines"),
      r("Atelier", "Manutention de pièces", "Manutention manuelle", "Lombalgies, écrasement des pieds", 3, 3, "Palans, potences, chaussures de sécurité", "manutention"),
      r("Atelier", "Travail sur poste répétitif", "Gestes répétitifs", "TMS des membres supérieurs", 3, 4, "Rotation des postes, outillage adapté, étude ergonomique", "repetitif"),
      r("Atelier", "Utilisation d'outils pneumatiques", "Vibrations", "Troubles vasculaires et articulaires", 3, 3, "Outils à faibles vibrations, temps d'exposition limité", "vibrations"),
      r("Atelier", "Utilisation de solvants, huiles de coupe", "Produits chimiques", "Dermatoses, intoxication", 3, 3, "Substitution, gants adaptés, ventilation, fiches de données de sécurité", "chimique"),
      ...communs,
    ],
  },
  {
    id: "garage",
    nom: "Garage automobile",
    description: "Mécanique, carrosserie, entretien de véhicules.",
    risques: [
      r("Atelier mécanique", "Travail sous véhicule sur pont élévateur", "Chute d'objets", "Écrasement", 4, 3, "Pont vérifié, chandelles de sécurité, procédure de levage"),
      r("Atelier mécanique", "Vidanges et utilisation de produits", "Produits chimiques", "Dermatoses, intoxication", 3, 4, "Gants nitrile, fontaine de dégraissage biologique, fiches de données de sécurité", "chimique"),
      r("Atelier mécanique", "Moteurs en marche en atelier", "Produits chimiques", "Intoxication aux gaz d'échappement", 3, 3, "Captage des gaz à la source, ventilation de l'atelier"),
      r("Carrosserie", "Peinture et ponçage", "Produits chimiques", "Maladies respiratoires, allergies", 4, 3, "Cabine de peinture ventilée, masque à cartouche, ponceuses avec aspiration", "chimique"),
      r("Atelier mécanique", "Travail sous capot, sous véhicule", "Postures pénibles", "TMS du dos et des épaules", 2, 4, "Fosse ou pont à hauteur, sièges de mécanicien, rotation des tâches", "postures"),
      r("Atelier mécanique", "Intervention sur véhicules électriques", "Électricité", "Électrocution", 4, 2, "Habilitation électrique véhicules, outillage isolé, procédure de consignation"),
      r("Atelier mécanique", "Démontage de pneus et pièces lourdes", "Manutention manuelle", "Lombalgies", 3, 3, "Lève-roues, démonte-pneus, chariots", "manutention"),
      ...communs,
    ],
  },
  {
    id: "nettoyage",
    nom: "Propreté et nettoyage",
    description: "Entreprises de nettoyage, entretien des locaux.",
    risques: [
      r("Interventions", "Utilisation de produits d'entretien", "Produits chimiques", "Irritations, brûlures, allergies", 3, 4, "Produits moins dangereux et prédosés, gants, ne jamais mélanger les produits", "chimique"),
      r("Interventions", "Lavage des sols", "Chute de plain-pied", "Entorse, fracture", 2, 4, "Chaussures antidérapantes, panneaux « sol glissant », nettoyage par moitié"),
      r("Interventions", "Lavage, balayage, aspiration", "Gestes répétitifs", "TMS des épaules et des poignets", 3, 4, "Matériel ergonomique (manches télescopiques, autolaveuses), alternance des tâches", "repetitif"),
      r("Interventions", "Nettoyage des vitres en hauteur", "Chute de hauteur", "Fracture", 4, 2, "Perches télescopiques, plateformes avec garde-corps, pas de travail sur chaise ou escabeau instable"),
      r("Interventions", "Travail tôt le matin ou le soir, seul", "Travail isolé", "Absence de secours, agression", 3, 3, "Dispositif d'alarme pour travailleur isolé, procédure de contrôle de présence"),
      r("Interventions", "Horaires décalés", "Risques psychosociaux", "Fatigue, troubles du sommeil", 2, 3, "Horaires en journée quand c'est possible, plannings stables"),
      r("Trajets", "Déplacements entre les sites", "Déplacements routiers", "Accident de la route", 4, 3, "Tournées planifiées, véhicules entretenus, temps de trajet réalistes"),
    ],
  },
  {
    id: "aide-domicile",
    nom: "Aide et soin à domicile",
    description: "Aide à domicile, soins infirmiers, services à la personne.",
    risques: [
      r("Domiciles", "Aide à la toilette et aux transferts", "Manutention manuelle", "Lombalgies, TMS", 3, 4, "Aides techniques (lève-personne, draps de glisse), formation aux transferts, travail à deux si besoin", "manutention"),
      r("Domiciles", "Trajets entre les domiciles", "Déplacements routiers", "Accident de la route", 4, 4, "Tournées optimisées, temps de trajet inclus, véhicules entretenus"),
      r("Domiciles", "Relation avec les bénéficiaires et familles", "Agression physique ou verbale", "Choc psychologique, blessures", 3, 2, "Formation, procédure de signalement, possibilité de refuser une intervention à risque"),
      r("Domiciles", "Confrontation à la maladie, la fin de vie", "Risques psychosociaux", "Stress, épuisement professionnel", 3, 3, "Groupes de parole, soutien de l'encadrement, réunions d'équipe"),
      r("Domiciles", "Soins et contact avec les fluides", "Agents biologiques", "Infections", 3, 2, "Gants, hygiène des mains, vaccinations recommandées, procédure en cas d'accident d'exposition au sang"),
      r("Domiciles", "Entretien du logement", "Produits chimiques", "Irritations", 2, 3, "Produits fournis et adaptés, gants"),
      r("Domiciles", "Intervention seule au domicile", "Travail isolé", "Absence de secours", 3, 3, "Téléphone professionnel, procédure de contact en fin d'intervention"),
    ],
  },
  {
    id: "coiffure",
    nom: "Coiffure et esthétique",
    description: "Salons de coiffure, instituts de beauté.",
    risques: [
      r("Salon", "Colorations, permanentes, shampoings", "Produits chimiques", "Eczéma, asthme, allergies", 3, 4, "Gants nitrile, ventilation, produits sans ammoniaque, bacs à shampoing réglables", "chimique"),
      r("Salon", "Coupe et coiffage debout", "Postures pénibles", "TMS des épaules, du dos, troubles veineux", 2, 4, "Sièges clients réglables en hauteur, tabouret assis-debout, ciseaux ergonomiques"),
      r("Salon", "Utilisation de ciseaux et rasoirs", "Coupures", "Coupures", 2, 4, "Matériel entretenu, rangement sécurisé des lames"),
      r("Salon", "Utilisation de sèche-cheveux et fers", "Électricité", "Brûlures, électrisation", 2, 3, "Appareils vérifiés, câbles en bon état, prises éloignées des bacs"),
      r("Salon", "Déplacements sur sol mouillé ou avec cheveux", "Chute de plain-pied", "Entorse, fracture", 2, 3, "Balayage régulier, chaussures fermées antidérapantes"),
      r("Salon", "Relation avec la clientèle", "Risques psychosociaux", "Stress", 2, 3, "Planning des rendez-vous réaliste, pauses"),
      ...communs,
    ],
  },
];
