"use client";

import { useEffect, useState } from "react";
import { MODE_TEST } from "./mode-test";
import type { Role } from "./operations";
import { useSession } from "./stockage";
import { supabaseNavigateur } from "./supabase/client";

export type UtilisateurEspace = { email: string; role: Exclude<Role, "admin"> };

// En mode de test (sans base), l'utilisateur connecté et deux collègues fictifs.
const utilisateursTest: UtilisateurEspace[] = [
  { email: "marie.dupont@exemple.fr", role: "contributeur" },
  { email: "paul.martin@exemple.fr", role: "lecteur" },
  { email: "test@frisk.fr", role: "responsable" },
];

// Utilisateurs de l'espace, pour confier une action à l'un d'eux (fonction utilisateurs_espace,
// migration 023). Liste vide tant qu'elle n'est pas connue, ou si la base n'est pas à jour :
// le responsable en texte libre reste alors seul possible.
export function useUtilisateursEspace(): UtilisateurEspace[] {
  const { entrepriseId } = useSession();
  const [utilisateurs, setUtilisateurs] = useState<UtilisateurEspace[]>(MODE_TEST ? utilisateursTest : []);
  useEffect(() => {
    if (MODE_TEST || !entrepriseId) return;
    let actif = true;
    supabaseNavigateur()
      .rpc("utilisateurs_espace", { p_entreprise: entrepriseId })
      .then(({ data, error }: { data: UtilisateurEspace[] | null; error: unknown }) => {
        if (actif && !error) setUtilisateurs(data ?? []);
      });
    return () => {
      actif = false;
    };
  }, [entrepriseId]);
  return utilisateurs;
}
