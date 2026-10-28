"use client";

// Attestations de formation et rapports de vérification : fichiers privés dans le stockage Supabase (bucket « attestations »),
// rangés par entreprise puis par élément (<entreprise>/<formation ou vérification>/<fichier>).
// Les droits sont vérifiés par la base (migration 006).

import { supabaseNavigateur } from "./supabase/client";

const BUCKET = "attestations";
export const TAILLE_MAX = 5 * 1024 * 1024;
export const TYPES_ACCEPTES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

// Nom de fichier sans accents ni caractères spéciaux (le chemin du stockage les refuse).
export function nomDeStockage(nom: string) {
  const propre = nom
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return propre || "attestation";
}

export function verifierFichier(fichier: { size: number; type: string }): string | null {
  if (!TYPES_ACCEPTES.includes(fichier.type)) return "Format non accepté : PDF, JPEG, PNG ou WebP uniquement.";
  if (fichier.size > TAILLE_MAX) return "Fichier trop lourd : 5 Mo au maximum.";
  return null;
}

export async function deposerAttestation(entrepriseId: string, formationId: string, fichier: File) {
  const erreur = verifierFichier(fichier);
  if (erreur) throw new Error(erreur);
  const chemin = `${entrepriseId}/${formationId}/${Date.now()}-${nomDeStockage(fichier.name)}`;
  const { error } = await supabaseNavigateur().storage.from(BUCKET).upload(chemin, fichier, { contentType: fichier.type });
  if (error) throw new Error("L'envoi du fichier a échoué. Vérifiez votre connexion et réessayez.");
  return { chemin, nom: fichier.name };
}

// Lien temporaire (une minute) : les attestations ne sont jamais publiques.
export async function ouvrirAttestation(chemin: string) {
  const fenetre = window.open("", "_blank");
  const { data, error } = await supabaseNavigateur().storage.from(BUCKET).createSignedUrl(chemin, 60);
  if (error || !data) {
    fenetre?.close();
    alert("Impossible d'ouvrir l'attestation.");
    return;
  }
  if (fenetre) fenetre.location.href = data.signedUrl;
  else window.location.assign(data.signedUrl);
}

export async function supprimerAttestation(chemin: string) {
  await supabaseNavigateur().storage.from(BUCKET).remove([chemin]);
}
