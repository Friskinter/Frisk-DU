// Vérifications périodiques des équipements et installations : référentiel des périodicités,
// échéances, observations à lever.

import { decalerJours, nouvelId } from "./calculs";
import { ajouterMois } from "./formations";
import type { Action, Equipement, Observation, Verification } from "./types";

export type Famille = "incendie" | "electricite" | "levage" | "batiment" | "machines" | "autre";

export const familles: { valeur: Famille; libelle: string }[] = [
  { valeur: "incendie", libelle: "Sécurité incendie" },
  { valeur: "electricite", libelle: "Électricité" },
  { valeur: "levage", libelle: "Levage et manutention" },
  { valeur: "batiment", libelle: "Bâtiment et installations" },
  { valeur: "machines", libelle: "Machines et équipements de travail" },
  { valeur: "autre", libelle: "Autres" },
];

export type TypeEquipement = {
  code: string;
  libelle: string;
  famille: Famille;
  periodicite: number; // en mois
  reference: string; // texte qui fixe ou recommande la périodicité
};

// Périodicités usuelles : certaines dépendent de l'usage, de l'assureur ou du rapport précédent ;
// elles restent modifiables pour chaque équipement.
export const typesEquipement: TypeEquipement[] = [
  { code: "extincteurs", libelle: "Extincteurs", famille: "incendie", periodicite: 12, reference: "Art. R4227-39 du Code du travail, règle APSAD R4 : vérification annuelle." },
  { code: "ria", libelle: "Robinets d'incendie armés (RIA)", famille: "incendie", periodicite: 12, reference: "Règle APSAD R5 : vérification annuelle." },
  { code: "alarme-incendie", libelle: "Alarme incendie et SSI", famille: "incendie", periodicite: 12, reference: "Art. R4227-39 : maintenance et vérification au moins annuelles." },
  { code: "desenfumage", libelle: "Désenfumage", famille: "incendie", periodicite: 12, reference: "Arrêté du 5 août 1992 : vérification annuelle." },
  { code: "eclairage-securite", libelle: "Éclairage de sécurité", famille: "incendie", periodicite: 12, reference: "Arrêté du 14 décembre 2011 : vérification annuelle (contrôle visuel mensuel en interne)." },
  { code: "installations-electriques", libelle: "Installations électriques", famille: "electricite", periodicite: 12, reference: "Art. R4226-16 et arrêté du 26 décembre 2011 : vérification annuelle par un organisme ou une personne qualifiée." },
  { code: "chariots", libelle: "Chariots élévateurs", famille: "levage", periodicite: 6, reference: "Arrêté du 1er mars 2004 : vérification générale périodique (VGP) tous les 6 mois." },
  { code: "nacelles", libelle: "Nacelles et plates-formes élévatrices (PEMP)", famille: "levage", periodicite: 6, reference: "Arrêté du 1er mars 2004 : VGP tous les 6 mois." },
  { code: "appareils-levage", libelle: "Appareils de levage fixes (palans, ponts roulants)", famille: "levage", periodicite: 12, reference: "Arrêté du 1er mars 2004 : VGP annuelle." },
  { code: "accessoires-levage", libelle: "Accessoires de levage (élingues, sangles, crochets)", famille: "levage", periodicite: 12, reference: "Arrêté du 1er mars 2004 : VGP annuelle." },
  { code: "hayons", libelle: "Hayons élévateurs", famille: "levage", periodicite: 6, reference: "Arrêté du 1er mars 2004 : VGP tous les 6 mois." },
  { code: "portes-automatiques", libelle: "Portes et portails automatiques", famille: "batiment", periodicite: 6, reference: "Art. R4224-12 et arrêté du 21 décembre 1993 : entretien et vérification tous les 6 mois." },
  { code: "rayonnages", libelle: "Rayonnages et racks", famille: "batiment", periodicite: 12, reference: "Norme NF EN 15635 : inspection annuelle par une personne compétente." },
  { code: "aeration", libelle: "Aération et captage des polluants", famille: "batiment", periodicite: 12, reference: "Arrêté du 8 octobre 1987 : contrôle annuel des installations de captage." },
  { code: "equipements-pression", libelle: "Équipements sous pression (compresseurs)", famille: "machines", periodicite: 48, reference: "Arrêté du 20 novembre 2017 : inspection périodique au plus tous les 4 ans." },
  { code: "presses", libelle: "Presses et massicots", famille: "machines", periodicite: 3, reference: "Arrêté du 5 mars 1993 : vérification trimestrielle." },
  { code: "echafaudages", libelle: "Échafaudages", famille: "machines", periodicite: 3, reference: "Arrêté du 21 décembre 2004 : vérification trimestrielle (et avant chaque utilisation)." },
  { code: "epi-antichute", libelle: "EPI contre les chutes de hauteur (harnais, longes)", famille: "machines", periodicite: 12, reference: "Arrêté du 19 mars 1993 : vérification annuelle." },
  { code: "autre", libelle: "Autre équipement", famille: "autre", periodicite: 12, reference: "Indiquez la périodicité prévue par le fabricant, le contrat ou la réglementation." },
];

export function typeEquipement(code: string): TypeEquipement {
  return typesEquipement.find((t) => t.code === code) ?? typesEquipement[typesEquipement.length - 1];
}

export const resultats: { valeur: Verification["resultat"]; libelle: string; couleur: string; texte: string }[] = [
  { valeur: "conforme", libelle: "Conforme", couleur: "#0ca30c", texte: "#ffffff" },
  { valeur: "observations", libelle: "Avec observations", couleur: "#fab219", texte: "#0b0b0b" },
  { valeur: "non-conforme", libelle: "Non conforme", couleur: "#d03b3b", texte: "#ffffff" },
];

export function nouvelEquipement(champs: Partial<Equipement> = {}): Equipement {
  const type = champs.type ?? "extincteurs";
  return {
    id: nouvelId(),
    type,
    nom: "",
    localisation: "",
    reference: "",
    periodicite: typeEquipement(type).periodicite,
    prestataire: "",
    ...champs,
  };
}

export function prochaineDate(date: string, periodicite: number) {
  return date && periodicite > 0 ? ajouterMois(date, periodicite) : "";
}

export function nouvelleVerification(equipement: Equipement, champs: Partial<Verification> = {}): Verification {
  const date = champs.date ?? "";
  return {
    id: nouvelId(),
    equipementId: equipement.id,
    date,
    prestataire: equipement.prestataire,
    resultat: "conforme",
    prochaine: prochaineDate(date, equipement.periodicite),
    observations: [],
    ...champs,
  };
}

export function nouvelleObservation(texte = ""): Observation {
  return { id: nouvelId(), texte, leveeLe: "" };
}

// Dernière vérification d'un équipement (la plus récente).
export function derniereVerification(verifications: Verification[], equipementId: string): Verification | undefined {
  return verifications
    .filter((v) => v.equipementId === equipementId && v.date)
    .sort((a, b) => b.date.localeCompare(a.date))[0];
}

export const DELAI_A_PREVOIR = 60; // jours

export type EtatEquipement = "jamais" | "en-retard" | "a-prevoir" | "a-jour";

export const etatsEquipement: Record<EtatEquipement, { libelle: string; couleur: string; texte: string }> = {
  jamais: { libelle: "Jamais vérifié", couleur: "#ec835a", texte: "#0b0b0b" },
  "en-retard": { libelle: "En retard", couleur: "#d03b3b", texte: "#ffffff" },
  "a-prevoir": { libelle: "À prévoir", couleur: "#fab219", texte: "#0b0b0b" },
  "a-jour": { libelle: "À jour", couleur: "#0ca30c", texte: "#ffffff" },
};

export function echeance(verifications: Verification[], equipement: Equipement) {
  return derniereVerification(verifications, equipement.id)?.prochaine ?? "";
}

export function etatEquipement(verifications: Verification[], equipement: Equipement, aujourdhui: string): EtatEquipement {
  const derniere = derniereVerification(verifications, equipement.id);
  if (!derniere) return "jamais";
  if (!derniere.prochaine) return "a-jour";
  if (derniere.prochaine < aujourdhui) return "en-retard";
  return derniere.prochaine <= decalerJours(aujourdhui, DELAI_A_PREVOIR) ? "a-prevoir" : "a-jour";
}

// Une observation est levée quand on l'a indiqué, ou quand l'action créée pour elle est réalisée.
export function observationLevee(o: Observation, actions: Action[]) {
  return !!o.leveeLe || (!!o.actionId && actions.some((a) => a.id === o.actionId && a.statut === "fait"));
}

// Observations restant à lever, sur la dernière vérification de chaque équipement
// (celles des rapports précédents sont reprises, ou non, par le vérificateur suivant).
export function observationsOuvertes(equipements: Equipement[], verifications: Verification[], actions: Action[]) {
  return equipements.flatMap((e) => {
    const v = derniereVerification(verifications, e.id);
    return (v?.observations ?? []).filter((o) => o.texte.trim() && !observationLevee(o, actions)).map((o) => ({ equipement: e, verification: v!, observation: o }));
  });
}
