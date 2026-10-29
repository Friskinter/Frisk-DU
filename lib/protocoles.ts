// Protocoles de sécurité des opérations de chargement et de déchargement (art. R4515-1 à R4515-11
// du Code du travail). Écrits, ils remplacent le plan de prévention : l'entreprise d'accueil y
// décrit le lieu, l'accès, la circulation, les engins, les consignes et les secours ; le
// transporteur, ses véhicules et ses marchandises. Pour des opérations répétitives avec le même
// transporteur, un seul protocole suffit (art. R4515-8).

import { decalerJours, nouvelId } from "./calculs";
import { ajouterMois } from "./formations";
import type { Donnees, Protocole } from "./types";

export const operations: { valeur: Protocole["operation"]; libelle: string }[] = [
  { valeur: "dechargement", libelle: "Déchargement (livraison)" },
  { valeur: "chargement", libelle: "Chargement (enlèvement)" },
  { valeur: "les-deux", libelle: "Chargement et déchargement" },
];

// Durée de validité proposée pour un protocole permanent, à revoir chaque année.
export const VALIDITE_MOIS = 12;

const champsAccueil = ["lieu", "acces", "circulation", "materiels", "consignes", "secours", "responsable"] as const;

// Un nouveau protocole reprend les informations de l'entreprise d'accueil du dernier protocole :
// elles changent rarement d'un transporteur à l'autre.
export function nouveauProtocole(precedents: Protocole[], aujourdhui: string, champs: Partial<Protocole> = {}): Protocole {
  const modele = precedents.at(-1);
  const accueil = Object.fromEntries(champsAccueil.map((c) => [c, modele?.[c] ?? ""])) as Pick<Protocole, (typeof champsAccueil)[number]>;
  return {
    id: nouvelId(),
    transporteur: "",
    siret: "",
    contact: "",
    telephone: "",
    email: "",
    operation: "dechargement",
    permanent: true,
    debut: aujourdhui,
    fin: ajouterMois(aujourdhui, VALIDITE_MOIS),
    ...accueil,
    vehicules: "",
    marchandises: "",
    precautions: "",
    matieresDangereuses: false,
    notes: "",
    ...champs,
  };
}

// Renouvellement d'un protocole permanent : mêmes informations, nouvelle période, nouvelles signatures.
export function renouveler(p: Protocole, aujourdhui: string): Protocole {
  const debut = p.fin && p.fin >= aujourdhui ? decalerJours(p.fin, 1) : aujourdhui;
  return { ...p, id: nouvelId(), debut, fin: ajouterMois(debut, VALIDITE_MOIS), signatureAccueil: undefined, signatureTransporteur: undefined };
}

export function estSigne(p: Protocole, signatures: Donnees["signatures"]) {
  return !!(p.signatureAccueil && signatures?.[p.signatureAccueil] && p.signatureTransporteur && signatures?.[p.signatureTransporteur]);
}

export const SIGNATURES = "les signatures de l'entreprise d'accueil et du transporteur";

// Ce que le Code du travail demande au protocole, et qui manque encore.
export function elementsManquants(p: Protocole, signatures: Donnees["signatures"]): string[] {
  const manque = [];
  if (!p.transporteur.trim()) manque.push("le nom du transporteur");
  if (!p.debut) manque.push("la date de l'opération");
  if (!p.lieu.trim()) manque.push("le lieu de livraison ou de prise en charge");
  if (!p.acces.trim() && !p.circulation.trim()) manque.push("l'accès et la circulation sur le site");
  if (!p.consignes.trim()) manque.push("les consignes de sécurité");
  if (!p.secours.trim()) manque.push("les moyens de secours");
  if (!p.responsable.trim()) manque.push("le responsable désigné par l'entreprise d'accueil");
  if (!p.vehicules.trim()) manque.push("les véhicules du transporteur");
  if (!p.marchandises.trim()) manque.push("la nature et le conditionnement des marchandises");
  if (p.matieresDangereuses && !p.precautions.trim()) manque.push("les précautions liées aux matières dangereuses");
  if (!estSigne(p, signatures)) manque.push(SIGNATURES);
  return manque;
}

export type EtatProtocole = "a-completer" | "a-signer" | "a-venir" | "valide" | "a-renouveler" | "expire";

export const etatsProtocole: Record<EtatProtocole, { libelle: string; couleur: string; texte: string }> = {
  "a-completer": { libelle: "À compléter", couleur: "#ec835a", texte: "#0b0b0b" },
  "a-signer": { libelle: "À signer", couleur: "#fab219", texte: "#0b0b0b" },
  "a-venir": { libelle: "Signé, à venir", couleur: "#d9cfc1", texte: "#0b0b0b" },
  valide: { libelle: "Valide", couleur: "#0ca30c", texte: "#0b0b0b" },
  "a-renouveler": { libelle: "À renouveler", couleur: "#fab219", texte: "#0b0b0b" },
  expire: { libelle: "Expiré", couleur: "#ece6dc", texte: "#3a3530" },
};

export const DELAI_RENOUVELLEMENT = 30; // jours

export function etatProtocole(p: Protocole, signatures: Donnees["signatures"], aujourdhui: string): EtatProtocole {
  if (p.fin && p.fin < aujourdhui) return "expire";
  const signe = estSigne(p, signatures);
  if (elementsManquants(p, signatures).length > (signe ? 0 : 1)) return "a-completer";
  if (!signe) return "a-signer";
  if (p.debut > aujourdhui) return "a-venir";
  return p.permanent && p.fin && p.fin <= decalerJours(aujourdhui, DELAI_RENOUVELLEMENT) ? "a-renouveler" : "valide";
}

// Protocole dont la période a commencé, ou commence dans les `jours` prochains jours.
export function actifOuProche(p: Protocole, aujourdhui: string, jours = 0) {
  if (!p.debut || (p.fin && p.fin < aujourdhui)) return false;
  return p.debut <= decalerJours(aujourdhui, jours);
}

// Un protocole renouvelé (même transporteur, période suivante déjà prévue) ne doit plus alerter.
export function dejaRenouvele(p: Protocole, protocoles: Protocole[]) {
  return protocoles.some((q) => q.id !== p.id && q.transporteur.trim() === p.transporteur.trim() && q.debut > p.debut);
}
