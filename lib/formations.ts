// Formations et habilitations des salariés : référentiel, dates d'expiration, formations exigées par poste.

import { decalerJours, nouvelId } from "./calculs";
import type { Donnees, Exigence, Formation, Salarie } from "./types";

export type TypeFormation = {
  code: string;
  libelle: string;
  court: string; // en-tête de colonne du tableau des habilitations
  validite: number | null; // durée de validité usuelle en mois, null si sans limite
  precision: string; // ce que l'on note dans « intitulé » (catégories, niveaux…)
  aide: string;
};

// Durées usuelles : la date indiquée sur l'attestation fait foi et peut être corrigée à la saisie.
export const typesFormation: TypeFormation[] = [
  {
    code: "caces-r489", libelle: "CACES® R489 – Chariots élévateurs", court: "R489", validite: 60,
    precision: "Catégories (ex. 1A, 3, 5)",
    aide: "Valable 5 ans. Le CACES atteste la formation ; l'employeur délivre en plus une autorisation de conduite.",
  },
  {
    code: "caces-r485", libelle: "CACES® R485 – Gerbeurs à conducteur accompagnant", court: "R485", validite: 60,
    precision: "Catégories (1 ou 2)", aide: "Valable 5 ans.",
  },
  {
    code: "caces-r486", libelle: "CACES® R486 – Plates-formes élévatrices (PEMP)", court: "R486", validite: 60,
    precision: "Catégories (A, B, C)", aide: "Valable 5 ans.",
  },
  {
    code: "caces-r482", libelle: "CACES® R482 – Engins de chantier", court: "R482", validite: 120,
    precision: "Catégories (ex. A, B1, C1)", aide: "Valable 10 ans.",
  },
  {
    code: "caces-r490", libelle: "CACES® R490 – Grues de chargement", court: "R490", validite: 60,
    precision: "Options (télécommande…)", aide: "Valable 5 ans.",
  },
  {
    code: "autorisation-conduite", libelle: "Autorisation de conduite", court: "Autoris. conduite", validite: null,
    precision: "Engins autorisés",
    aide: "Délivrée par l'employeur (art. R4323-56) après formation, aptitude médicale et connaissance des lieux. À revoir si l'un de ces éléments change.",
  },
  {
    code: "habilitation-electrique", libelle: "Habilitation électrique", court: "Hab. élec.", validite: 36,
    precision: "Symboles (ex. B0, H0V, BR, BS)",
    aide: "Titre délivré par l'employeur après formation (art. R4544-9 et suivants, norme NF C 18-510). Recyclage recommandé tous les 3 ans.",
  },
  {
    code: "sst", libelle: "Sauveteur secouriste du travail (SST)", court: "SST", validite: 24,
    precision: "", aide: "Maintien et actualisation des compétences (MAC) tous les 24 mois.",
  },
  {
    code: "incendie", libelle: "Équipier de première intervention (incendie)", court: "Incendie", validite: 12,
    precision: "", aide: "Manipulation des extincteurs et évacuation (art. R4227-28 et suivants). Recyclage annuel recommandé.",
  },
  {
    code: "travail-hauteur", libelle: "Travail en hauteur et port du harnais", court: "Hauteur", validite: 36,
    precision: "", aide: "Recyclage recommandé tous les 3 ans.",
  },
  {
    code: "aipr", libelle: "AIPR – Travaux à proximité des réseaux", court: "AIPR", validite: 60,
    precision: "Profil (opérateur, encadrant, concepteur)", aide: "Valable 5 ans.",
  },
  {
    code: "prap", libelle: "PRAP – Prévention des risques liés à l'activité physique", court: "PRAP", validite: 24,
    precision: "", aide: "Maintien et actualisation des compétences tous les 24 mois.",
  },
  {
    code: "fco", libelle: "FIMO / FCO – Conducteurs routiers", court: "FCO", validite: 60,
    precision: "Marchandises ou voyageurs", aide: "Formation continue obligatoire tous les 5 ans.",
  },
  {
    code: "amiante-ss4", libelle: "Amiante sous-section 4", court: "Amiante SS4", validite: 36,
    precision: "Opérateur, encadrant…", aide: "Recyclage tous les 3 ans.",
  },
  {
    code: "accueil-securite", libelle: "Formation à la sécurité au poste", court: "Accueil sécurité", validite: null,
    precision: "",
    aide: "À l'embauche, au changement de poste et pour les intérimaires (art. R4141-2 et suivants).",
  },
  {
    code: "autre", libelle: "Autre formation", court: "Autre", validite: null,
    precision: "Intitulé de la formation", aide: "Indiquez la date d'expiration si la formation doit être renouvelée.",
  },
];

export function typeFormation(code: string): TypeFormation {
  return typesFormation.find((t) => t.code === code) ?? typesFormation[typesFormation.length - 1];
}

export function libelleFormation(f: Pick<Formation, "type" | "intitule">) {
  return f.type === "autre" ? f.intitule || "Formation" : typeFormation(f.type).libelle;
}

// Ajoute des mois à une date, en restant sur le dernier jour du mois si besoin (31 janvier + 1 mois = 28 ou 29 février).
export function ajouterMois(iso: string, mois: number) {
  const [a, m, j] = iso.split("-").map(Number);
  const total = a * 12 + (m - 1) + mois;
  const annee = Math.floor(total / 12);
  const moisCible = (total % 12) + 1;
  const dernierJour = new Date(annee, moisCible, 0).getDate();
  return `${annee}-${String(moisCible).padStart(2, "0")}-${String(Math.min(j, dernierJour)).padStart(2, "0")}`;
}

export function calculerExpiration(type: string, obtenueLe: string) {
  const validite = typeFormation(type).validite;
  return obtenueLe && validite ? ajouterMois(obtenueLe, validite) : "";
}

export function nouvelleFormation(champs: Partial<Formation> = {}): Formation {
  const f: Formation = { id: nouvelId(), salarieId: "", type: "sst", intitule: "", obtenueLe: "", expireLe: "", organisme: "", ...champs };
  return champs.expireLe === undefined ? { ...f, expireLe: calculerExpiration(f.type, f.obtenueLe) } : f;
}

export function nouvelleExigence(poste: string, type: string): Exigence {
  return { id: nouvelId(), poste, type };
}

export const DELAI_RENOUVELLEMENT = 90; // jours

export type EtatFormation = "valide" | "a-renouveler" | "expiree" | "permanente";

export const etatsFormation: Record<EtatFormation, { libelle: string; couleur: string; texte: string }> = {
  valide: { libelle: "Valide", couleur: "#0ca30c", texte: "#ffffff" },
  permanente: { libelle: "Sans expiration", couleur: "#d9cfc1", texte: "#0c0b0a" },
  "a-renouveler": { libelle: "À renouveler", couleur: "#fab219", texte: "#0b0b0b" },
  expiree: { libelle: "Expirée", couleur: "#d03b3b", texte: "#ffffff" },
};

export function etatFormation(f: Pick<Formation, "expireLe">, aujourdhui: string): EtatFormation {
  if (!f.expireLe) return "permanente";
  if (f.expireLe < aujourdhui) return "expiree";
  return f.expireLe <= decalerJours(aujourdhui, DELAI_RENOUVELLEMENT) ? "a-renouveler" : "valide";
}

// Même formation pour un même salarié : le même type (ou, pour une formation libre, le même intitulé).
const cleFormation = (f: Pick<Formation, "salarieId" | "type" | "intitule">) =>
  `${f.salarieId}|${f.type === "autre" ? `autre:${f.intitule.trim().toLowerCase()}` : f.type}`;

// Formations en vigueur : pour chaque salarié et chaque formation, la session la plus récente
// (un recyclage remplace la session précédente, qui reste dans le registre).
export function formationsEnVigueur(formations: Formation[]): Formation[] {
  const dernieres = new Map<string, Formation>();
  for (const f of formations) {
    const cle = cleFormation(f);
    const actuelle = dernieres.get(cle);
    if (!actuelle || `${f.obtenueLe}|${f.expireLe}` > `${actuelle.obtenueLe}|${actuelle.expireLe}`) dernieres.set(cle, f);
  }
  return [...dernieres.values()];
}

export function estRemplacee(f: Formation, formations: Formation[]) {
  return !formationsEnVigueur(formations).includes(f);
}

const memePoste = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export function exigencesDuPoste(exigences: Exigence[], poste: string) {
  return poste.trim() ? exigences.filter((e) => memePoste(e.poste, poste)) : [];
}

// Formations exigées pour le poste du salarié qu'il n'a pas, ou dont la validité est dépassée.
export function formationsManquantes(
  donnees: Pick<Donnees, "salaries" | "formations" | "exigences">,
  aujourdhui: string,
): { salarie: Salarie; type: string; expiree: boolean }[] {
  const enVigueur = formationsEnVigueur(donnees.formations);
  return donnees.salaries.flatMap((s) =>
    exigencesDuPoste(donnees.exigences, s.poste).flatMap((e) => {
      const f = enVigueur.find((x) => x.salarieId === s.id && x.type === e.type);
      if (f && etatFormation(f, aujourdhui) !== "expiree") return [];
      return [{ salarie: s, type: e.type, expiree: !!f }];
    }),
  );
}

// Postes connus : ceux des salariés et ceux qui ont déjà des exigences.
export function postesConnus(donnees: Pick<Donnees, "salaries" | "exigences">) {
  const postes = new Map<string, string>();
  for (const p of [...donnees.salaries.map((s) => s.poste), ...donnees.exigences.map((e) => e.poste)]) {
    if (p.trim() && !postes.has(p.trim().toLowerCase())) postes.set(p.trim().toLowerCase(), p.trim());
  }
  return [...postes.values()].sort((a, b) => a.localeCompare(b, "fr"));
}
