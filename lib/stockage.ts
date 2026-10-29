"use client";

// Données de l'entreprise active, chargées depuis Supabase et enregistrées automatiquement.
// Chaque modification est convertie en opérations (lib/operations.ts) envoyées à la base, qui
// vérifie les droits, les applique et tient le journal. Les modifications des collègues arrivent
// en direct et sont fusionnées avec celles qui n'ont pas encore été envoyées.

import { useSyncExternalStore } from "react";
import { normaliser } from "./donnees";
import { VERSION_CONDITIONS } from "./legal";
import { accesEntreprise, operationPermiseEssai, type Acces, type Periodicite, type StatutAbonnement } from "./abonnement";
import { CLE_ABONNEMENT_TEST, CLE_DONNEES_TEST, CLE_ROLE_TEST, MODE_TEST } from "./mode-test";
import { dateDuJour } from "./calculs";
import { donneesDemo, donneesVides } from "./demo";
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
export const VERSION_BASE = 16;

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

export type Abonnement = {
  statut: StatutAbonnement;
  acces: Acces;
  essaiFin: string | null;
  offre: string | null;
  periodicite: Periodicite | null;
  fin: string | null; // fin de la période payée
  stripe: boolean; // abonnement payé en ligne (gérable depuis le portail Stripe)
};

const abonnementComplet: Abonnement = { statut: "actif", acces: "complet", essaiFin: null, offre: null, periodicite: null, fin: null, stripe: false };

export type Session = {
  statut: Statut;
  email: string;
  admin: boolean;
  // Rôle appliqué : « lecteur » quand l'espace est en lecture seule (essai terminé, abonnement arrêté).
  role: Role;
  roleCompte: Role; // rôle de l'utilisateur dans l'entreprise, pour l'affichage
  abonnement: Abonnement;
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
  roleCompte: "lecteur",
  abonnement: abonnementComplet,
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

// Accès de l'entreprise ouverte (hors composants React : génération des PDF).
export function accesActuel() {
  return session.abonnement.acces;
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
  if (MODE_TEST) {
    const roleCompte = (localStorage.getItem(CLE_ROLE_TEST) ?? "responsable") as Role;
    const donnees = (window as unknown as Record<string, string | undefined>)[CLE_DONNEES_TEST];
    const essai = JSON.parse(localStorage.getItem(CLE_ABONNEMENT_TEST) ?? "null") as Pick<Abonnement, "statut" | "essaiFin"> | null;
    const abonnement = essai ? { ...abonnementComplet, ...essai, acces: accesEntreprise({ abonnement: essai.statut, essaiFin: essai.essaiFin }) } : abonnementComplet;
    publier({
      statut: "pret", email: "test@frisk.fr", admin: false, role: abonnement.acces === "lecture" ? "lecteur" : roleCompte, roleCompte, abonnement,
      entrepriseId: "00000000-0000-0000-0000-000000000000",
      donnees: donnees ? normaliser(JSON.parse(donnees)) : donneesDemo(dateDuJour()),
    });
    return;
  }
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
    // Inscription libre : l'entreprise saisie à l'inscription est créée, en essai gratuit.
    const inscription = user.user_metadata?.inscription as { entreprise?: string; effectif?: string } | undefined;
    if (!estAdmin && inscription?.entreprise) {
      const { error: erreurCreation } = await supabase.rpc("creer_mon_espace", { p_nom: inscription.entreprise, p_effectif: inscription.effectif ?? "" });
      if (!erreurCreation) {
        rechargerVers("/");
        return;
      }
    }
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
    .select("nom, actif, groupe_id, groupes(nom), abonnement, essai_fin, offre, periodicite, abonnement_fin, stripe_abonnement")
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

  const statutAbonnement = (entreprise.abonnement as StatutAbonnement | null) ?? "actif";
  const abonnement: Abonnement = {
    statut: statutAbonnement,
    acces: estAdmin ? "complet" : accesEntreprise({ abonnement: statutAbonnement, essaiFin: entreprise.essai_fin as string | null }),
    essaiFin: (entreprise.essai_fin as string | null) ?? null,
    offre: (entreprise.offre as string | null) ?? null,
    periodicite: (entreprise.periodicite as Periodicite | null) ?? null,
    fin: (entreprise.abonnement_fin as string | null) ?? null,
    stripe: !!entreprise.stripe_abonnement,
  };

  publier({
    statut: "pret",
    email,
    admin: estAdmin,
    role: abonnement.acces === "lecture" ? "lecteur" : role,
    roleCompte: role,
    abonnement,
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
  if (MODE_TEST) {
    enAttente = [];
    publier({ enregistrement: "enregistre" });
    return;
  }
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
  const essai = session.abonnement.acces === "essai";
  if (!ops.every((op) => operationAutorisee(session.role, op) && (!essai || operationPermiseEssai(op)))) {
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
