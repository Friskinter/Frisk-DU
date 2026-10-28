// Produits chimiques : mentions de danger (règlement CLP), pictogrammes, produits CMR, FDS.

import { decalerJours, nouvelId } from "./calculs";
import type { Produit } from "./types";

// Mentions de danger H du règlement CLP, libellés abrégés.
export const mentionsDanger: Record<string, string> = {
  H200: "Explosif instable",
  H201: "Explosif ; danger d'explosion en masse",
  H202: "Explosif ; danger sérieux de projection",
  H203: "Explosif ; danger d'incendie, d'effet de souffle ou de projection",
  H204: "Danger d'incendie ou de projection",
  H205: "Danger d'explosion en masse en cas d'incendie",
  H220: "Gaz extrêmement inflammable",
  H221: "Gaz inflammable",
  H222: "Aérosol extrêmement inflammable",
  H223: "Aérosol inflammable",
  H224: "Liquide et vapeurs extrêmement inflammables",
  H225: "Liquide et vapeurs très inflammables",
  H226: "Liquide et vapeurs inflammables",
  H228: "Matière solide inflammable",
  H229: "Récipient sous pression : peut éclater sous l'effet de la chaleur",
  H230: "Peut exploser même en l'absence d'air",
  H240: "Peut exploser sous l'effet de la chaleur",
  H241: "Peut s'enflammer ou exploser sous l'effet de la chaleur",
  H242: "Peut s'enflammer sous l'effet de la chaleur",
  H250: "S'enflamme spontanément au contact de l'air",
  H251: "Matière auto-échauffante ; peut s'enflammer",
  H252: "Matière auto-échauffante en grandes quantités ; peut s'enflammer",
  H260: "Dégage au contact de l'eau des gaz inflammables qui peuvent s'enflammer spontanément",
  H261: "Dégage au contact de l'eau des gaz inflammables",
  H270: "Peut provoquer ou aggraver un incendie ; comburant",
  H271: "Peut provoquer un incendie ou une explosion ; comburant puissant",
  H272: "Peut aggraver un incendie ; comburant",
  H280: "Contient un gaz sous pression ; peut exploser sous l'effet de la chaleur",
  H281: "Contient un gaz réfrigéré ; peut causer des brûlures cryogéniques",
  H290: "Peut être corrosif pour les métaux",
  H300: "Mortel en cas d'ingestion",
  H301: "Toxique en cas d'ingestion",
  H302: "Nocif en cas d'ingestion",
  H304: "Peut être mortel en cas d'ingestion et de pénétration dans les voies respiratoires",
  H310: "Mortel par contact cutané",
  H311: "Toxique par contact cutané",
  H312: "Nocif par contact cutané",
  H314: "Provoque de graves brûlures de la peau et des lésions oculaires",
  H315: "Provoque une irritation cutanée",
  H317: "Peut provoquer une allergie cutanée",
  H318: "Provoque des lésions oculaires graves",
  H319: "Provoque une sévère irritation des yeux",
  H330: "Mortel par inhalation",
  H331: "Toxique par inhalation",
  H332: "Nocif par inhalation",
  H334: "Peut provoquer des symptômes allergiques ou d'asthme par inhalation",
  H335: "Peut irriter les voies respiratoires",
  H336: "Peut provoquer somnolence ou vertiges",
  H340: "Peut induire des anomalies génétiques",
  H341: "Susceptible d'induire des anomalies génétiques",
  H350: "Peut provoquer le cancer",
  H351: "Susceptible de provoquer le cancer",
  H360: "Peut nuire à la fertilité ou au fœtus",
  H361: "Susceptible de nuire à la fertilité ou au fœtus",
  H362: "Peut être nocif pour les bébés nourris au lait maternel",
  H370: "Risque avéré d'effets graves pour les organes",
  H371: "Risque présumé d'effets graves pour les organes",
  H372: "Risque avéré d'effets graves pour les organes (expositions répétées)",
  H373: "Risque présumé d'effets graves pour les organes (expositions répétées)",
  H400: "Très toxique pour les organismes aquatiques",
  H410: "Très toxique pour les organismes aquatiques, effets à long terme",
  H411: "Toxique pour les organismes aquatiques, effets à long terme",
  H412: "Nocif pour les organismes aquatiques, effets à long terme",
  H413: "Peut être nocif à long terme pour les organismes aquatiques",
  H420: "Nuit à la santé publique et à l'environnement en détruisant l'ozone",
};

// « h 350 i », « H360Fd » → « H350i », « H360Fd » ; null si ce n'est pas une mention H.
export function normaliserMention(texte: string): string | null {
  const m = texte.replace(/\s+/g, "").match(/^H(\d{3})([A-Za-z]{0,2})$/i);
  if (!m) return null;
  return `H${m[1]}${m[2]}`;
}

// Mentions saisies ou copiées depuis la FDS : on garde les codes H (avec leurs suffixes F, D, f, d, i)
// et on ignore le reste (conseils P, mentions EUH, texte).
export function lireMentions(texte: string): string[] {
  const vues = new Set<string>();
  for (const m of texte.matchAll(/\bH\s*(\d{3})([FfDdi]{0,2})(?![0-9])/gi)) {
    vues.add(`H${m[1]}${m[2]}`);
  }
  return [...vues];
}

const numero = (mention: string) => mention.slice(1, 4);

export function libelleMention(mention: string) {
  const libelle = mentionsDanger[`H${numero(mention)}`];
  return libelle ? `${mention} : ${libelle}` : mention;
}

export type Pictogramme = { code: string; libelle: string; symbole: string };

// Pictogrammes de danger SGH, déduits des mentions H.
export const pictogrammes: (Pictogramme & { mentions: string[] })[] = [
  { code: "SGH01", libelle: "Explosif", symbole: "💥", mentions: ["200", "201", "202", "203", "204", "240", "241"] },
  { code: "SGH02", libelle: "Inflammable", symbole: "🔥", mentions: ["220", "221", "222", "223", "224", "225", "226", "228", "241", "242", "250", "251", "252", "260", "261"] },
  { code: "SGH03", libelle: "Comburant", symbole: "⭘", mentions: ["270", "271", "272"] },
  { code: "SGH04", libelle: "Gaz sous pression", symbole: "⛽", mentions: ["280", "281"] },
  { code: "SGH05", libelle: "Corrosif", symbole: "⚗", mentions: ["290", "314", "318"] },
  { code: "SGH06", libelle: "Toxique", symbole: "☠", mentions: ["300", "301", "310", "311", "330", "331"] },
  { code: "SGH07", libelle: "Nocif ou irritant", symbole: "!", mentions: ["302", "312", "315", "317", "319", "332", "335", "336", "420"] },
  { code: "SGH08", libelle: "Danger grave pour la santé", symbole: "✱", mentions: ["304", "334", "340", "341", "350", "351", "360", "361", "370", "371", "372", "373"] },
  { code: "SGH09", libelle: "Dangereux pour l'environnement", symbole: "🐟", mentions: ["400", "410", "411"] },
];

export function pictogrammesDe(mentions: string[]): Pictogramme[] {
  const numeros = new Set(mentions.map(numero));
  return pictogrammes.filter((p) => p.mentions.some((m) => numeros.has(m))).map(({ code, libelle, symbole }) => ({ code, libelle, symbole }));
}

// Cancérogènes, mutagènes, toxiques pour la reproduction : catégorie 1 (avérés ou présumés,
// soumis aux règles particulières des art. R4412-59 et suivants) ou catégorie 2 (suspectés).
const cmr1 = { "350": "cancérogène", "340": "mutagène", "360": "toxique pour la reproduction" } as Record<string, string>;
const cmr2 = { "351": "cancérogène", "341": "mutagène", "361": "toxique pour la reproduction" } as Record<string, string>;

export function classementCmr(p: Pick<Produit, "mentionsH">): { categorie: 1 | 2; effets: string[] } | null {
  const numeros = p.mentionsH.map(numero);
  const avere = numeros.filter((n) => cmr1[n]).map((n) => cmr1[n]);
  if (avere.length) return { categorie: 1, effets: [...new Set(avere)] };
  const suspecte = numeros.filter((n) => cmr2[n]).map((n) => cmr2[n]);
  return suspecte.length ? { categorie: 2, effets: [...new Set(suspecte)] } : null;
}

export const estCmr = (p: Pick<Produit, "mentionsH">) => classementCmr(p)?.categorie === 1;

export const DUREE_FDS = 3 * 365; // au-delà, demander au fournisseur la dernière version

export type EtatFds = "manquante" | "ancienne" | "a-jour";

export function etatFds(p: Pick<Produit, "fds" | "fdsDate">, aujourdhui: string): EtatFds {
  if (!p.fds && !p.fdsDate) return "manquante";
  if (p.fdsDate && p.fdsDate < decalerJours(aujourdhui, -DUREE_FDS)) return "ancienne";
  return "a-jour";
}

export const etatsFds: Record<EtatFds, { libelle: string; couleur: string; texte: string }> = {
  manquante: { libelle: "FDS manquante", couleur: "#d03b3b", texte: "#ffffff" },
  ancienne: { libelle: "FDS à actualiser", couleur: "#fab219", texte: "#0b0b0b" },
  "a-jour": { libelle: "FDS à jour", couleur: "#0ca30c", texte: "#ffffff" },
};

export function nouveauProduit(champs: Partial<Produit> = {}): Produit {
  return {
    id: nouvelId(),
    nom: "",
    fournisseur: "",
    reference: "",
    usage: "",
    unite: "",
    stockage: "",
    quantite: "",
    mentionsH: [],
    fdsDate: "",
    epi: "",
    consignes: "",
    risqueId: "",
    substitution: "",
    salariesExposes: [],
    actif: true,
    ...champs,
  };
}
