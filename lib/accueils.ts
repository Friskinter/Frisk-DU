// Accueil sécurité des nouveaux arrivants et causeries sécurité.
// L'employeur organise une formation pratique et appropriée à la sécurité à l'embauche, au
// changement de poste et pour les intérimaires (art. R4141-1 à R4141-5 du Code du travail) ;
// les salariés en CDD et intérimaires affectés à un poste à risques particuliers reçoivent une
// formation renforcée (art. L4154-2).

import { decalerJours, niveauDe, nouvelId, risqueResiduel } from "./calculs";
import type { Accueil, Causerie, Donnees, LigneDuerp } from "./types";

export const contrats: { valeur: Accueil["contrat"]; libelle: string }[] = [
  { valeur: "cdi", libelle: "CDI" },
  { valeur: "cdd", libelle: "CDD" },
  { valeur: "interim", libelle: "Intérim" },
  { valeur: "apprentissage", libelle: "Apprentissage ou alternance" },
  { valeur: "stage", libelle: "Stage" },
  { valeur: "autre", libelle: "Autre (changement de poste, retour d'absence…)" },
];

// Points à aborder lors de l'accueil ; « risques » renvoie aux risques du DUERP de l'unité.
export const pointsAccueil: { code: string; libelle: string }[] = [
  { code: "entreprise", libelle: "Présentation de l'entreprise, des locaux et des interlocuteurs (responsable, représentants du personnel, médecine du travail)" },
  { code: "evacuation", libelle: "Consignes d'évacuation : alarme, issues de secours, point de rassemblement" },
  { code: "secours", libelle: "Premiers secours : sauveteurs secouristes, trousse, numéros d'urgence" },
  { code: "risques", libelle: "Risques du poste et mesures de prévention (extrait du document unique)" },
  { code: "epi", libelle: "EPI fournis : port obligatoire, réglage, entretien, remplacement" },
  { code: "circulation", libelle: "Circulation dans l'établissement : allées piétonnes, engins, véhicules" },
  { code: "chimique", libelle: "Produits chimiques du poste : étiquettes, fiches de données de sécurité, stockage" },
  { code: "machines", libelle: "Machines et outils : consignes d'utilisation, autorisations de conduite" },
  { code: "interdits", libelle: "Interdictions : alcool, stupéfiants, tabac, téléphone en circulation" },
  { code: "signalement", libelle: "Signaler un accident, un presque-accident ou une situation dangereuse (QR code)" },
  { code: "alerte", libelle: "Droit d'alerte et de retrait en cas de danger grave et imminent" },
  { code: "reglement", libelle: "Règlement intérieur, horaires et pauses" },
];

export function nouvelAccueil(champs: Partial<Accueil> = {}): Accueil {
  return {
    id: nouvelId(),
    salarieId: "",
    nom: "",
    contrat: "cdi",
    poste: "",
    unite: "",
    arriveeLe: "",
    accueilLe: "",
    animateur: "",
    points: [],
    posteARisque: false,
    complement: "",
    ...champs,
  };
}

export function nomArrivant(a: Pick<Accueil, "salarieId" | "nom">, donnees: Pick<Donnees, "salaries">) {
  return donnees.salaries.find((s) => s.id === a.salarieId)?.nom || a.nom || "Nouvel arrivant";
}

// Risques de l'unité de travail, du plus élevé au plus faible, pour la fiche d'accueil.
export function risquesDuPoste(duerp: LigneDuerp[], unite: string) {
  return duerp.filter((l) => unite && l.unite === unite).sort((a, b) => risqueResiduel(b) - risqueResiduel(a));
}

export function niveauRisque(l: LigneDuerp) {
  return niveauDe(risqueResiduel(l));
}

// Une formation renforcée est requise pour un CDD ou un intérimaire sur un poste à risques.
export function formationRenforcee(a: Pick<Accueil, "contrat" | "posteARisque">) {
  return a.posteARisque && (a.contrat === "cdd" || a.contrat === "interim");
}

export type EtatAccueil = "a-venir" | "a-faire" | "a-signer" | "fait";

export const etatsAccueil: Record<EtatAccueil, { libelle: string; couleur: string; texte: string }> = {
  "a-venir": { libelle: "Arrivée à venir", couleur: "#d9cfc1", texte: "#0b0b0b" },
  "a-faire": { libelle: "Accueil à faire", couleur: "#d03b3b", texte: "#ffffff" },
  "a-signer": { libelle: "À faire signer", couleur: "#fab219", texte: "#0b0b0b" },
  fait: { libelle: "Fait", couleur: "#0ca30c", texte: "#0b0b0b" },
};

export function etatAccueil(a: Accueil, signatures: Donnees["signatures"], aujourdhui: string): EtatAccueil {
  if (!a.accueilLe) return a.arriveeLe && a.arriveeLe > aujourdhui ? "a-venir" : "a-faire";
  return a.signatureId && signatures?.[a.signatureId] ? "fait" : "a-signer";
}

// Accueils en retard : la personne est arrivée et l'accueil n'est pas enregistré.
export function accueilsEnRetard(accueils: Accueil[], aujourdhui: string) {
  return accueils.filter((a) => !a.accueilLe && a.arriveeLe && a.arriveeLe <= aujourdhui);
}

// Thèmes de causerie avec leurs messages clés, pour préparer en une minute.
export const themesCauserie: { theme: string; messages: string[] }[] = [
  {
    theme: "Manutention : gestes et postures",
    messages: ["Utiliser les aides à la manutention dès qu'elles existent", "Charge près du corps, dos droit, plier les jambes", "Au-delà de 25 kg, se faire aider", "Signaler une charge trop lourde ou mal conditionnée"],
  },
  {
    theme: "Circulation : piétons et chariots",
    messages: ["Rester dans les allées piétonnes", "Établir le contact visuel avec le cariste avant de traverser", "Pas de téléphone en circulant", "Le gilet haute visibilité est obligatoire en zone d'engins"],
  },
  {
    theme: "Port des EPI",
    messages: ["Les EPI du poste sont obligatoires, même pour une tâche courte", "Vérifier leur état avant usage", "Demander un remplacement dès qu'un EPI est abîmé", "Chaque EPI a sa durée de vie : la respecter"],
  },
  {
    theme: "Rangement et propreté du poste",
    messages: ["Un poste rangé, c'est moins de chutes et de chocs", "Rien au sol dans les passages", "Nettoyer tout produit répandu immédiatement", "Chaque chose à sa place, chaque place pour une chose"],
  },
  {
    theme: "Travail en hauteur",
    messages: ["Pas d'escabeau de fortune (chaise, carton, palette)", "Vérifier l'échelle ou la nacelle avant usage", "Harnais attaché dès qu'il n'y a pas de garde-corps", "Baliser la zone au sol"],
  },
  {
    theme: "Risque électrique",
    messages: ["Ne jamais intervenir sur une installation sans habilitation", "Signaler câbles abîmés et prises cassées", "Pas de multiprises en cascade", "Armoires électriques toujours fermées et dégagées"],
  },
  {
    theme: "Produits chimiques",
    messages: ["Lire l'étiquette et les pictogrammes avant usage", "Jamais de transvasement dans une bouteille alimentaire", "Porter les gants et lunettes prévus par la fiche de données de sécurité", "Refermer et ranger les produits après usage"],
  },
  {
    theme: "Chaleur et canicule",
    messages: ["Boire de l'eau régulièrement, sans attendre la soif", "Adapter les horaires et faire des pauses à l'ombre", "Repérer les signes du coup de chaleur chez un collègue", "Alerter le 15 ou le 112 en cas de malaise"],
  },
  {
    theme: "Risque routier",
    messages: ["Pas de téléphone au volant, même en kit mains libres", "Respecter les temps de pause", "Vérifier le véhicule et l'arrimage du chargement", "Partir à l'heure plutôt que rattraper le retard sur la route"],
  },
  {
    theme: "Pourquoi signaler les presque-accidents",
    messages: ["Derrière chaque accident grave, des dizaines de presque-accidents ignorés", "Signaler n'est pas dénoncer : on corrige une situation, pas une personne", "Le QR code permet de signaler en une minute, même anonymement", "Chaque signalement reçoit une suite"],
  },
  {
    theme: "Bruit et protection auditive",
    messages: ["Au-delà de 80 dB(A), des protections sont mises à disposition ; au-delà de 85 dB(A), elles sont obligatoires", "Les bouchons se portent bien enfoncés, mains propres", "La perte d'audition est définitive et indolore", "Signaler une machine anormalement bruyante"],
  },
  {
    theme: "Retour d'expérience d'un accident",
    messages: ["Ce qui s'est passé, sans chercher de coupable", "Les causes identifiées", "Les mesures prises pour éviter qu'il se reproduise", "Ce que chacun peut faire à son poste"],
  },
];

export function nouvelleCauserie(champs: Partial<Causerie> = {}): Causerie {
  return { id: nouvelId(), date: "", theme: "", animateur: "", duree: 15, messages: "", remarques: "", participants: [], ...champs };
}

export function messagesDuTheme(theme: string) {
  return themesCauserie.find((t) => t.theme === theme)?.messages.map((m) => `• ${m}`).join("\n") ?? "";
}

export function emargement(c: Causerie, signatures: Donnees["signatures"]) {
  const signes = c.participants.filter((p) => p.signatureId && signatures?.[p.signatureId]).length;
  return { signes, total: c.participants.length };
}

export function derniereCauserie(causeries: Causerie[]) {
  return [...causeries].filter((c) => c.date).sort((a, b) => b.date.localeCompare(a.date))[0];
}

// Salariés n'ayant participé à aucune causerie depuis `jours` jours.
export function salariesSansCauserie(donnees: Pick<Donnees, "salaries" | "causeries">, aujourdhui: string, jours = 365) {
  const depuis = decalerJours(aujourdhui, -jours);
  const presents = new Set(donnees.causeries.filter((c) => c.date >= depuis).flatMap((c) => c.participants.map((p) => p.salarieId)));
  return donnees.salaries.filter((s) => !presents.has(s.id));
}
