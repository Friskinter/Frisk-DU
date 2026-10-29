// Suivi des erreurs : chaque erreur est enregistrée (table erreurs, migration 017) et consultable par
// Frisk dans la console, pour corriger un problème avant même qu'un client le signale.
// Aucune donnée saisie par le client n'est transmise : seulement le message technique et la page.

export type RapportErreur = { message: string; detail: string; page: string; navigateur: string; entrepriseId?: string };

const LONGUEUR_MESSAGE = 500;
const LONGUEUR_DETAIL = 4000;

// Retire de l'adresse ce qui peut être secret (jeton du lien de signalement, paramètres).
export function pageSansSecret(adresse: string) {
  try {
    const url = new URL(adresse, "https://frisk.invalid");
    return url.pathname.replace(/\/signaler\/[^/]+/, "/signaler/…").slice(0, 300);
  } catch {
    return "";
  }
}

export function lireRapport(x: unknown): RapportErreur | null {
  if (!x || typeof x !== "object") return null;
  const r = x as Record<string, unknown>;
  const texte = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
  const message = texte(r.message, LONGUEUR_MESSAGE).trim();
  if (!message) return null;
  const entreprise = texte(r.entrepriseId, 36);
  return {
    message,
    detail: texte(r.detail, LONGUEUR_DETAIL),
    page: pageSansSecret(texte(r.page, 1000)),
    navigateur: texte(r.navigateur, 300),
    ...(/^[0-9a-f-]{36}$/.test(entreprise) ? { entrepriseId: entreprise } : {}),
  };
}

// Erreurs sans intérêt : extensions du navigateur, coupures réseau, scripts tiers.
export function erreurIgnoree(message: string, detail = "") {
  return /ResizeObserver loop|chrome-extension:|moz-extension:|safari-extension:|Failed to fetch|NetworkError|Load failed|AbortError|Script error\.?$/i.test(
    `${message}\n${detail}`,
  );
}
