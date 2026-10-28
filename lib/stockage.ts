"use client";

// Données de l'entreprise active, chargées depuis Supabase et enregistrées automatiquement.
// Chaque modification est convertie en opérations (lib/operations.ts) envoyées à la base, qui
// vérifie les droits, les applique et tient le journal. Les modifications des collègues arrivent
// en direct et sont fusionnées avec celles qui n'ont pas encore été envoyées.

import { useSyncExternalStore } from "react";
import { normaliser } from "./donnees";
import { VERSION_CONDITIONS } from "./legal";
import { donneesVides } from "./demo";
import { rechargerVers } from "./navigation";
import { appliquerOperations, calculerOperations, operationAutorisee, type Operation, type Role } from "./operations";
import { supabaseNavigateur } from "./supabase/client";
import type { Donnees } from "./types";

const CLE_ENTREPRISE = "frisk-du-entreprise";
const DELAI_ENREGISTREMENT = 800;
const DELAI_NOUVEL_ESSAI = 5000;
const DELAI_RELECTURE = 500;
const OPERATIONS_PAR_ENVOI = 200;
// Version de la base attendue par cette version de Frisk DU (fonction frisk_version, migrations).
export const VERSION_BASE = 10;

export type Statut =
  | "chargement"
  | "pret"
  | "aucun-espace" // compte sans entreprise rattachée
  | "suspendu" // abonnement de l'entreprise suspendu
  | "mot-de-passe-provisoire"
  | "double-authentification" // code de l'application d'authentification à saisir
  | "conditions-a-accepter" // CGU et accord de traitement à accepter (première connexion ou nouvelle version)
  | "base-a-mettre-a-jour" // migration Supabase manquante
  | "erreur";

export type Enregistrement = "enregistre" | "en-cours" | "erreur" | "refuse";

export type Session = {
  statut: Statut;
  email: string;
  admin: boolean;
  role: Role;
  entrepriseId: string;
  enregistrement: Enregistrement;
  donnees: Donnees | null;
  // Multi-établissements : groupe de l'entreprise active et espaces accessibles (tous groupes confondus).
  groupe: { id: string; nom: string } | null;
  espaces: { id: string; nom: string; groupeId: string | null }[];
};

let session: Session = {
  statut: "chargement",
  email: "",
  admin: false,
  role: "lecteur",
  entrepriseId: "",
  enregistrement: "enregistre",
  donnees: null,
  groupe: null,
  espaces: [],
};
// Opérations pas encore envoyées, et celles en cours d'envoi.
let enAttente: Operation[] = [];
let enCours: Operation[] = [];
let minuteur: ReturnType<typeof setTimeout> | null = null;
let relecture: ReturnType<typeof setTimeout> | null = null;
let chargementLance = false;
// Identifiant de cet onglet : permet d'ignorer nos propres modifications renvoyées en direct.
let client = "";
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

// L'utilisateur peut-il modifier cette partie de Frisk DU ?
export function peutModifier(role: Role, zone: "tout" | "epi") {
  if (role === "admin" || role === "responsable") return true;
  return zone === "epi" && role === "contributeur";
}

async function charger() {
  // randomUUID n'existe qu'en connexion sécurisée (https ou localhost).
  client = crypto.randomUUID?.() ?? Math.random().toString(36).slice(2);
  const supabase = supabaseNavigateur();
  const { data: utilisateur } = await supabase.auth.getUser();
  const user = utilisateur.user;
  if (!user) {
    rechargerVers("/connexion");
    return;
  }
  const email = user.email ?? "";
  // Double authentification activée mais pas encore validée pour cette session : la base refuserait
  // l'accès aux données (migration 010), on demande d'abord le code.
  const { data: niveau } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (niveau?.nextLevel === "aal2" && niveau.currentLevel !== "aal2") {
    publier({ statut: "double-authentification", email });
    return;
  }
  if (user.user_metadata?.mot_de_passe_provisoire) {
    publier({ statut: "mot-de-passe-provisoire", email });
    return;
  }

  const [{ data: admin }, { data: adhesions, error }] = await Promise.all([
    supabase.from("admins_frisk").select("user_id").eq("user_id", user.id).maybeSingle(),
    supabase.from("membres").select("entreprise_id, role").eq("user_id", user.id),
  ]);
  if (error) {
    publier({ statut: "erreur", email });
    return;
  }

  const estAdmin = !!admin;
  // Les utilisateurs des clients acceptent les conditions en vigueur ; l'équipe Frisk en est l'auteur.
  if (!estAdmin && user.user_metadata?.conditions_acceptees !== VERSION_CONDITIONS) {
    publier({ statut: "conditions-a-accepter", email });
    return;
  }
  let choix = "";
  try {
    choix = localStorage.getItem(CLE_ENTREPRISE) ?? "";
  } catch {
    // Stockage indisponible : on prend la première entreprise.
  }
  const autorisees = (adhesions ?? []) as { entreprise_id: string; role: Role }[];
  const entrepriseId =
    estAdmin && choix ? choix : autorisees.some((a) => a.entreprise_id === choix) ? choix : autorisees[0]?.entreprise_id ?? "";
  const role: Role = estAdmin ? "admin" : autorisees.find((a) => a.entreprise_id === entrepriseId)?.role ?? "lecteur";

  if (!entrepriseId) {
    publier({ statut: "aucun-espace", email, admin: estAdmin });
    return;
  }

  // Avant toute lecture : une base pas encore migrée ne connaît pas les colonnes récentes.
  const { data: versionBase } = await supabase.rpc("frisk_version");
  if (typeof versionBase !== "number" || versionBase < VERSION_BASE) {
    publier({ statut: "base-a-mettre-a-jour", email, admin: estAdmin });
    return;
  }

  const { data: entreprise } = await supabase
    .from("entreprises")
    .select("nom, actif, groupe_id, groupes(nom)")
    .eq("id", entrepriseId)
    .maybeSingle();
  if (!entreprise || (!entreprise.actif && !estAdmin)) {
    publier({ statut: entreprise ? "suspendu" : "aucun-espace", email, admin: estAdmin });
    return;
  }

  // Espaces entre lesquels l'utilisateur peut passer : ceux auxquels il est rattaché (pour Frisk, les
  // établissements du groupe ; les autres clients s'ouvrent depuis la console). Les règles de la base filtrent.
  const groupeId = (entreprise.groupe_id as string | null) ?? null;
  const requete = supabase.from("entreprises").select("id, nom, actif, groupe_id").order("nom");
  const { data: listeEspaces } = estAdmin
    ? groupeId
      ? await requete.eq("groupe_id", groupeId)
      : { data: [] }
    : await requete.in("id", autorisees.map((a) => a.entreprise_id));
  const espaces = ((listeEspaces ?? []) as { id: string; nom: string; actif: boolean; groupe_id: string | null }[])
    .filter((x) => x.actif || estAdmin)
    .map((x) => ({ id: x.id, nom: x.nom, groupeId: x.groupe_id }));
  const groupe: Session["groupe"] = groupeId
    ? { id: groupeId, nom: (entreprise.groupes as unknown as { nom: string } | null)?.nom ?? "" }
    : null;

  const contenu = await lireContenu(entrepriseId);
  if (contenu === undefined) {
    publier({ statut: "erreur", email });
    return;
  }

  publier({
    statut: "pret",
    email,
    admin: estAdmin,
    role,
    entrepriseId,
    groupe,
    espaces,
    donnees: contenu ? normaliser(contenu) : { ...donneesVides(), entreprise: entreprise.nom },
  });
  ecouterCollegues(entrepriseId);
}

// undefined : erreur de lecture ; null : aucun contenu enregistré pour l'instant.
async function lireContenu(entrepriseId: string): Promise<Donnees | null | undefined> {
  const { data, error } = await supabaseNavigateur()
    .from("espaces")
    .select("contenu")
    .eq("entreprise_id", entrepriseId)
    .maybeSingle();
  if (error) return undefined;
  return (data?.contenu as Donnees | undefined) ?? null;
}

// Réapplique nos opérations non confirmées sur la dernière version enregistrée par un collègue.
function fusionner(contenu: Donnees) {
  publier({ donnees: appliquerOperations(appliquerOperations(normaliser(contenu), enCours), enAttente) });
}

function ecouterCollegues(entrepriseId: string) {
  const supabase = supabaseNavigateur();
  supabase
    .channel(`espace-${entrepriseId}`)
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "espaces", filter: `entreprise_id=eq.${entrepriseId}` },
      (evenement: { new: Record<string, unknown> }) => {
        const ligne = evenement.new as { updated_client?: string | null };
        if (ligne.updated_client === client) return;
        // Realtime omet les colonnes trop volumineuses (signatures, gros DUERP) : on relit toujours
        // la ligne plutôt que de se fier au contenu reçu. Plusieurs modifications rapprochées
        // n'entraînent qu'une seule lecture.
        if (relecture) clearTimeout(relecture);
        relecture = setTimeout(async () => {
          relecture = null;
          const contenu = await lireContenu(entrepriseId);
          if (contenu) fusionner(contenu);
        }, DELAI_RELECTURE);
      },
    )
    .subscribe();

  // Au retour sur l'onglet (veille, perte de réseau), on relit la dernière version.
  document.addEventListener("visibilitychange", async () => {
    if (document.visibilityState !== "visible" || enCours.length) return;
    const contenu = await lireContenu(entrepriseId);
    if (contenu) fusionner(contenu);
  });
}

function planifierEnvoi(delai = DELAI_ENREGISTREMENT) {
  if (minuteur) clearTimeout(minuteur);
  minuteur = setTimeout(envoyer, delai);
}

async function envoyer() {
  minuteur = null;
  if (enCours.length || !enAttente.length || !session.entrepriseId) return;
  enCours = enAttente.slice(0, OPERATIONS_PAR_ENVOI);
  enAttente = enAttente.slice(OPERATIONS_PAR_ENVOI);

  const { error } = await supabaseNavigateur().rpc("appliquer_operations", {
    p_entreprise: session.entrepriseId,
    p_operations: enCours,
    p_client: client,
  });

  if (error?.code === "42501" || error?.code === "22023") {
    // Droits insuffisants ou modification rejetée par la base : la renvoyer échouerait toujours et
    // bloquerait les suivantes. On l'abandonne et on revient à la version enregistrée.
    if (error.code === "22023") console.error("Modification rejetée par la base", error.message, enCours);
    enCours = [];
    enAttente = [];
    publier({ enregistrement: "refuse" });
    const contenu = await lireContenu(session.entrepriseId);
    if (contenu) publier({ donnees: normaliser(contenu) });
    return;
  }
  if (error) {
    // Coupure réseau ou erreur passagère : nouvel essai, sans rien perdre.
    enAttente = [...enCours, ...enAttente];
    enCours = [];
    publier({ enregistrement: "erreur" });
    planifierEnvoi(DELAI_NOUVEL_ESSAI);
    return;
  }

  enCours = [];
  if (enAttente.length) planifierEnvoi(0);
  else if (!minuteur) publier({ enregistrement: "enregistre" });
}

export function modifier(transformation: (d: Donnees) => Donnees) {
  if (!session.donnees) return;
  const suivant = transformation(session.donnees);
  const ops = calculerOperations(session.donnees, suivant);
  if (!ops.length) return;
  if (!ops.every((op) => operationAutorisee(session.role, op))) {
    publier({ enregistrement: "refuse" });
    return;
  }
  enAttente.push(...ops);
  publier({ donnees: suivant, enregistrement: "en-cours" });
  planifierEnvoi();
}

export function remplacer(donnees: Donnees) {
  modifier(() => donnees);
}

// Établissements du groupe de l'entreprise active, accessibles à l'utilisateur (vue d'ensemble).
export function etablissementsDuGroupe(session: Pick<Session, "groupe" | "espaces">) {
  return session.groupe ? session.espaces.filter((e) => e.groupeId === session.groupe!.id) : [];
}

export function enregistrementEnAttente() {
  return enAttente.length > 0 || enCours.length > 0;
}

export function ouvrirEntreprise(id: string) {
  try {
    localStorage.setItem(CLE_ENTREPRISE, id);
  } catch {
    // Sans stockage, l'administrateur reviendra sur sa première entreprise.
  }
  rechargerVers("/");
}

export async function accepterConditions() {
  const { error } = await supabaseNavigateur().auth.updateUser({
    data: { conditions_acceptees: VERSION_CONDITIONS, conditions_acceptees_le: new Date().toISOString() },
  });
  if (error) return false;
  rechargerVers("/");
  return true;
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
