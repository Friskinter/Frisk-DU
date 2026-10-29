// Entreprises extérieures : plans de prévention (art. R4512-6 à R4512-12 du Code du travail).
// L'entreprise utilisatrice et l'entreprise extérieure inspectent ensemble les lieux, analysent les
// risques liés à l'interférence de leurs activités et arrêtent les mesures de prévention. Le plan
// est écrit dès 400 heures de travaux sur 12 mois ou dès qu'un travail figure dans la liste des
// travaux dangereux (arrêté du 19 mars 1993).

import { decalerJours, nouvelId } from "./calculs";
import type { Donnees, Intervention, RisqueIntervention, SuiviIntervention } from "./types";

export const SEUIL_HEURES = 400;

// Travaux dangereux de l'arrêté du 19 mars 1993, avec un risque et des mesures types pour
// pré-remplir l'analyse (à adapter à chaque intervention).
export const travauxDangereux: { code: string; libelle: string; risque: string; mesures: string }[] = [
  {
    code: "hauteur", libelle: "Travaux exposant à un risque de chute de hauteur de plus de 3 mètres",
    risque: "Chute de hauteur des intervenants, chute d'objets sur les personnes en dessous",
    mesures: "Protections collectives (garde-corps, nacelle vérifiée) ; balisage de la zone au sol ; harnais si protection collective impossible",
  },
  {
    code: "electrique", libelle: "Travaux au voisinage de pièces nues sous tension (au-delà de la très basse tension)",
    risque: "Électrisation, électrocution, brûlures par arc électrique",
    mesures: "Consignation par l'entreprise utilisatrice avant l'intervention ; intervenants habilités ; vérification d'absence de tension",
  },
  {
    code: "chimique", libelle: "Travaux exposant à des agents chimiques dangereux (inflammables, toxiques, CMR…)",
    risque: "Intoxication, brûlures chimiques, incendie ou explosion",
    mesures: "Communication des fiches de données de sécurité ; ventilation ; EPI adaptés ; stockage hors des zones de passage",
  },
  {
    code: "confine", libelle: "Travaux dans des cuves, fosses, silos ou en espace confiné",
    risque: "Asphyxie, intoxication, ensevelissement",
    mesures: "Permis de pénétrer ; contrôle de l'atmosphère avant et pendant l'intervention ; surveillant à l'extérieur ; moyens de sauvetage prêts",
  },
  {
    code: "points-chauds", libelle: "Travaux par points chauds (soudage, découpage, meulage) nécessitant un permis de feu",
    risque: "Incendie ou explosion, brûlures",
    mesures: "Permis de feu signé avant le début ; éloignement ou protection des matières combustibles ; extincteur à portée ; surveillance 2 h après la fin des travaux",
  },
  {
    code: "levage", libelle: "Montage ou démontage d'éléments préfabriqués lourds, levage de charges",
    risque: "Chute ou balancement de la charge, écrasement",
    mesures: "Plan de levage ; appareils et accessoires vérifiés ; zone d'évolution interdite au personnel",
  },
  {
    code: "demolition", libelle: "Travaux de démolition",
    risque: "Effondrement, chute de matériaux, poussières (dont amiante)",
    mesures: "Repérage amiante avant travaux ; périmètre interdit ; étaiements ; arrosage des poussières",
  },
  {
    code: "ensevelissement", libelle: "Travaux exposant à un risque d'ensevelissement ou de noyade",
    risque: "Ensevelissement en tranchée, noyade",
    mesures: "Blindage des fouilles ; accès sécurisés ; surveillance permanente",
  },
  {
    code: "rayonnements", libelle: "Travaux exposant aux rayonnements ionisants",
    risque: "Exposition aux rayonnements",
    mesures: "Zonage radiologique ; dosimétrie ; coordination avec le conseiller en radioprotection",
  },
  {
    code: "biologique", libelle: "Travaux exposant à des agents biologiques pathogènes",
    risque: "Infection, contamination",
    mesures: "Information sur les agents présents ; EPI ; hygiène et décontamination ; vaccinations à jour",
  },
  {
    code: "hyperbare", libelle: "Travaux en milieu hyperbare",
    risque: "Accidents de décompression, noyade",
    mesures: "Intervenants certifiés ; procédures de compression et décompression ; secours spécialisés",
  },
  {
    code: "laser", libelle: "Utilisation d'un appareil à laser de classe élevée",
    risque: "Lésions oculaires et cutanées",
    mesures: "Zone d'émission délimitée ; lunettes adaptées à la longueur d'onde ; signalisation",
  },
];

// Risques d'interférence présents dans presque toutes les interventions.
export const risquesCourants: { code: string; phase: string; risque: string; mesures: string; charge: RisqueIntervention["charge"] }[] = [
  {
    code: "circulation", phase: "Accès au site et circulation",
    risque: "Heurt entre piétons, véhicules et engins de manutention (chariots, camions)",
    mesures: "Plan de circulation remis à l'accueil ; stationnement sur l'emplacement désigné ; gilet haute visibilité ; vitesse limitée",
    charge: "commun",
  },
  {
    code: "coactivite", phase: "Coactivité avec le personnel du site",
    risque: "Interférence entre les travaux et l'activité de l'entreprise (chute d'objets, projections, bruit)",
    mesures: "Balisage de la zone de travaux ; horaires d'intervention convenus ; information des salariés concernés",
    charge: "commun",
  },
  {
    code: "materiel", phase: "Utilisation de matériel du site",
    risque: "Utilisation d'un équipement par une personne non formée ou non autorisée",
    mesures: "Prêt de matériel uniquement après accord écrit ; conduite d'engins réservée aux titulaires d'une autorisation",
    charge: "eu",
  },
  {
    code: "manutention", phase: "Approvisionnement et évacuation",
    risque: "Manutention de charges, encombrement des passages, chute de plain-pied",
    mesures: "Zone de stockage dédiée ; évacuation des déchets au fil de l'eau ; aides à la manutention",
    charge: "ee",
  },
];

export const charges: { valeur: RisqueIntervention["charge"]; libelle: string; court: string }[] = [
  { valeur: "eu", libelle: "Entreprise utilisatrice", court: "EU" },
  { valeur: "ee", libelle: "Entreprise extérieure", court: "EE" },
  { valeur: "commun", libelle: "Les deux entreprises", court: "EU + EE" },
];

export function nouvelleIntervention(champs: Partial<Intervention> = {}): Intervention {
  return {
    id: nouvelId(),
    entreprise: "",
    siret: "",
    responsable: "",
    telephone: "",
    email: "",
    objet: "",
    lieux: "",
    debut: "",
    fin: "",
    effectif: 1,
    heures: 0,
    sousTraitants: "",
    travauxDangereux: [],
    coordinateur: "",
    inspectionLe: "",
    inspectionPar: "",
    risques: [],
    consignes: "",
    materiels: "",
    secours: "",
    suivi: [],
    notes: "",
    ...champs,
  };
}

export function nouveauRisqueIntervention(champs: Partial<RisqueIntervention> = {}): RisqueIntervention {
  return { id: nouvelId(), phase: "", risque: "", mesures: "", charge: "commun", ...champs };
}

export function nouveauSuivi(champs: Partial<SuiviIntervention> = {}): SuiviIntervention {
  return { id: nouvelId(), date: "", type: "reunion", observations: "", ...champs };
}

// Risque type proposé pour un travail dangereux coché.
export function risqueDuTravail(code: string): RisqueIntervention | null {
  const t = travauxDangereux.find((x) => x.code === code);
  return t ? nouveauRisqueIntervention({ phase: t.libelle, risque: t.risque, mesures: t.mesures, charge: "commun" }) : null;
}

// Plan écrit obligatoire (art. R4512-7) : 400 heures ou plus sur 12 mois, ou travaux dangereux.
export function planEcritObligatoire(i: Pick<Intervention, "heures" | "travauxDangereux">) {
  return i.heures >= SEUIL_HEURES || i.travauxDangereux.length > 0;
}

export function raisonObligation(i: Pick<Intervention, "heures" | "travauxDangereux">) {
  const raisons = [];
  if (i.heures >= SEUIL_HEURES) raisons.push(`${i.heures} heures de travaux prévues (seuil : ${SEUIL_HEURES} h sur 12 mois)`);
  const n = i.travauxDangereux.length;
  if (n) raisons.push(`${n} ${n > 1 ? "travaux dangereux" : "travail dangereux"} de la liste de l'arrêté du 19 mars 1993`);
  return raisons.join(" et ");
}

export const PERMIS_FEU = "points-chauds";

// Ce qui manque pour que le plan soit complet, dans l'ordre où on le prépare.
export function elementsManquants(i: Intervention, signatures: Donnees["signatures"]): string[] {
  const manque = [];
  if (!i.entreprise.trim()) manque.push("le nom de l'entreprise extérieure");
  if (!i.objet.trim()) manque.push("la nature des travaux");
  if (!i.debut) manque.push("la date de début");
  if (!i.inspectionLe) manque.push("l'inspection commune préalable");
  if (!i.risques.some((r) => r.risque.trim() && r.mesures.trim())) manque.push("l'analyse des risques d'interférence");
  if (!i.secours.trim()) manque.push("l'organisation des premiers secours");
  if (!estSigne(i, signatures)) manque.push("les signatures des deux entreprises");
  return manque;
}

export function estSigne(i: Intervention, signatures: Donnees["signatures"]) {
  return !!(i.signatureEu && signatures?.[i.signatureEu] && i.signatureEe && signatures?.[i.signatureEe]);
}

export type EtatIntervention = "a-preparer" | "a-signer" | "a-venir" | "en-cours" | "terminee";

export const etatsIntervention: Record<EtatIntervention, { libelle: string; couleur: string; texte: string }> = {
  "a-preparer": { libelle: "À préparer", couleur: "#ec835a", texte: "#0b0b0b" },
  "a-signer": { libelle: "À signer", couleur: "#fab219", texte: "#0b0b0b" },
  "a-venir": { libelle: "Signé, à venir", couleur: "#d9cfc1", texte: "#0b0b0b" },
  "en-cours": { libelle: "En cours", couleur: "#0ca30c", texte: "#0b0b0b" },
  terminee: { libelle: "Terminée", couleur: "#ece6dc", texte: "#3a3530" },
};

export function etatIntervention(i: Intervention, signatures: Donnees["signatures"], aujourdhui: string): EtatIntervention {
  if (i.fin && i.fin < aujourdhui) return "terminee";
  const signe = estSigne(i, signatures);
  if (elementsManquants(i, signatures).length > (signe ? 0 : 1)) return "a-preparer";
  if (!signe) return "a-signer";
  return i.debut > aujourdhui ? "a-venir" : "en-cours";
}

// Intervention en cours ou qui commence dans les `jours` prochains jours.
export function enCoursOuProche(i: Intervention, aujourdhui: string, jours = 0) {
  if (!i.debut || (i.fin && i.fin < aujourdhui)) return false;
  return i.debut <= decalerJours(aujourdhui, jours);
}

// Dernière inspection ou réunion de coordination (ou, à défaut, l'inspection commune préalable).
export function dernierSuivi(i: Intervention) {
  return [i.inspectionLe, ...i.suivi.map((s) => s.date)].filter(Boolean).sort().at(-1) ?? "";
}
