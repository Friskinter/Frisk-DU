// Import d'un DUERP ou d'une liste de salariés depuis un tableur (Excel ou CSV) : reconnaissance des
// colonnes, conversion des cotations sur la grille Frisk, aperçu avec avertissements.

import { nouvelleAction } from "./actions";
import { nouvelId } from "./calculs";
import { nouvelleLigne } from "./donnees";
import { facteursPenibilite } from "./referentiel";
import type { Action, LigneDuerp, NiveauMaitrise, Salarie } from "./types";

export type Cellule = string | number | boolean | Date | null | undefined;
export type Tableau = Cellule[][];

// ---------- Lecture du fichier ----------

// CSV : séparateur deviné (point-virgule pour Excel en français, virgule ou tabulation), guillemets gérés.
export function lireCsv(texte: string): Tableau {
  const contenu = texte.replace(/^﻿/, "");
  const premiere = contenu.split(/\r?\n/, 1)[0] ?? "";
  const separateur = [";", "\t", ","].sort((a, b) => premiere.split(b).length - premiere.split(a).length)[0];
  const lignes: string[][] = [];
  let ligne: string[] = [];
  let champ = "";
  let entreGuillemets = false;
  for (let i = 0; i < contenu.length; i++) {
    const c = contenu[i];
    if (entreGuillemets) {
      if (c === '"' && contenu[i + 1] === '"') {
        champ += '"';
        i++;
      } else if (c === '"') entreGuillemets = false;
      else champ += c;
    } else if (c === '"' && champ === "") entreGuillemets = true;
    else if (c === separateur) {
      ligne.push(champ);
      champ = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && contenu[i + 1] === "\n") i++;
      ligne.push(champ);
      lignes.push(ligne);
      ligne = [];
      champ = "";
    } else champ += c;
  }
  if (champ !== "" || ligne.length) {
    ligne.push(champ);
    lignes.push(ligne);
  }
  return lignes;
}

// ---------- Texte ----------

export function normaliser(texte: Cellule): string {
  return String(texte ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/œ/g, "oe")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Les dates d'Excel sont lues à minuit UTC : on garde le jour tel qu'écrit dans la cellule.
const dateExcel = (d: Date) => (Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10));

export function texte(cellule: Cellule): string {
  if (cellule === null || cellule === undefined) return "";
  if (cellule instanceof Date) return dateExcel(cellule);
  return String(cellule).replace(/\s+/g, " ").trim();
}

// ---------- Champs et reconnaissance des colonnes ----------

export type ChampDuerp =
  | "unite"
  | "activite"
  | "danger"
  | "risque"
  | "effectif"
  | "gravite"
  | "frequence"
  | "mesures"
  | "maitrise"
  | "penibilite"
  | "action"
  | "responsable"
  | "echeance";

export type ChampSalarie = "nom" | "prenom" | "service" | "poste" | "mains" | "pieds" | "corps";

export type Champ = ChampDuerp | ChampSalarie;

type DefinitionChamp = { libelle: string; synonymes: string[] };

export const champsDuerp: Record<ChampDuerp, DefinitionChamp> = {
  unite: { libelle: "Unité de travail", synonymes: ["unite de travail", "unite", "ut", "poste de travail", "atelier", "zone", "lieu", "secteur", "service", "departement", "poste"] },
  activite: { libelle: "Activité", synonymes: ["activite", "tache", "taches", "operation", "situation de travail", "travaux", "description de la tache", "activites"] },
  danger: { libelle: "Danger", synonymes: ["danger", "dangers", "famille de risque", "famille de danger", "famille", "type de risque", "nature du danger", "source de danger", "categorie"] },
  risque: { libelle: "Risque", synonymes: ["risque", "risques", "dommage", "dommages", "consequence", "consequences", "effet", "description du risque", "situation dangereuse", "risque identifie"] },
  effectif: { libelle: "Effectif exposé", synonymes: ["effectif", "effectif expose", "nombre de salaries", "nb salaries", "nb de salaries", "personnes exposees", "salaries exposes", "nombre", "nb"] },
  gravite: { libelle: "Gravité", synonymes: ["gravite", "g", "severite", "gravite g"] },
  frequence: { libelle: "Fréquence", synonymes: ["frequence", "f", "probabilite", "p", "occurrence", "frequence d exposition", "exposition", "freq", "frequence f"] },
  mesures: { libelle: "Mesures existantes", synonymes: ["mesures existantes", "mesures de prevention existantes", "prevention existante", "mesures en place", "moyens de prevention", "moyens existants", "mesures", "existant", "prevention"] },
  maitrise: { libelle: "Maîtrise", synonymes: ["maitrise", "niveau de maitrise", "efficacite des mesures", "maitrise du risque", "m"] },
  penibilite: { libelle: "Pénibilité", synonymes: ["penibilite", "facteur de penibilite", "facteurs de penibilite"] },
  action: {
    libelle: "Action à mener (plan d'actions)",
    synonymes: ["actions", "action", "actions a mettre en place", "mesures a mettre en place", "mesures a mettre en oeuvre", "actions correctives", "plan d action", "mesures a prendre", "actions de prevention", "propositions", "actions a mener", "mesures complementaires", "amelioration"],
  },
  responsable: { libelle: "Responsable de l'action", synonymes: ["responsable", "pilote", "qui", "porteur", "responsable de l action"] },
  echeance: { libelle: "Échéance de l'action", synonymes: ["echeance", "delai", "date prevue", "pour quand", "date de realisation prevue", "date limite", "quand"] },
};

export const champsSalaries: Record<ChampSalarie, DefinitionChamp> = {
  nom: { libelle: "Nom (ou nom et prénom)", synonymes: ["nom", "nom prenom", "nom et prenom", "prenom nom", "salarie", "salaries", "collaborateur", "nom du salarie", "identite"] },
  prenom: { libelle: "Prénom", synonymes: ["prenom"] },
  service: { libelle: "Service", synonymes: ["service", "departement", "equipe", "secteur", "site"] },
  poste: { libelle: "Poste", synonymes: ["poste", "fonction", "emploi", "metier", "intitule de poste", "qualification"] },
  mains: { libelle: "Taille de gants", synonymes: ["taille de gants", "taille gants", "gants", "mains"] },
  pieds: { libelle: "Pointure", synonymes: ["pointure", "chaussures", "taille chaussures", "pieds"] },
  corps: { libelle: "Taille de vêtements", synonymes: ["taille", "taille vetements", "taille de vetements", "vetements", "corps", "taille vetement"] },
};

export type TypeImport = "duerp" | "salaries";

export const definitions = { duerp: champsDuerp, salaries: champsSalaries } as const;

// Ressemblance entre un en-tête de colonne et un champ : 3 identique, 2 commence par, 1 contient.
function score(entete: string, synonymes: string[]) {
  let meilleur = 0;
  for (const s of synonymes) {
    if (entete === s) return 3;
    if (s.length >= 4 && (entete.startsWith(`${s} `) || entete.startsWith(s))) meilleur = Math.max(meilleur, 2);
    else if (s.length >= 5 && ` ${entete} `.includes(` ${s} `)) meilleur = Math.max(meilleur, 1);
  }
  return meilleur;
}

// Ligne d'en-tête : parmi les premières lignes, celle qui ressemble le plus à des noms de colonnes.
export function trouverEntete(tableau: Tableau, type: TypeImport): number {
  const champs = Object.values(definitions[type]);
  let meilleure = 0;
  let meilleurScore = -1;
  tableau.slice(0, 20).forEach((ligne, i) => {
    const total = ligne.reduce<number>((t, c) => t + Math.max(0, ...champs.map((d) => score(normaliser(c), d.synonymes))), 0);
    if (total > meilleurScore) {
      meilleurScore = total;
      meilleure = i;
    }
  });
  return meilleure;
}

export type Correspondance = Record<number, Champ | "">;

// Associe chaque colonne au champ le plus ressemblant ; chaque champ n'est utilisé qu'une fois.
export function devinerCorrespondance(entetes: Cellule[], type: TypeImport): Correspondance {
  const champs = Object.entries(definitions[type]) as [Champ, DefinitionChamp][];
  const candidats: { colonne: number; champ: Champ; score: number }[] = [];
  entetes.forEach((e, colonne) => {
    const n = normaliser(e);
    // Colonnes calculées (criticité, risque résiduel…) : Frisk Plateforme les recalcule.
    if (!n || /\b(criticite|residuel(le)?|cotation|score|total|niveau de risque|indice)\b/.test(n)) return;
    for (const [champ, d] of champs) {
      const s = score(n, d.synonymes);
      if (s) candidats.push({ colonne, champ, score: s });
    }
  });
  candidats.sort((a, b) => b.score - a.score || a.colonne - b.colonne);
  const resultat: Correspondance = Object.fromEntries(entetes.map((_, i) => [i, ""]));
  const pris = new Set<Champ>();
  for (const c of candidats) {
    if (resultat[c.colonne] || pris.has(c.champ)) continue;
    resultat[c.colonne] = c.champ;
    pris.add(c.champ);
  }
  return resultat;
}

// ---------- Conversion des valeurs ----------

export type Echelle = 3 | 4 | 5 | 10;

export const echelles: Echelle[] = [3, 4, 5, 10];

const motsGravite: [RegExp, number][] = [
  [/\b(tres grave|majeure?|mortel(le)?|critique|irreversible|catastrophique)\b/, 4],
  [/\b(grave|importante?|serieuse?|elevee?|forte?)\b/, 3],
  [/\b(moyenne?|moderee?|significative?|modere)\b/, 2],
  [/\b(faible|legere?|mineure?|benigne?|negligeable)\b/, 1],
];

const motsFrequence: [RegExp, number][] = [
  [/\b(tres frequente?|permanente?|continue?|quotidienne?|systematique|tres elevee?)\b/, 4],
  [/\b(frequente?|reguliere?|hebdomadaire|souvent|elevee?)\b/, 3],
  [/\b(occasionnelle?|peu frequente?|mensuelle|parfois|moyenne?)\b/, 2],
  [/\b(rare|exceptionnelle?|tres rare|improbable|faible|annuelle)\b/, 1],
];

// Premier nombre d'une cellule : « 3 », « G3 », « 3 - Grave », « 2,5 ».
function nombre(cellule: Cellule): number | null {
  if (typeof cellule === "number") return cellule;
  const m = texte(cellule).replace(",", ".").match(/\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
}

// Plus grande valeur numérique d'une colonne : sert à deviner l'échelle de cotation.
export function devinerEchelle(valeurs: Cellule[]): Echelle {
  const max = Math.max(0, ...valeurs.map(nombre).filter((n): n is number => n !== null));
  if (max > 5) return 10;
  if (max > 4) return 5;
  return 4;
}

// Ramène une cotation sur la grille Frisk (1 à 4) ; null si illisible.
export function convertirCotation(cellule: Cellule, echelle: Echelle, mots: [RegExp, number][]): number | null {
  const n = nombre(cellule);
  if (n !== null && n > 0) {
    const v = echelle === 4 ? n : 1 + ((n - 1) * 3) / (echelle - 1);
    return Math.min(4, Math.max(1, Math.round(v)));
  }
  const t = normaliser(cellule);
  if (!t) return null;
  for (const [motif, valeur] of mots) if (motif.test(t)) return valeur;
  return null;
}

export const convertirGravite = (c: Cellule, e: Echelle) => convertirCotation(c, e, motsGravite);
export const convertirFrequence = (c: Cellule, e: Echelle) => convertirCotation(c, e, motsFrequence);

export function convertirMaitrise(cellule: Cellule): NiveauMaitrise | null {
  const t = normaliser(cellule);
  if (!t) return null;
  if (/\b(tres bonne|excellente|totale)\b/.test(t)) return "tres-bonne";
  if (/\b(insuffisante|aucune|nulle|faible|mauvaise|inexistante)\b/.test(t)) return "insuffisante";
  if (/\b(partielle|moyenne|perfectible|a ameliorer)\b/.test(t)) return "partielle";
  if (/\bbonne\b/.test(t)) return "bonne";
  return null;
}

const motsPenibilite: [RegExp, string][] = [
  [/manutention|charge/, "manutention"],
  [/posture|penible/, "postures"],
  [/vibration/, "vibrations"],
  [/chimique|poussiere|fumee/, "chimique"],
  [/hyperbare/, "hyperbare"],
  [/temperature|chaleur|froid/, "temperatures"],
  [/bruit/, "bruit"],
  [/nuit/, "nuit"],
  [/alternant|equipe/, "equipes"],
  [/repetitif|cadence/, "repetitif"],
];

export function convertirPenibilite(cellule: Cellule): string {
  const t = normaliser(cellule);
  if (!t || /^(non|aucun|aucune|sans objet|na|n a)$/.test(t)) return "";
  const trouve = motsPenibilite.find(([motif]) => motif.test(t))?.[1] ?? "";
  return facteursPenibilite.some((f) => f.code === trouve) ? trouve : "";
}

// Date : cellule date d'Excel, « 31/12/2026 », « 2026-12-31 » ou « 12/2026 ».
export function convertirDate(cellule: Cellule): string {
  if (cellule instanceof Date) return dateExcel(cellule);
  const t = texte(cellule);
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (m) {
    const annee = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${annee}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  m = t.match(/^(\d{1,2})[/.-](\d{4})$/);
  if (m) return `${m[2]}-${m[1].padStart(2, "0")}-01`;
  return "";
}

// ---------- Construction des lignes ----------

export type OptionsDuerp = {
  echelleGravite: Echelle;
  echelleFrequence: Echelle;
  recopierUnites: boolean; // cellules fusionnées : une unité vide reprend celle de la ligne précédente
};

export type LigneImportee = {
  numero: number; // numéro de ligne dans le fichier (1 = première ligne)
  ligne: LigneDuerp;
  action: Action | null;
  avertissements: string[];
};

const valeurDe = (ligne: Cellule[], correspondance: Correspondance, champ: Champ): Cellule => {
  const colonne = Object.entries(correspondance).find(([, c]) => c === champ)?.[0];
  return colonne === undefined ? null : ligne[Number(colonne)];
};

export function construireDuerp(
  tableau: Tableau,
  entete: number,
  correspondance: Correspondance,
  options: OptionsDuerp,
): LigneImportee[] {
  const champsUtilises = new Set(Object.values(correspondance).filter(Boolean));
  const titres = new Set(tableau[entete]?.map(normaliser));
  const resultat: LigneImportee[] = [];
  let uniteCourante = "";
  let activiteCourante = "";

  tableau.slice(entete + 1).forEach((cellules, i) => {
    const v = (champ: ChampDuerp) => valeurDe(cellules, correspondance, champ);
    const t = (champ: ChampDuerp) => texte(v(champ));
    const contenu = ["activite", "danger", "risque", "mesures", "action"].map((c) => t(c as ChampDuerp)).filter(Boolean);
    // Ligne vide, ligne de titre répétée ou simple intertitre d'unité : rien à importer.
    if (!contenu.length) {
      if (t("unite")) uniteCourante = t("unite");
      return;
    }
    if (cellules.filter((c) => texte(c)).every((c) => titres.has(normaliser(c)))) return;

    const avertissements: string[] = [];
    let unite = t("unite");
    if (!unite && options.recopierUnites && uniteCourante) unite = uniteCourante;
    if (unite) uniteCourante = unite;
    else avertissements.push("unité de travail absente");
    let activite = t("activite");
    if (!activite && options.recopierUnites && activiteCourante && !t("unite")) activite = activiteCourante;
    activiteCourante = activite;

    let gravite = convertirGravite(v("gravite"), options.echelleGravite);
    if (gravite === null) {
      gravite = 1;
      avertissements.push(champsUtilises.has("gravite") ? `gravité « ${t("gravite") || "vide"} » non reconnue : 1 par défaut` : "gravité à coter");
    }
    let frequence = convertirFrequence(v("frequence"), options.echelleFrequence);
    if (frequence === null) {
      frequence = 1;
      avertissements.push(champsUtilises.has("frequence") ? `fréquence « ${t("frequence") || "vide"} » non reconnue : 1 par défaut` : "fréquence à coter");
    }
    const mesures = t("mesures");
    const maitrise = convertirMaitrise(v("maitrise")) ?? (mesures ? "partielle" : "insuffisante");
    const effectif = Math.max(1, Math.round(nombre(v("effectif")) ?? 1));
    const penibilite = convertirPenibilite(v("penibilite"));

    const ligne = nouvelleLigne(unite, {
      activite,
      danger: t("danger"),
      risque: t("risque"),
      effectif,
      gravite,
      frequence,
      mesures,
      maitrise,
      penibilite,
      seuilPenibilite: penibilite ? "a-evaluer" : "non",
    });
    const intitule = t("action");
    const echeance = convertirDate(v("echeance"));
    if (t("echeance") && !echeance) avertissements.push(`échéance « ${t("echeance")} » non reconnue`);
    const action = intitule ? nouvelleAction(ligne.id, { intitule, responsable: t("responsable"), echeance }) : null;
    resultat.push({ numero: entete + i + 2, ligne, action, avertissements });
  });
  return resultat;
}

export type SalarieImporte = { numero: number; salarie: Salarie; avertissements: string[] };

export function construireSalaries(tableau: Tableau, entete: number, correspondance: Correspondance): SalarieImporte[] {
  const resultat: SalarieImporte[] = [];
  tableau.slice(entete + 1).forEach((cellules, i) => {
    const t = (champ: ChampSalarie) => texte(valeurDe(cellules, correspondance, champ));
    const nom = [t("nom"), t("prenom")].filter(Boolean).join(" ");
    if (!nom) return;
    const tailles: Record<string, string> = {};
    if (t("mains")) tailles.Mains = t("mains");
    if (t("pieds")) tailles.Pieds = t("pieds");
    if (t("corps")) tailles.Corps = t("corps");
    const avertissements = t("poste") ? [] : ["poste absent"];
    resultat.push({
      numero: entete + i + 2,
      salarie: { id: nouvelId(), nom, service: t("service"), poste: t("poste"), tailles },
      avertissements,
    });
  });
  return resultat;
}

// Modèle à remplir, proposé en téléchargement.
export const modeles: Record<TypeImport, string[][]> = {
  duerp: [
    ["Unité de travail", "Activité", "Danger", "Risque", "Effectif", "Gravité (1 à 4)", "Fréquence (1 à 4)", "Mesures existantes", "Maîtrise", "Pénibilité", "Action à mener", "Responsable", "Échéance"],
    ["Atelier", "Meulage", "Projection de particules", "Lésion oculaire", "3", "3", "3", "Lunettes de protection", "Partielle", "", "Installer un écran de protection fixe", "Chef d'atelier", "31/12/2026"],
  ],
  salaries: [
    ["Nom", "Prénom", "Service", "Poste", "Taille de gants", "Pointure", "Taille de vêtements"],
    ["Martin", "Léa", "Entrepôt", "Cariste", "8", "39", "M"],
  ],
};
