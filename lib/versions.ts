"use client";

// Versions figées du document unique, conservées en ligne et non modifiables.

import { useEffect, useState } from "react";
import { supabaseNavigateur } from "./supabase/client";
import type { Donnees } from "./types";

export type Instantane = Pick<Donnees, "entreprise" | "fiche" | "unites" | "duerp">;

export type VersionDuerp = {
  id: string;
  numero: number;
  motif: string;
  created_at: string;
  auteur: string;
  contenu: Instantane;
};

export const motifsVersion = [
  "Mise à jour annuelle",
  "Aménagement important modifiant les conditions de travail",
  "Accident du travail ou maladie professionnelle",
  "Nouvelle information sur un risque",
  "Première version",
  "Autre",
];

export async function listerVersions(entrepriseId: string): Promise<VersionDuerp[]> {
  const { data, error } = await supabaseNavigateur()
    .from("versions")
    .select("id, numero, motif, created_at, auteur, contenu")
    .eq("entreprise_id", entrepriseId)
    .order("numero", { ascending: false });
  if (error) throw error;
  return (data ?? []) as VersionDuerp[];
}

export async function figerVersion(entrepriseId: string, donnees: Donnees, motif: string, auteur: string) {
  const contenu: Instantane = {
    entreprise: donnees.entreprise,
    fiche: donnees.fiche,
    unites: donnees.unites,
    duerp: donnees.duerp,
  };
  const { error } = await supabaseNavigateur()
    .from("versions")
    .insert({ entreprise_id: entrepriseId, motif, contenu, auteur });
  if (error) throw error;
}

// Versions de l'entreprise active ; `recharger` relance la lecture après une nouvelle version.
export function useVersions(entrepriseId: string) {
  const [etat, setEtat] = useState<{ versions: VersionDuerp[]; chargement: boolean; erreur: boolean }>({
    versions: [],
    chargement: true,
    erreur: false,
  });
  const [compteur, setCompteur] = useState(0);

  useEffect(() => {
    if (!entrepriseId) return;
    let actif = true;
    listerVersions(entrepriseId).then(
      (versions) => actif && setEtat({ versions, chargement: false, erreur: false }),
      () => actif && setEtat({ versions: [], chargement: false, erreur: true }),
    );
    return () => {
      actif = false;
    };
  }, [entrepriseId, compteur]);

  return { ...etat, recharger: () => setCompteur((n) => n + 1) };
}
