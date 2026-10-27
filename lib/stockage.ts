"use client";

// Données de l'entreprise active, chargées depuis Supabase et enregistrées automatiquement.

import { useSyncExternalStore } from "react";
import { donneesVides } from "./demo";
import { supabaseNavigateur } from "./supabase/client";
import type { Donnees } from "./types";
import { rechargerVers } from "./navigation";

const CLE_ENTREPRISE = "frisk-du-entreprise";
const DELAI_ENREGISTREMENT = 800;

export type Statut =
  | "chargement"
  | "pret"
  | "aucun-espace" // compte sans entreprise rattachée
  | "suspendu" // abonnement de l'entreprise suspendu
  | "mot-de-passe-provisoire"
  | "erreur";

export type Enregistrement = "enregistre" | "en-cours" | "erreur" | "conflit";

export type Session = {
  statut: Statut;
  email: string;
  admin: boolean;
  entrepriseId: string;
  enregistrement: Enregistrement;
  donnees: Donnees | null;
};

let session: Session = {
  statut: "chargement",
  email: "",
  admin: false,
  entrepriseId: "",
  enregistrement: "enregistre",
  donnees: null,
};
let version: string | null = null; // updated_at de la ligne chargée
let minuteur: ReturnType<typeof setTimeout> | null = null;
let chargementLance = false;
const abonnes = new Set<() => void>();

function publier(changements: Partial<Session>) {
  session = { ...session, ...changements };
  abonnes.forEach((rappel) => rappel());
}

function sabonner(rappel: () => void) {
  abonnes.add(rappel);
  if (!chargementLance) {
    chargementLance = true;
    void charger();
  }
  return () => abonnes.delete(rappel);
}

const sessionServeur: Session = { ...session };

export function useSession(): Session {
  return useSyncExternalStore(sabonner, () => session, () => sessionServeur);
}

export function useDonnees(): Donnees | null {
  const s = useSession();
  return s.statut === "pret" ? s.donnees : null;
}

async function charger() {
  const supabase = supabaseNavigateur();
  const { data: utilisateur } = await supabase.auth.getUser();
  const user = utilisateur.user;
  if (!user) {
    rechargerVers("/connexion");
    return;
  }
  if (user.user_metadata?.mot_de_passe_provisoire) {
    publier({ statut: "mot-de-passe-provisoire", email: user.email ?? "" });
    return;
  }

  const [{ data: admin }, { data: adhesions, error }] = await Promise.all([
    supabase.from("admins_frisk").select("user_id").eq("user_id", user.id).maybeSingle(),
    supabase.from("membres").select("entreprise_id").eq("user_id", user.id),
  ]);
  if (error) {
    publier({ statut: "erreur", email: user.email ?? "" });
    return;
  }

  const estAdmin = !!admin;
  let choix = "";
  try {
    choix = localStorage.getItem(CLE_ENTREPRISE) ?? "";
  } catch {
    // Stockage indisponible : on prend la première entreprise.
  }
  const autorisees = (adhesions ?? []).map((a: { entreprise_id: string }) => a.entreprise_id);
  const entrepriseId = estAdmin && choix ? choix : autorisees.includes(choix) ? choix : autorisees[0] ?? "";

  if (!entrepriseId) {
    publier({ statut: "aucun-espace", email: user.email ?? "", admin: estAdmin });
    return;
  }

  const { data: entreprise } = await supabase
    .from("entreprises")
    .select("nom, actif")
    .eq("id", entrepriseId)
    .maybeSingle();
  if (!entreprise || (!entreprise.actif && !estAdmin)) {
    publier({ statut: entreprise ? "suspendu" : "aucun-espace", email: user.email ?? "", admin: estAdmin });
    return;
  }

  const { data: espace, error: erreurEspace } = await supabase
    .from("espaces")
    .select("contenu, updated_at")
    .eq("entreprise_id", entrepriseId)
    .maybeSingle();
  if (erreurEspace) {
    publier({ statut: "erreur", email: user.email ?? "" });
    return;
  }

  version = espace?.updated_at ?? null;
  publier({
    statut: "pret",
    email: user.email ?? "",
    admin: estAdmin,
    entrepriseId,
    donnees: (espace?.contenu as Donnees | undefined) ?? { ...donneesVides(), entreprise: entreprise.nom },
  });
}

async function enregistrer() {
  minuteur = null;
  const { donnees, entrepriseId } = session;
  if (!donnees || !entrepriseId) return;
  const supabase = supabaseNavigateur();

  // La version chargée doit être la dernière : sinon un collègue a modifié entre-temps.
  const requete = version
    ? supabase
        .from("espaces")
        .update({ contenu: donnees })
        .eq("entreprise_id", entrepriseId)
        .eq("updated_at", version)
        .select("updated_at")
    : supabase.from("espaces").insert({ entreprise_id: entrepriseId, contenu: donnees }).select("updated_at");

  const { data, error } = await requete;
  if (error) {
    publier({ enregistrement: version ? "erreur" : "conflit" });
    return;
  }
  if (!data?.length) {
    publier({ enregistrement: "conflit" });
    return;
  }
  version = data[0].updated_at;
  if (!minuteur) publier({ enregistrement: "enregistre" });
}

export function modifier(transformation: (d: Donnees) => Donnees) {
  if (!session.donnees || session.enregistrement === "conflit") return;
  publier({ donnees: transformation(session.donnees), enregistrement: "en-cours" });
  if (minuteur) clearTimeout(minuteur);
  minuteur = setTimeout(enregistrer, DELAI_ENREGISTREMENT);
}

export function remplacer(donnees: Donnees) {
  modifier(() => donnees);
}

export function enregistrementEnAttente() {
  return session.enregistrement === "en-cours";
}

export function ouvrirEntreprise(id: string) {
  try {
    localStorage.setItem(CLE_ENTREPRISE, id);
  } catch {
    // Sans stockage, l'administrateur reviendra sur sa première entreprise.
  }
  rechargerVers("/");
}

export async function deconnecter() {
  try {
    localStorage.removeItem(CLE_ENTREPRISE);
  } catch {
    // Rien à nettoyer.
  }
  await supabaseNavigateur().auth.signOut();
  rechargerVers("/connexion");
}
