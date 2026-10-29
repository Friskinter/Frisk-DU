// Identité visuelle de l'entreprise cliente : son logo et sa couleur remplacent ceux de Frisk
// dans l'espace, le formulaire de signalement et les documents PDF. Frisk DU reste mentionné
// discrètement (« Réalisé avec Frisk DU »).
// La couleur choisie est ajustée pour rester lisible (contraste AA des règles d'accessibilité).

import type { Identite } from "./types";

export const COULEUR_FRISK = "#b08d57";
const ENCRE = "#0c0b0a";
const MARBRE = "#ece6dc";
const PIERRE = "#d9cfc1";
const GRIS = "#6b645b";
const ALERTE_MENU = "#ec835a"; // « Hors connexion » dans le menu
export const LOGO_TAILLE_MAX = 200_000; // caractères de l'image enregistrée (data URL)

type Rgb = [number, number, number];

export function couleurValide(x: unknown): x is string {
  return typeof x === "string" && /^#[0-9a-f]{6}$/i.test(x);
}

// « #ABC », « abc », « rgb(1, 2, 3) » ou « #aabbcc » : renvoie « #aabbcc », ou null.
export function lireCouleur(saisie: string): string | null {
  const x = saisie.trim().toLowerCase();
  const court = /^#?([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(x);
  if (court) return `#${court[1]}${court[1]}${court[2]}${court[2]}${court[3]}${court[3]}`;
  const long = /^#?([0-9a-f]{6})$/.exec(x);
  if (long) return `#${long[1]}`;
  const rgb = /^rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})/.exec(x);
  if (rgb && rgb.slice(1, 4).every((n) => Number(n) <= 255)) return versHex(rgb.slice(1, 4).map(Number) as Rgb);
  return null;
}

const versRgb = (hex: string): Rgb => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as Rgb;
const versHex = (c: Rgb) => `#${c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
const melanger = (c: Rgb, vers: Rgb, part: number): Rgb => c.map((v, i) => v + (vers[i] - v) * part) as Rgb;

function luminance(c: Rgb) {
  const [r, g, b] = c.map((v) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contraste(a: string, b: string) {
  const [x, y] = [luminance(versRgb(a)), luminance(versRgb(b))].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

// Éclaircit (vers le blanc) ou assombrit (vers le noir) jusqu'au contraste voulu avec `fond`.
function ajuster(couleur: string, fond: string, minimum: number, sens: "clair" | "fonce") {
  const depart = versRgb(couleur);
  const cible: Rgb = sens === "clair" ? [255, 255, 255] : [0, 0, 0];
  for (let part = 0; part <= 1; part += 0.02) {
    const essai = versHex(melanger(depart, cible, part));
    if (contraste(essai, fond) >= minimum) return essai;
  }
  return versHex(cible);
}

// Déclinaisons de la couleur, sur le modèle des couleurs de Frisk :
// - accent : fonds de boutons et d'onglets, avec un texte noir dessus ;
// - menu : fond du menu, version foncée de la couleur (à la place du noir) ;
// - clair : survol et texte sur le menu ;
// - ivoire, marbre : fond des pages et des encadrés, légèrement teintés ;
// - fonce : titres et texte sur fond clair (pages, cartes, documents).
export function palette(couleur: string) {
  const c = versRgb(couleur);
  const accent = ajuster(couleur, ENCRE, 4.5, "clair");
  // Le menu reste assez foncé pour ses textes clairs (dont le texte atténué et l'orange d'alerte).
  let menu = couleur;
  for (let part = 0; part <= 1; part += 0.02) {
    menu = versHex(melanger(c, [0, 0, 0], part));
    const attenue = versHex(melanger(versRgb(PIERRE), versRgb(menu), 0.3));
    if (contraste(attenue, menu) >= 4.5 && contraste(ALERTE_MENU, menu) >= 4.5 && part >= 0.55) break;
  }
  const clair = ajuster(ajuster(versHex(melanger(versRgb(accent), [255, 255, 255], 0.25)), ENCRE, 7, "clair"), menu, 4.5, "clair");
  // Teinte des fonds : la plus marquée possible en gardant le texte gris lisible.
  let ivoire = "#ffffff";
  let marbre = MARBRE;
  for (const part of [0.06, 0.05, 0.04, 0.03, 0.02, 0]) {
    ivoire = versHex(melanger([255, 255, 255], c, part));
    marbre = versHex(melanger([255, 255, 255], c, part * 2 + 0.04));
    if (contraste(GRIS, marbre) >= 4.6) break;
  }
  // Lisible sur les encadrés teintés de l'espace comme sur ceux, neutres, des documents PDF.
  const fonce = [marbre, MARBRE].reduce((x, fond) => ajuster(x, fond, 4.5, "fonce"), couleur);
  return { accent, menu, clair, ivoire, marbre, fonce };
}

// Variables CSS qui remplacent les couleurs de Frisk dans tout l'espace (voir app/globals.css).
export const variablesTheme = ["--color-bronze", "--color-bronze-clair", "--color-bronze-fonce", "--color-menu", "--color-titre", "--color-intertitre", "--color-ivoire", "--color-marbre"];

export function variablesCouleur(identite: Identite | undefined): Record<string, string> | null {
  if (!couleurValide(identite?.couleur)) return null;
  const p = palette(identite.couleur);
  return {
    "--color-bronze": p.accent,
    "--color-bronze-clair": p.clair,
    "--color-bronze-fonce": p.fonce,
    "--color-menu": p.menu,
    "--color-titre": p.fonce,
    "--color-intertitre": p.fonce,
    "--color-ivoire": p.ivoire,
    "--color-marbre": p.marbre,
  };
}

// Adresse saisie par le client (« mon-entreprise.fr », « https://… ») : URL du site, ou null.
export function adresseSite(saisie: string): URL | null {
  const x = saisie.trim();
  if (!x || /\s/.test(x)) return null;
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(x) ? x : `https://${x}`);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (url.username || url.password || !url.hostname.includes(".")) return null;
    url.hash = "";
    return url;
  } catch {
    return null;
  }
}

const attributs = (balise: string) => {
  const res: Record<string, string> = {};
  for (const m of balise.matchAll(/([a-z][a-z0-9:_-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi)) {
    res[m[1].toLowerCase()] = (m[2] ?? m[3] ?? m[4] ?? "").replace(/&amp;/g, "&");
  }
  return res;
};

const resoudre = (adresse: string | undefined, base: URL) => {
  if (!adresse || adresse.startsWith("data:")) return null;
  try {
    const url = new URL(adresse.trim(), base);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
};

// Images susceptibles d'être le logo, de la plus probable à la moins probable :
// logo déclaré (données structurées), image « logo » de la page, icônes du site, image de partage.
export function candidatsLogo(html: string, base: URL): string[] {
  const trouves: { url: string; score: number }[] = [];
  const ajouter = (adresse: string | undefined, score: number) => {
    const url = resoudre(adresse, base);
    if (url) trouves.push({ url, score });
  };

  for (const m of html.matchAll(/"logo"\s*:\s*(?:"([^"]+)"|\{[^}]*?"url"\s*:\s*"([^"]+)")/g)) ajouter((m[1] ?? m[2]).replace(/\\\//g, "/"), 100);
  for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
    const a = attributs(m[0]);
    const indices = [a.src, a.alt, a.class, a.id, a["data-src"]].join(" ").toLowerCase();
    if (!indices.includes("logo")) continue;
    ajouter(a.src && !a.src.startsWith("data:") ? a.src : a["data-src"], 90);
  }
  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    const a = attributs(m[0]);
    const rel = (a.rel ?? "").toLowerCase();
    const taille = Number(/(\d+)x\d+/.exec(a.sizes ?? "")?.[1] ?? 0);
    if (rel.includes("apple-touch-icon")) ajouter(a.href, 60 + Math.min(taille, 512) / 100);
    else if (/(^|\s)icon(\s|$)/.test(rel)) ajouter(a.href, 40 + Math.min(taille, 512) / 100 + (/\.svg($|\?)/i.test(a.href ?? "") ? 5 : 0));
  }
  for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
    const a = attributs(m[0]);
    const nom = (a.property ?? a.name ?? a.itemprop ?? "").toLowerCase();
    if (nom === "og:logo" || nom === "logo") ajouter(a.content, 95);
    else if (nom === "og:image") ajouter(a.content, 20);
  }
  ajouter("/favicon.ico", 10);

  const vus = new Set<string>();
  return trouves
    .sort((x, y) => y.score - x.score)
    .map((t) => t.url)
    .filter((u) => !vus.has(u) && vus.add(u));
}

// Couleur déclarée par le site (balise « theme-color »), si elle existe.
export function couleurDuSite(html: string): string | null {
  for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
    const a = attributs(m[0]);
    if ((a.name ?? "").toLowerCase() === "theme-color" && a.content) {
      const c = lireCouleur(a.content);
      if (c && !neutre(versRgb(c))) return c;
    }
  }
  return null;
}

// Blanc, noir et gris ne font pas une couleur d'entreprise.
function neutre([r, g, b]: Rgb) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max - min < 40 || max < 40 || min > 225;
}

// Couleur dominante d'un logo, à partir de ses pixels (RGBA, comme ImageData.data).
// On ignore les pixels transparents et neutres, puis on garde la teinte la plus fréquente.
export function couleurDominante(pixels: ArrayLike<number>): string | null {
  const groupes = new Map<string, { n: number; r: number; g: number; b: number }>();
  for (let i = 0; i + 3 < pixels.length; i += 4) {
    if (pixels[i + 3] < 200) continue;
    const c: Rgb = [pixels[i], pixels[i + 1], pixels[i + 2]];
    if (neutre(c)) continue;
    const cle = c.map((v) => v >> 5).join(",");
    const g = groupes.get(cle) ?? { n: 0, r: 0, g: 0, b: 0 };
    g.n++;
    g.r += c[0];
    g.g += c[1];
    g.b += c[2];
    groupes.set(cle, g);
  }
  let meilleur: { n: number; r: number; g: number; b: number } | undefined;
  for (const g of groupes.values()) if (!meilleur || g.n > meilleur.n) meilleur = g;
  if (!meilleur || meilleur.n < 20) return null;
  return versHex([meilleur.r / meilleur.n, meilleur.g / meilleur.n, meilleur.b / meilleur.n]);
}

// Logo enregistré : image PNG ou JPEG en data URL, de taille raisonnable.
export function logoValide(x: unknown): x is string {
  return typeof x === "string" && x.length <= LOGO_TAILLE_MAX && /^data:image\/(png|jpeg);base64,[a-z0-9+/]+=*$/i.test(x);
}

// Logo et couleur des documents PDF : ceux du client, sinon ceux de Frisk.
// accent : texte sur fond blanc ; clair : texte sur fond noir (page de garde du document unique) ;
// titre : couleur des titres ; bandeau : filet de couleur en haut des pages (entreprise seulement) ;
// fond : fond foncé de la page de garde.
export type Marque = { logo: string; logoClient: boolean; accent: string; clair: string; titre: string; bandeau: string | null; fond: string; frisk: string };

export function marqueDocuments(identite: Identite | undefined, logoFrisk: string): Marque {
  const couleur = couleurValide(identite?.couleur) ? identite.couleur : null;
  const p = palette(couleur ?? COULEUR_FRISK);
  const logoClient = logoValide(identite?.logo);
  return {
    logo: logoClient ? identite!.logo! : logoFrisk,
    logoClient,
    accent: p.fonce,
    clair: p.clair,
    titre: couleur ? p.fonce : ENCRE,
    bandeau: couleur,
    fond: couleur ? p.menu : ENCRE, // fond de la page de garde du document unique
    frisk: logoFrisk,
  };
}
