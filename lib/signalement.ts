// Signalement terrain : un salarié signale un accident, un presque-accident ou une situation
// dangereuse depuis son téléphone, sans compte, grâce au lien (QR code) de son entreprise.
// Ce module est partagé par le formulaire et par le serveur qui enregistre le signalement.

import { nouvelEvenement } from "./evenements";
import type { Evenement, TypeEvenement } from "./types";

export const TYPES_SIGNALES: { valeur: TypeEvenement; libelle: string; aide: string }[] = [
  { valeur: "accident-travail", libelle: "Un accident", aide: "Quelqu'un s'est blessé, même légèrement." },
  { valeur: "presque-accident", libelle: "Un presque-accident", aide: "Il aurait pu y avoir un blessé, mais personne ne l'a été." },
  { valeur: "situation-dangereuse", libelle: "Une situation dangereuse", aide: "Un danger à corriger avant qu'il ne cause un accident." },
];

export const PHOTOS_MAX = 3;
export const TAILLE_PHOTO_MAX = 4 * 1024 * 1024; // après réduction dans le navigateur
export const TAILLE_ENVOI_MAX = 4 * 1024 * 1024; // limite d'une requête chez l'hébergeur : 4,5 Mo

export type FormulaireSignalement = {
  type: TypeEvenement;
  date: string;
  heure: string;
  unite: string;
  lieu: string;
  description: string;
  victime: string;
  lesions: string;
  temoins: string;
  declarant: string;
};

const LONGUEURS: Record<keyof FormulaireSignalement, number> = {
  type: 30, date: 10, heure: 5, unite: 120, lieu: 200, description: 3000, victime: 200, lesions: 500, temoins: 300, declarant: 120,
};

// Nettoie et vérifie ce qui arrive du formulaire (données venues de l'extérieur, sans compte).
export function lireFormulaire(champs: Record<string, unknown>, aujourdhui: string): { ok: true; formulaire: FormulaireSignalement } | { ok: false; erreur: string } {
  const texte = (cle: keyof FormulaireSignalement) => {
    const v = champs[cle];
    return typeof v === "string" ? v.trim().slice(0, LONGUEURS[cle]) : "";
  };
  const f = Object.fromEntries((Object.keys(LONGUEURS) as (keyof FormulaireSignalement)[]).map((c) => [c, texte(c)])) as FormulaireSignalement;
  if (!TYPES_SIGNALES.some((t) => t.valeur === f.type)) return { ok: false, erreur: "Choisissez ce que vous signalez." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.date) || f.date > aujourdhui) f.date = aujourdhui;
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(f.heure)) f.heure = "";
  if (f.description.length < 5) return { ok: false, erreur: "Décrivez en quelques mots ce qui s'est passé." };
  return { ok: true, formulaire: f };
}

// Événement du registre créé à partir du signalement ; le responsable le complète ensuite.
export function evenementSignale(
  f: FormulaireSignalement,
  id: string,
  photos: { chemin: string; nom: string }[],
  unitesConnues: string[],
  recuLe: string,
): Evenement {
  const unite = unitesConnues.includes(f.unite) ? f.unite : "";
  const lieu = [unite ? "" : f.unite, f.lieu].filter(Boolean).join(" · ");
  const accident = f.type === "accident-travail";
  return nouvelEvenement({
    id,
    type: f.type,
    date: f.date,
    heure: f.heure,
    unite,
    lieu,
    description: f.description,
    salarieId: accident && f.victime ? "externe" : "",
    victime: accident ? f.victime : "",
    lesions: accident ? f.lesions : "",
    temoins: f.temoins,
    photos,
    signalement: { par: f.declarant || "Anonyme", recuLe },
  });
}

// Type réel d'une image d'après ses premiers octets (le type annoncé par le navigateur ne suffit pas).
export function typeImage(debut: Uint8Array): "image/jpeg" | "image/png" | "image/webp" | null {
  const a = (i: number) => debut[i];
  if (a(0) === 0xff && a(1) === 0xd8 && a(2) === 0xff) return "image/jpeg";
  if (a(0) === 0x89 && a(1) === 0x50 && a(2) === 0x4e && a(3) === 0x47) return "image/png";
  const ascii = (de: number, a2: number) => String.fromCharCode(...debut.slice(de, a2));
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  return null;
}

export const extensions: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

// Le jeton du lien : 64 caractères hexadécimaux.
export function jetonValide(jeton: unknown): jeton is string {
  return typeof jeton === "string" && /^[0-9a-f]{64}$/.test(jeton);
}

export function lienSignalement(origine: string, jeton: string) {
  return `${origine}/signaler/${jeton}`;
}
