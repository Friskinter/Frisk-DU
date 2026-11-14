// Lecture d'une fiche d'entreprise fournie par le client (extrait Kbis, avis de situation de l'INSEE,
// fiche interne en Word, Excel ou PDF) : on y cherche les rubriques habituelles et leur valeur.
// Le texte vient de lib/lecture-document.ts ; ici, uniquement du texte, pour pouvoir le tester.

import { activiteDe } from "./fiche-officielle";

export type ChampsFiche = {
  raisonSociale?: string;
  siret?: string;
  adresse?: string;
  activite?: string;
  effectif?: string;
  responsable?: string;
};

export type LectureFiche = { champs: ChampsFiche; siret?: string; siren?: string };

// Minuscules sans accents, pour comparer les rubriques quelle que soit leur écriture.
const simplifier = (x: string) =>
  x
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[’`]/g, "'");

// Rubriques reconnues, de la plus précise à la plus générale (« adresse du siège » avant « adresse »).
const rubriques: { champ: keyof ChampsFiche; libelles: string[] }[] = [
  { champ: "raisonSociale", libelles: ["denomination ou raison sociale", "denomination sociale", "raison sociale", "nom de l'entreprise", "denomination"] },
  { champ: "adresse", libelles: ["adresse du siege social", "adresse du siege", "adresse de l'etablissement", "siege social", "adresse"] },
  { champ: "activite", libelles: ["activite(s) exercee(s)", "activites principales", "activite principale exercee", "activite principale", "activites exercees", "activite"] },
  { champ: "effectif", libelles: ["tranche d'effectif salarie", "tranche d'effectif", "effectif salarie", "nombre de salaries", "effectif"] },
  { champ: "responsable", libelles: ["representant legal", "gerant", "president", "directeur general", "dirigeant", "responsable"] },
];

const tousLibelles = rubriques.flatMap((r) => r.libelles);
const SEPARATEUR = /^[\s:;|\-–—.]+/;

// Clé de Luhn : un SIREN ou un SIRET valide (La Poste a sa propre règle pour ses établissements).
export function numeroValide(chiffres: string) {
  if (!/^\d{9}$|^\d{14}$/.test(chiffres)) return false;
  if (chiffres.length === 14 && chiffres.startsWith("356000000")) return true;
  let somme = 0;
  for (let i = 0; i < chiffres.length; i++) {
    let n = Number(chiffres[chiffres.length - 1 - i]);
    if (i % 2 === 1) n = n * 2 > 9 ? n * 2 - 9 : n * 2;
    somme += n;
  }
  return somme % 10 === 0;
}

const formaterSiret = (s: string) => `${s.slice(0, 3)} ${s.slice(3, 6)} ${s.slice(6, 9)} ${s.slice(9)}`;

// Une ligne commence-t-elle par une rubrique connue ? Renvoie la rubrique et ce qui la suit.
function rubriqueDe(ligne: string): { champ: keyof ChampsFiche; suite: string } | null {
  const simple = simplifier(ligne);
  for (const r of rubriques) {
    for (const libelle of r.libelles) {
      if (simple.startsWith(libelle)) {
        // « (APE) : 52.10B » : précision entre parenthèses et séparateurs retirés.
        const suite = retirerLibelle(ligne, libelle).replace(SEPARATEUR, "").replace(/^\([^)]{0,20}\)/, "").replace(SEPARATEUR, "");
        return { champ: r.champ, suite: suite.trim() };
      }
    }
  }
  return null;
}

// Ce qui suit le libellé en début de ligne, quelle que soit son écriture (accents, majuscules).
function retirerLibelle(ligne: string, libelle: string) {
  for (let i = libelle.length; i <= ligne.length; i++) {
    if (simplifier(ligne.slice(0, i)) === libelle) return ligne.slice(i);
  }
  return "";
}

const estRubrique = (ligne: string) => tousLibelles.some((l) => simplifier(ligne).startsWith(l)) || /^(siret|siren|code (ape|naf)|ape|naf)\b/.test(simplifier(ligne));

// Sur un Kbis, la personne est souvent annoncée par « Nom, prénoms ».
const nettoyerValeur = (x: string) => x.replace(/^nom,? (et )?pr[ée]noms?\s*[:\-]?\s*/i, "").replace(/\s{2,}/g, " ").trim();

export function lireFiche(texte: string): LectureFiche {
  const lignes = texte
    .split(/\r?\n/)
    .map((l) => l.replace(/\t/g, "  ").trim())
    .filter(Boolean);
  const champs: ChampsFiche = {};

  for (let i = 0; i < lignes.length; i++) {
    const trouve = rubriqueDe(lignes[i]);
    if (!trouve || champs[trouve.champ]) continue;
    let valeur = trouve.suite;
    // Rubrique seule sur sa ligne : la valeur est sur la suivante.
    if (!valeur && lignes[i + 1] && !estRubrique(lignes[i + 1])) valeur = lignes[++i];
    valeur = nettoyerValeur(valeur);
    // Adresse sur deux lignes : la rue, puis le code postal et la ville.
    if (trouve.champ === "adresse" && valeur && !/\b\d{5}\b/.test(valeur) && /^\d{5}\b/.test(lignes[i + 1] ?? "")) valeur = `${valeur} ${lignes[++i]}`;
    if (valeur && valeur.length <= 200) champs[trouve.champ] = valeur;
  }

  // Numéros : un SIRET (14 chiffres) de préférence, sinon un SIREN (9 chiffres, souvent suivi de « R.C.S. »).
  const brut = texte.replace(/ /g, " ");
  const siret = [...brut.matchAll(/(?<!\d)(\d{3}[ .]?\d{3}[ .]?\d{3}[ .]?\d{5})(?!\d)/g)].map((m) => m[1].replace(/\D/g, "")).find(numeroValide);
  const siren =
    siret?.slice(0, 9) ??
    [...brut.matchAll(/(?<!\d)(\d{3}[ .]?\d{3}[ .]?\d{3})(?![ .]?\d)/g)].map((m) => m[1].replace(/\D/g, "")).find(numeroValide);
  if (siret) champs.siret = formaterSiret(siret);

  // Code d'activité (APE ou NAF), ex. « 52.10B » ou « 5210B ».
  const code = /(?:\bape\b|\bnaf\b|activite principale)[^\n]{0,40}?\b(\d{2})\.?(\d{2})\s?([a-z])\b/i.exec(simplifier(brut));
  if (code) {
    const naf = `${code[1]}.${code[2]}${code[3].toUpperCase()}`;
    if (!champs.activite || /^\d{2}\.?\d{2}\s?[a-z]$/i.test(champs.activite)) champs.activite = activiteDe(naf);
    else if (!champs.activite.includes(naf) && !champs.activite.includes(naf.replace(".", ""))) champs.activite = `${champs.activite} (${naf})`;
  }

  return { champs, siret, siren };
}
