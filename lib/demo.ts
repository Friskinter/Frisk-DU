// Jeu de données de démonstration : une PME fictive de logistique.

import { nouvelleAction } from "./actions";
import { nouvelEvenement } from "./evenements";
import { ajouterMois, nouvelleExigence, nouvelleFormation } from "./formations";
import { nouveauProduit } from "./produits";
import { nouveauRisqueIntervention, nouveauSuivi, nouvelleIntervention, risqueDuTravail, risquesCourants } from "./interventions";
import { nouvelEquipement, nouvelleObservation, nouvelleVerification } from "./verifications";
import { cle, decalerJours, nouvelId } from "./calculs";
import type { Action, Article, Donnees, Intervention, Evenement, Formation, LigneDuerp, Mouvement, PrincipePrevention, Salarie } from "./types";

// Générateur pseudo-aléatoire déterministe pour des démos reproductibles.
function aleatoire(graine: number) {
  let s = graine;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

export function donneesVides(): Donnees {
  return {
    version: 1,
    entreprise: "Mon entreprise",
    services: [],
    unites: [],
    duerp: [],
    salaries: [],
    articles: [],
    mouvements: [],
    actions: [],
    evenements: [],
    formations: [],
    exigences: [],
    equipements: [],
    verifications: [],
    produits: [],
    interventions: [],
  };
}

export function donneesDemo(aujourdhui: string): Donnees {
  const services = ["Entrepôt", "Atelier", "Livraison", "Administratif"];
  const unites = ["Quai de réception", "Zone de stockage", "Atelier maintenance", "Tournées", "Bureaux"];

  const ligne = (l: Omit<LigneDuerp, "id">): LigneDuerp => ({ id: nouvelId(), ...l });

  const lignes: LigneDuerp[] = [
    ligne({
      unite: "Quai de réception", activite: "Déchargement des camions", danger: "Manutention manuelle",
      risque: "Lombalgies, TMS du dos et des épaules", effectif: 6, gravite: 3, frequence: 4,
      mesures: "Transpalettes manuels, formation gestes et postures en 2024", maitrise: "partielle",
      penibilite: "manutention", seuilPenibilite: "oui", action: "Acheter 2 transpalettes électriques",
      responsable: "Responsable entrepôt", echeance: decalerJours(aujourdhui, 45), statut: "en-cours",
    }),
    ligne({
      unite: "Quai de réception", activite: "Circulation près des quais", danger: "Chute de hauteur",
      risque: "Chute du quai (1,20 m), fractures", effectif: 6, gravite: 4, frequence: 3,
      mesures: "Marquage au sol", maitrise: "insuffisante", penibilite: "", seuilPenibilite: "non",
      action: "Installer des barrières de quai et cales de roues", responsable: "Direction",
      echeance: decalerJours(aujourdhui, -10), statut: "a-faire",
    }),
    ligne({
      unite: "Zone de stockage", activite: "Préparation de commandes en chambre froide", danger: "Ambiances thermiques",
      risque: "Hypothermie, engelures, TMS aggravés par le froid", effectif: 4, gravite: 3, frequence: 4,
      mesures: "Vestes grand froid, pauses en zone tempérée", maitrise: "bonne",
      penibilite: "temperatures", seuilPenibilite: "oui", action: "Rotation des postes toutes les 2 h",
      responsable: "Chef d'équipe", echeance: decalerJours(aujourdhui, 60), statut: "a-faire",
    }),
    ligne({
      unite: "Zone de stockage", activite: "Conduite de chariots élévateurs", danger: "Circulation interne (chariots, piétons)",
      risque: "Collision piéton-chariot, écrasement", effectif: 8, gravite: 4, frequence: 4,
      mesures: "CACES à jour, allées piétonnes marquées", maitrise: "bonne", penibilite: "vibrations",
      seuilPenibilite: "a-evaluer", action: "Installer des feux bleus de signalisation sur les chariots",
      responsable: "Responsable entrepôt", echeance: decalerJours(aujourdhui, 20), statut: "en-cours",
    }),
    ligne({
      unite: "Zone de stockage", activite: "Prélèvement en hauteur", danger: "Chute d'objets",
      risque: "Traumatisme crânien", effectif: 8, gravite: 3, frequence: 2,
      mesures: "Casques fournis, filets anti-chute sur racks", maitrise: "tres-bonne", penibilite: "",
      seuilPenibilite: "non", action: "Poser des filets anti-chute sur les racks", responsable: "Responsable entrepôt",
      echeance: decalerJours(aujourdhui, -60), statut: "fait",
    }),
    ligne({
      unite: "Atelier maintenance", activite: "Meulage et soudure", danger: "Bruit",
      risque: "Surdité professionnelle", effectif: 3, gravite: 3, frequence: 3,
      mesures: "Bouchons d'oreille à disposition", maitrise: "partielle", penibilite: "bruit",
      seuilPenibilite: "a-evaluer", action: "Faire réaliser une mesure de bruit (sonométrie)",
      responsable: "Responsable maintenance", echeance: decalerJours(aujourdhui, 30), statut: "a-faire",
    }),
    ligne({
      unite: "Atelier maintenance", activite: "Utilisation de solvants de dégraissage", danger: "Produits chimiques",
      risque: "Irritations, intoxication, dermatoses", effectif: 3, gravite: 3, frequence: 3,
      mesures: "Gants nitrile, fiches de données de sécurité affichées", maitrise: "bonne",
      penibilite: "chimique", seuilPenibilite: "non", action: "Remplacer par un dégraissant aqueux",
      responsable: "Responsable maintenance", echeance: decalerJours(aujourdhui, 90), statut: "a-faire",
    }),
    ligne({
      unite: "Tournées", activite: "Livraisons en véhicule utilitaire", danger: "Déplacements routiers",
      risque: "Accident de la route", effectif: 5, gravite: 4, frequence: 4,
      mesures: "Véhicules entretenus, planning sans téléphone au volant", maitrise: "partielle",
      penibilite: "", seuilPenibilite: "non", action: "Formation éco-conduite et sécurité routière",
      responsable: "Direction", echeance: decalerJours(aujourdhui, -30), statut: "en-cours",
    }),
    ligne({
      unite: "Tournées", activite: "Livraisons de nuit aux magasins", danger: "Travail isolé",
      risque: "Fatigue, troubles du sommeil, absence de secours", effectif: 2, gravite: 3, frequence: 3,
      mesures: "Téléphone professionnel", maitrise: "partielle", penibilite: "nuit", seuilPenibilite: "oui",
      action: "Équiper les livreurs d'un dispositif d'alarme travailleur isolé", responsable: "Direction",
      echeance: decalerJours(aujourdhui, 15), statut: "a-faire",
    }),
    ligne({
      unite: "Bureaux", activite: "Travail sur écran", danger: "Travail sur écran",
      risque: "Fatigue visuelle, TMS des poignets et de la nuque", effectif: 4, gravite: 2, frequence: 4,
      mesures: "Écrans réglables, sièges ergonomiques", maitrise: "bonne", penibilite: "",
      seuilPenibilite: "non", action: "Remplacer les sièges par des modèles ergonomiques", responsable: "RH",
      echeance: decalerJours(aujourdhui, -90), statut: "fait",
    }),
    ligne({
      unite: "Bureaux", activite: "Relation clients et fournisseurs", danger: "Risques psychosociaux",
      risque: "Stress, épuisement professionnel", effectif: 4, gravite: 3, frequence: 2,
      mesures: "Entretiens annuels", maitrise: "partielle", penibilite: "", seuilPenibilite: "non",
      action: "Questionnaire anonyme sur la charge de travail", responsable: "RH",
      echeance: decalerJours(aujourdhui, 120), statut: "a-faire",
    }),
  ];

  // Les actions saisies sur les lignes deviennent des actions du plan, complétées pour l'exemple.
  const complements: Record<string, Partial<Action>> = {
    "Acheter 2 transpalettes électriques": { principe: "collective", cout: 4800, indicateur: "Nombre de manutentions manuelles > 15 kg par jour" },
    "Installer des barrières de quai et cales de roues": { principe: "collective", cout: 6500, ressources: "Prestataire de quais" },
    "Rotation des postes toutes les 2 h": { principe: "organisation", indicateur: "Temps passé en chambre froide par salarié" },
    "Installer des feux bleus de signalisation sur les chariots": { principe: "collective", cout: 900 },
    "Poser des filets anti-chute sur les racks": { principe: "collective", cout: 2200, realiseeLe: decalerJours(aujourdhui, -62), efficacite: "efficace", commentaire: "Aucune chute d'objet constatée depuis l'installation." },
    "Faire réaliser une mesure de bruit (sonométrie)": { principe: "organisation", cout: 650, ressources: "Service de prévention et de santé au travail" },
    "Remplacer par un dégraissant aqueux": { principe: "substituer", cout: 300 },
    "Formation éco-conduite et sécurité routière": { principe: "formation", cout: 1500, ressources: "Organisme de formation" },
    "Équiper les livreurs d'un dispositif d'alarme travailleur isolé": { principe: "collective", cout: 1200 },
    "Remplacer les sièges par des modèles ergonomiques": { principe: "collective", cout: 1800, realiseeLe: decalerJours(aujourdhui, -95), efficacite: "partielle", commentaire: "Plaintes en baisse, deux postes restent à régler." },
    "Questionnaire anonyme sur la charge de travail": { principe: "organisation" },
  };
  const actions: Action[] = lignes
    .filter((l) => l.action)
    .map((l) =>
      nouvelleAction(l.id, {
        intitule: l.action,
        responsable: l.responsable,
        echeance: l.echeance,
        statut: l.statut,
        ...complements[l.action ?? ""],
      }),
    );
  // Exemple de risque traité par plusieurs actions complémentaires.
  const quai = lignes.find((l) => l.danger === "Chute de hauteur");
  if (quai) {
    actions.push(
      nouvelleAction(quai.id, {
        intitule: "Consigne d'accès aux quais et sensibilisation des équipes",
        principe: "formation" as PrincipePrevention,
        responsable: "Responsable entrepôt",
        echeance: decalerJours(aujourdhui, 30),
      }),
    );
  }
  const anciensChamps = new Set(["action", "responsable", "echeance", "statut"]);
  const duerp = lignes.map((l) => Object.fromEntries(Object.entries(l).filter(([k]) => !anciensChamps.has(k))) as LigneDuerp);

  const noms = [
    ["Martin L.", "Entrepôt", "Cariste"], ["Bernard S.", "Entrepôt", "Préparateur"],
    ["Petit A.", "Entrepôt", "Préparateur"], ["Durand C.", "Entrepôt", "Réceptionnaire"],
    ["Leroy M.", "Entrepôt", "Cariste"], ["Moreau J.", "Entrepôt", "Chef d'équipe"],
    ["Simon T.", "Atelier", "Technicien"], ["Laurent P.", "Atelier", "Soudeur"],
    ["Michel R.", "Atelier", "Technicien"], ["Garcia N.", "Livraison", "Chauffeur-livreur"],
    ["David E.", "Livraison", "Chauffeur-livreur"], ["Bertrand F.", "Livraison", "Chauffeur-livreur"],
    ["Roux V.", "Administratif", "Assistante"], ["Fournier K.", "Administratif", "Comptable"],
  ];
  const rnd = aleatoire(42);
  const choisir = <T,>(liste: T[]) => liste[Math.floor(rnd() * liste.length)];

  const salaries: Salarie[] = noms.map(([nom, service, poste]) => ({
    id: nouvelId(),
    nom,
    service,
    poste,
    tailles: {
      Mains: choisir(["8", "9", "10"]),
      Pieds: choisir(["39", "40", "41", "42", "43", "44"]),
      Corps: choisir(["S", "M", "L", "XL"]),
      "Haute visibilité": choisir(["M", "L", "XL"]),
    },
  }));

  const article = (a: Omit<Article, "id">): Article => ({ id: nouvelId(), ...a });
  const articles: Article[] = [
    article({ nom: "Gants de manutention", categorie: "Mains", tailles: ["8", "9", "10"], prix: 3.5, delai: 7, lot: 12, tampons: { "8": 12, "9": 24, "10": 12 } }),
    article({ nom: "Gants nitrile (boîte de 100)", categorie: "Mains", tailles: ["M", "L"], prix: 9, delai: 5, lot: 1, tampons: { M: 3, L: 3 } }),
    article({ nom: "Chaussures de sécurité S3", categorie: "Pieds", tailles: ["39", "40", "41", "42", "43", "44"], prix: 62, delai: 14, lot: 1, tampons: { "39": 1, "40": 1, "41": 2, "42": 2, "43": 2, "44": 1 } }),
    article({ nom: "Bottes de sécurité grand froid", categorie: "Pieds", tailles: ["40", "42", "44"], prix: 78, delai: 21, lot: 1, tampons: { "40": 1, "42": 1, "44": 1 } }),
    article({ nom: "Casque de chantier", categorie: "Tête", tailles: ["Unique"], prix: 14, delai: 7, lot: 5, tampons: { Unique: 5 } }),
    article({ nom: "Lunettes de protection", categorie: "Yeux", tailles: ["Unique"], prix: 6, delai: 7, lot: 10, tampons: { Unique: 10 } }),
    article({ nom: "Bouchons d'oreille (paire)", categorie: "Auditif", tailles: ["Unique"], prix: 0.4, delai: 5, lot: 200, tampons: { Unique: 200 } }),
    article({ nom: "Veste grand froid", categorie: "Corps", tailles: ["S", "M", "L", "XL"], prix: 95, delai: 21, lot: 1, tampons: { S: 1, M: 1, L: 1, XL: 1 } }),
    article({ nom: "Gilet haute visibilité", categorie: "Haute visibilité", tailles: ["M", "L", "XL"], prix: 5, delai: 7, lot: 10, tampons: { M: 5, L: 5, XL: 5 } }),
  ];

  // Qui consomme quoi, et à quel rythme (sorties par mois pour un salarié concerné).
  const besoins: { article: number; services: string[]; parMois: number; quantite: number }[] = [
    { article: 0, services: ["Entrepôt", "Livraison"], parMois: 2, quantite: 1 },
    { article: 1, services: ["Atelier"], parMois: 1, quantite: 1 },
    { article: 2, services: ["Entrepôt", "Atelier", "Livraison"], parMois: 0.12, quantite: 1 },
    { article: 3, services: ["Entrepôt"], parMois: 0.08, quantite: 1 },
    { article: 4, services: ["Entrepôt"], parMois: 0.05, quantite: 1 },
    { article: 5, services: ["Atelier"], parMois: 0.4, quantite: 1 },
    { article: 6, services: ["Atelier", "Entrepôt"], parMois: 3, quantite: 10 },
    { article: 7, services: ["Entrepôt"], parMois: 0.06, quantite: 1 },
    { article: 8, services: ["Entrepôt", "Livraison"], parMois: 0.2, quantite: 1 },
  ];

  const mouvements: Mouvement[] = [];
  const debut = decalerJours(aujourdhui, -365);
  const consommes = new Map<string, number>();

  for (const b of besoins) {
    const a = articles[b.article];
    for (const s of salaries.filter((x) => b.services.includes(x.service))) {
      const nb = Math.round(b.parMois * 12 * (0.6 + rnd() * 0.8));
      for (let i = 0; i < nb; i++) {
        const taille =
          a.tailles.length === 1
            ? a.tailles[0]
            : a.tailles.includes(s.tailles[a.categorie] ?? "")
              ? s.tailles[a.categorie]
              : choisir(a.tailles);
        mouvements.push({
          id: nouvelId(), date: decalerJours(aujourdhui, -Math.floor(rnd() * 360)), type: "sortie",
          articleId: a.id, taille, quantite: b.quantite, salarieId: s.id, service: s.service,
          motif: choisir(["Dotation", "Remplacement usure", "Remplacement usure", "Perte"]),
        });
        const k = cle(a.id, taille);
        consommes.set(k, (consommes.get(k) ?? 0) + b.quantite);
      }
    }
  }

  // Réceptions : le stock initial couvre la consommation de l'année, avec quelques manques volontaires.
  for (const a of articles) {
    for (const t of a.tailles) {
      const k = cle(a.id, t);
      const conso = consommes.get(k) ?? 0;
      const marge = Math.round((a.tampons[t] ?? 0) * (0.3 + rnd() * 1.6));
      mouvements.push({
        id: nouvelId(), date: debut, type: "entree", articleId: a.id, taille: t,
        quantite: conso + marge, salarieId: "", service: "", motif: "Stock initial",
      });
    }
  }

  mouvements.sort((x, y) => (x.date < y.date ? 1 : -1));

  // Registre des événements : un accident analysé et clos, un accident à analyser, un presque-accident.
  const risque = (danger: string) => duerp.find((l) => l.danger === danger)?.id ?? "";
  const salarie = (nom: string) => salaries.find((s) => s.nom === nom)?.id ?? "";
  const evenements: Evenement[] = [
    nouvelEvenement({
      type: "accident-travail", date: decalerJours(aujourdhui, -150), heure: "07:40", lieu: "Quai 2",
      unite: "Quai de réception", salarieId: salarie("Durand C."), temoins: "Moreau J.",
      description: "En déchargeant un carton de 25 kg au sol, douleur vive dans le bas du dos.",
      lesions: "Lombalgie aiguë", soins: "arret", joursArret: 12, declaration: "faite",
      declareeLe: decalerJours(aujourdhui, -149), gravitePotentielle: 3,
      pourquoi: [
        "Le salarié a soulevé seul un carton de 25 kg posé au sol.",
        "Le transpalette électrique était en panne.",
        "Aucune solution de remplacement n'était prévue.",
      ],
      facteurs: {
        individu: "Salarié expérimenté, formé aux gestes et postures en 2024.",
        tache: "Camion en retard, déchargement dans l'urgence.",
        materiel: "Transpalette électrique en panne depuis 3 jours.",
        milieu: "",
      },
      enseignements: "Les pannes de matériel de manutention doivent être signalées et réparées sous 24 h.",
      analyseeLe: decalerJours(aujourdhui, -140), analysePar: "Gérante, chef d'équipe, salarié concerné",
      risqueId: risque("Manutention manuelle"), reevalueLe: decalerJours(aujourdhui, -140),
    }),
    nouvelEvenement({
      type: "accident-travail", date: decalerJours(aujourdhui, -6), heure: "14:15", lieu: "Atelier, poste de meulage",
      unite: "Atelier maintenance", salarieId: salarie("Laurent P."),
      description: "Projection d'une particule métallique dans l'œil gauche pendant le meulage.",
      lesions: "Corps étranger dans l'œil gauche", soins: "premiers-soins", secouriste: "Simon T. (SST)",
      declaration: "registre", gravitePotentielle: 3,
    }),
    nouvelEvenement({
      type: "presque-accident", date: decalerJours(aujourdhui, -20), heure: "10:05", lieu: "Allée C",
      unite: "Zone de stockage", description: "Un chariot élévateur a frôlé un préparateur à l'angle de l'allée C.",
      gravitePotentielle: 4, risqueId: risque("Circulation interne (chariots, piétons)"),
    }),
  ];
  // Formations et habilitations : une à renouveler, une manquante, un recyclage déjà fait.
  const formation = (nom: string, type: string, moisEcoules: number, champs: Partial<Formation> = {}) =>
    nouvelleFormation({ salarieId: salarie(nom), type, obtenueLe: ajouterMois(aujourdhui, -moisEcoules), ...champs });
  const formations: Formation[] = [
    formation("Martin L.", "caces-r489", 58, { intitule: "Catégories 1A, 3", organisme: "Centre de formation Rhône Manutention" }),
    formation("Martin L.", "autorisation-conduite", 58, { intitule: "Chariots catégories 1A et 3" }),
    formation("Leroy M.", "caces-r489", 24, { intitule: "Catégorie 3", organisme: "Centre de formation Rhône Manutention" }),
    formation("Moreau J.", "sst", 22, { organisme: "Organisme habilité INRS" }),
    formation("Simon T.", "sst", 6, { organisme: "Organisme habilité INRS" }),
    formation("Simon T.", "habilitation-electrique", 48, { intitule: "B1V, BR", organisme: "Formelec" }),
    formation("Simon T.", "habilitation-electrique", 12, { intitule: "B1V, BR", organisme: "Formelec" }),
    formation("Michel R.", "habilitation-electrique", 40, { intitule: "B0, H0V", organisme: "Formelec" }),
    formation("Laurent P.", "autre", 30, { intitule: "Sécurité des opérations de soudage", organisme: "Soudure Formation" }),
    formation("Garcia N.", "accueil-securite", 8),
  ];
  const exigences = [
    nouvelleExigence("Cariste", "caces-r489"),
    nouvelleExigence("Cariste", "autorisation-conduite"),
    nouvelleExigence("Technicien", "habilitation-electrique"),
    nouvelleExigence("Chef d'équipe", "sst"),
  ];

  // Vérifications périodiques : un chariot en retard, une observation à lever, des rayonnages jamais vérifiés.
  const extincteurs = nouvelEquipement({ type: "extincteurs", nom: "Parc d'extincteurs (18)", localisation: "Tout le site", prestataire: "Sécurité Incendie Rhône" });
  const electricite = nouvelEquipement({ type: "installations-electriques", nom: "Installation électrique du site", localisation: "Entrepôt, atelier, bureaux", prestataire: "Bureau de contrôle Alpes" });
  const chariot1 = nouvelEquipement({ type: "chariots", nom: "Chariot élévateur n° 1", reference: "Linde H25 – SN 4471", localisation: "Zone de stockage", prestataire: "Bureau de contrôle Alpes" });
  const chariot2 = nouvelEquipement({ type: "chariots", nom: "Chariot élévateur n° 2", reference: "Linde H25 – SN 5129", localisation: "Quai de réception", prestataire: "Bureau de contrôle Alpes" });
  const portes = nouvelEquipement({ type: "portes-automatiques", nom: "Portes sectionnelles des quais (3)", localisation: "Quai de réception", prestataire: "Hörmann Services" });
  const racks = nouvelEquipement({ type: "rayonnages", nom: "Racks de la zone de stockage", localisation: "Zone de stockage" });
  const equipements = [extincteurs, electricite, chariot1, chariot2, portes, racks];
  const verifie = (e: typeof extincteurs, joursEcoules: number, champs: Parameters<typeof nouvelleVerification>[1] = {}) =>
    nouvelleVerification(e, { date: decalerJours(aujourdhui, -joursEcoules), ...champs });
  const priseQuai = nouvelleObservation("Prise extérieure du quai 2 sans protection différentielle 30 mA");
  const verifications = [
    verifie(extincteurs, 665),
    verifie(extincteurs, 300, { observations: [{ ...nouvelleObservation("2 extincteurs à recharger (atelier)"), leveeLe: decalerJours(aujourdhui, -290) }], resultat: "observations" }),
    verifie(electricite, 340, {
      resultat: "observations",
      observations: [
        priseQuai,
        { ...nouvelleObservation("Armoire de l'atelier : obturateurs manquants"), leveeLe: decalerJours(aujourdhui, -320) },
      ],
    }),
    verifie(chariot1, 215),
    verifie(chariot2, 60),
    verifie(portes, 120),
  ];

  // Produits chimiques : un solvant à substituer, un CMR à documenter, une FDS manquante.
  const produits = [
    nouveauProduit({
      nom: "Dégraissant solvanté DX 40", fournisseur: "Chimie Industrie", usage: "Dégraissage des pièces mécaniques au pinceau",
      unite: "Atelier maintenance", stockage: "Armoire de sécurité de l'atelier", quantite: "60 L",
      mentionsH: ["H225", "H304", "H315", "H336", "H411"], fdsDate: decalerJours(aujourdhui, -1500),
      epi: "Gants nitrile, lunettes de protection", consignes: "Utiliser sous la hotte aspirante. Refermer le bidon après usage. Pas de flamme à proximité.",
      risqueId: risque("Produits chimiques"),
      substitution: "Essai d'un dégraissant aqueux prévu (voir plan d'actions).",
      salariesExposes: [salarie("Simon T."), salarie("Michel R.")],
    }),
    nouveauProduit({
      nom: "Huile moteur usagée (vidanges des chariots)", fournisseur: "—", usage: "Vidange des chariots thermiques",
      unite: "Atelier maintenance", stockage: "Fût de récupération", quantite: "200 L",
      mentionsH: ["H350", "H373", "H411"], fdsDate: decalerJours(aujourdhui, -400),
      epi: "Gants nitrile à manchettes, lunettes", risqueId: risque("Produits chimiques"),
    }),
    nouveauProduit({
      nom: "Nettoyant sols industriel", fournisseur: "Hygiène Pro", usage: "Lavage des sols de l'entrepôt",
      unite: "Zone de stockage", stockage: "Local ménage", quantite: "120 L",
      mentionsH: ["H315", "H319"], epi: "Gants de ménage",
    }),
  ];

  // Entreprises extérieures : un nettoyage industriel en cours (plan signé) et des travaux de
  // soudure sur les racks dans 10 jours, dont le plan reste à préparer.
  const courant = (code: string) => {
    const r = risquesCourants.find((x) => x.code === code)!;
    return nouveauRisqueIntervention({ phase: r.phase, risque: r.risque, mesures: r.mesures, charge: r.charge });
  };
  const signatures: NonNullable<Donnees["signatures"]> = {
    "sig-demo-eu": { image: SIGNATURE_A, date: decalerJours(aujourdhui, -32), salarieId: "", nom: "Claire Moreau, gérante" },
    "sig-demo-ee": { image: SIGNATURE_B, date: decalerJours(aujourdhui, -32), salarieId: "", nom: "Karim B., chef d'équipe Net'Indus" },
  };
  const interventions: Intervention[] = [
    nouvelleIntervention({
      entreprise: "Net'Indus Services", siret: "987 654 321 00025", responsable: "Karim B., chef d'équipe", telephone: "04 72 00 00 00",
      objet: "Nettoyage industriel des sols de l'entrepôt et des quais (autolaveuse, 3 passages par semaine)",
      lieux: "Zone de stockage, Quai de réception", debut: decalerJours(aujourdhui, -30), fin: decalerJours(aujourdhui, 335),
      effectif: 2, heures: 470, coordinateur: "Responsable entrepôt",
      inspectionLe: decalerJours(aujourdhui, -35), inspectionPar: "Responsable entrepôt, Karim B. (Net'Indus)",
      risques: [
        courant("circulation"),
        courant("coactivite"),
        nouveauRisqueIntervention({
          phase: "Nettoyage des allées pendant la préparation de commandes", risque: "Heurt d'un agent de nettoyage par un chariot élévateur ; sol glissant",
          mesures: "Nettoyage des allées fermées au trafic chariots (de 6 h à 8 h) ; panneaux « sol glissant » ; gilets haute visibilité", charge: "commun",
        }),
        nouveauRisqueIntervention({
          phase: "Produits de nettoyage", risque: "Irritation de la peau et des yeux",
          mesures: "FDS du nettoyant sols remise à Net'Indus ; gants et lunettes fournis par l'entreprise extérieure", charge: "ee",
        }),
      ],
      consignes: "Accueil sécurité à la première venue de chaque agent. Accès par le portail B, badge à retirer à l'accueil. Interdiction de conduire les chariots du site.",
      materiels: "Local ménage mis à disposition (point d'eau, prise 230 V). L'autolaveuse appartient à Net'Indus et est vérifiée par elle.",
      secours: "Sauveteurs secouristes du travail : Laurent P. et Sophie D. Trousse de secours à l'accueil et à l'atelier. Urgences : 112. Rassemblement en cas d'évacuation : parking visiteurs.",
      suivi: [nouveauSuivi({ date: decalerJours(aujourdhui, -5), type: "inspection", observations: "Balisage respecté. Rappel : ne pas laisser l'autolaveuse dans l'allée C." })],
      signatureEu: "sig-demo-eu", signatureEe: "sig-demo-ee",
    }),
    nouvelleIntervention({
      entreprise: "Métal Rhône", responsable: "Atelier de soudure, M. Faure", objet: "Renforcement et soudure de lisses sur les racks de la zone de stockage",
      lieux: "Zone de stockage", debut: decalerJours(aujourdhui, 10), fin: decalerJours(aujourdhui, 14), effectif: 3, heures: 90,
      travauxDangereux: ["hauteur", "points-chauds"], coordinateur: "Responsable entrepôt",
      risques: [courant("coactivite"), risqueDuTravail("hauteur")!, risqueDuTravail("points-chauds")!],
    }),
  ];

  const premier = evenements[0];
  actions.push(
    nouvelleAction(premier.risqueId, {
      intitule: "Contrat de maintenance des transpalettes (intervention sous 24 h)",
      principe: "organisation", responsable: "Responsable entrepôt", echeance: decalerJours(aujourdhui, -120),
      statut: "fait", realiseeLe: decalerJours(aujourdhui, -125), cout: 900, evenementId: premier.id,
    }),
  );

  return {
    version: 1,
    entreprise: "Logistique Démo SAS",
    fiche: {
      siret: "123 456 789 00012",
      adresse: "12 avenue des Entrepôts, 69200 Vénissieux",
      activite: "Entreposage et stockage non frigorifique (52.10B)",
      effectif: "14 salariés",
      responsable: "Claire Moreau, gérante",
    },
    services,
    unites,
    duerp,
    actions,
    evenements,
    formations,
    exigences,
    equipements,
    verifications,
    produits,
    interventions,
    salaries,
    articles,
    mouvements,
    signatures,
  };
}

// Signatures tracées pour la démonstration.
const SIGNATURE_A = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAPoAAABQCAQAAACaYqA+AAADP0lEQVR42u2czXLDIAyEY42Pef8n9b09eDw2CdiApOUn+/XSaZMItBLIMs7rRQghhBBCCCGEEEIIIYQQQgghhBBCCCGEEELIqCwzTur9d/y2LWib2wAelZklD3/H2ERZpOjdBh1Fh7ItDL+fEX3Ps205ZEfk3WFzlECTmbMcKcJuCxdoGta5qtqYu99/vrbbSVzrW0GJ0MY1+AUXvanUWBNcDqBk/xba0/JZQ4xzjSCjDLT281vl+o8Xcj1UtfjNBWPx8G2ZNfGe9rWqbbOze+6y8cXdP8hjvu1weY/L/v47fvx3V3TAYe2VWBNELOYMFFXvWoZZ283q9G1nl2zpXP92u58Mp1Nswywd2C2aNPnWoNX7Kft1gJY7YOqz4n8fOdvDGZX5UDyjLmcoZ5fcN86vNhBXE365nv7MXGsrOj7jOb7/3bdhGspuJcfTiI859XTIYkUb7KV1oQ+z3LD5vF7ReSC1hpbMx2V5r2lN6pbDeov48G5fSfz8yRlPCbxkj39ufhCvL+K4tnz+Xyv38/tzFnhp5Q77ehdv0XOMsSbSk2dz5yPzZF3ra2XLQAulPtpZVv7gadgOw+z700vbxvevltphpTrYmkMFmnpaY7FUQt3BiXyb6Qbv0zvuXyXaSLSP+ToJ5ttM9l5labs1p8Mpz/n8NOnvV8x45nxvfdhInnPv8dqtPITM86uyeo+9PfacWMvjj9ozajnv3EM/lFwf2He+ih3LsEslqR1cOIxrfanfme/cEbreKsieLOLWMkTaSF1z4btgQBxLuGac1VJbI4Je8rYPRax5E0/fKbK7X1XqfuwDyciHNbxtSX5MpsTV3M63yAGExblKUynPs9htPdxety3hZQzikSUPG+lQ8w+wtW6w6IGma4lZFnbkHi9lkx77oFGprCOfoVNnej+nXXzzrLztqZtNeNYFF2JD3E9v85BgnghWB6mRLP3LbCu5vYs1IzvnhgzsdYwstxTr7gz8Z4+x3VcpDCW65QS8Honor24fXHQrV4XB4+/+sLOIu33aIrBlhOxoc6WMsYpobA1SyF0FQEt+ZN+830THr9jrqIZAwYORPwhFb7y/EkIIIYQQQgghhBBCCJmOf8N/n4gbXQrlAAAAAElFTkSuQmCC";
const SIGNATURE_B = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAPoAAABQCAQAAACaYqA+AAADOklEQVR42u2cvZKrMAxGF03KvP+T0meLTCYQDNjWJ2zgnFvcLTLC+rVkh/z9AQAAAAAAAAAAAAAAAAAAAAAAAAAAAJyGAROs83y9/x8vZiXDtXsun/51DR5k5/3WZWTn/dZl13S5StY4vDNTLxmndx0CPbZxz5dHvws6/ZOdHrN88lwTQvOqoXN57Zqsh6j9/NMU5Igw0kryaeqvYNbe5RG7XYTra1cXF4wXKe+6guzJqUg3qaR69LMenKzb7aKyXd3DK4K7Xr8OMv29eH/z1eeAFFE1vA2m1aihabx+F+x3+69plfnZRzOXtli402Mar2VYKfO5TNpWbvZ4Cl++pofvAc9XutTkxODSuOPwe1ypm2xbds/K+VwhzbxqfLNSUQN+FfJuIq2bufSnddtOnSSrfdQ8w5fOqXf70vEKt1/tevSwTJ+Xl3QWTWtAbakah7Ihbrvs1bh9SzddhraqXeZ56NI1vvlxLedVWZojR/UZfQum2yrM/9CPo79OUo83qhJ/tLu2q9lJynvuHp8bf8cprnK7OnzabBVWtjzt8KFUae9z2jNvhcPKCvOe/UtWY/G5FT2W5Kpbd3ZwhmwvtXXw2Xtfg5Kq+y5xe16oKeyUL8M0xaVmefnS9I3hEW4vC4ic+4z11U/Def+51n9e6atG20l7W0p6bfk7f87XqE7/Hbn2VcM7D2hPIHNkWIRh9cZXD3db+VQeQOsmzpP1PoH0NYipkXmN0Ddcprdmikhue1cWv4WMw3dfXt5e6oZS61P9M/TwERXoGKtZ7uN7zrH2d+Xx3+NV6mhncVPauHXGPqo7qXvOb6egz3mLzfOlq/op9ukAqtV0Lk33HYCIOmvn2o/vRoz97TwuX9s9a7JAuxPr32yN7VIs59GeJcwN0uqurkV+1mmZ+vECdQg89ift8Ra/S1PrqPV+RXP1GsFwpEH9eT6XUCNPXx3mtUyhZTQHOr0ugqOcpAigrXXeyulxTvrKn+aWt26oZKleOTqCgLP3lLpl777sm1dnUp2s6U1D333QYYt7vlRN4TSjvPKUsrRaNhvZ1Pl//TngHFryi5E3xM6ZTaqCrJQFAAAAAAAAAAAAAAB35R/707vSX8xb2QAAAABJRU5ErkJggg==";
