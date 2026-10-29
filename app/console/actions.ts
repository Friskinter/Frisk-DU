"use server";

import { randomInt } from "node:crypto";
import { dateDuJour } from "@/lib/calculs";
import { donneesDemo, donneesVides } from "@/lib/demo";
import { supabaseAdmin, supabaseServeur } from "@/lib/supabase/serveur";

export type Resultat = { ok: true; message: string; motDePasse?: string } | { ok: false; message: string };

const SANS_CLE =
  "La clé secrète Supabase n'est pas configurée (variable SUPABASE_SECRET_KEY) : impossible de gérer les comptes.";

// Lettres et chiffres sans caractères ambigus (0/O, 1/l/I) pour une transmission facile.
function motDePasseProvisoire() {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  return Array.from({ length: 12 }, () => alphabet[randomInt(alphabet.length)]).join("");
}

async function verifierAdmin() {
  const supabase = await supabaseServeur();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return false;
  // Double authentification activée mais non validée pour cette session : refus.
  const { data: niveau } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (niveau?.nextLevel === "aal2" && niveau.currentLevel !== "aal2") return false;
  const { data: admin } = await supabase.from("admins_frisk").select("user_id").eq("user_id", data.user.id).maybeSingle();
  return !!admin;
}

type ClientAdmin = NonNullable<ReturnType<typeof supabaseAdmin>>;

// Crée le compte s'il n'existe pas encore ; sinon le retrouve.
async function obtenirUtilisateur(admin: ClientAdmin, email: string) {
  const motDePasse = motDePasseProvisoire();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: motDePasse,
    email_confirm: true,
    user_metadata: { mot_de_passe_provisoire: true },
  });
  if (data.user) return { id: data.user.id, motDePasse };
  if (error?.code !== "email_exists") return null;

  for (let page = 1; page <= 20; page++) {
    const { data: liste } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    const existant = liste.users.find((u) => u.email?.toLowerCase() === email);
    if (existant) return { id: existant.id, motDePasse: undefined };
    if (liste.users.length < 1000) break;
  }
  return null;
}

export async function creerClient(nom: string, email: string, demo: boolean): Promise<Resultat> {
  if (!(await verifierAdmin())) return { ok: false, message: "Accès réservé aux administrateurs Frisk." };
  const admin = supabaseAdmin();
  if (!admin) return { ok: false, message: SANS_CLE };

  nom = nom.trim();
  email = email.trim().toLowerCase();
  if (!nom || !email.includes("@")) return { ok: false, message: "Indiquez le nom de l'entreprise et un e-mail valide." };

  const { data: entreprise, error } = await admin.from("entreprises").insert({ nom }).select("id").single();
  if (error || !entreprise) return { ok: false, message: "L'entreprise n'a pas pu être créée." };

  const utilisateur = await obtenirUtilisateur(admin, email);
  if (!utilisateur) {
    await admin.from("entreprises").delete().eq("id", entreprise.id);
    return { ok: false, message: "Le compte utilisateur n'a pas pu être créé. Vérifiez l'adresse e-mail." };
  }

  const contenu = demo ? { ...donneesDemo(dateDuJour()), entreprise: nom } : { ...donneesVides(), entreprise: nom };
  const membre = await admin.from("membres").insert({ user_id: utilisateur.id, entreprise_id: entreprise.id, email, role: "responsable" });
  const espace = membre.error ? null : await admin.from("espaces").insert({ entreprise_id: entreprise.id, contenu });
  if (membre.error || espace?.error) {
    // Pas de client à moitié créé : la suppression de l'entreprise retire aussi le rattachement.
    await admin.from("entreprises").delete().eq("id", entreprise.id);
    return { ok: false, message: "Le client n'a pas pu être créé entièrement. Réessayez dans un instant." };
  }

  return {
    ok: true,
    message: utilisateur.motDePasse
      ? `Client « ${nom} » créé.`
      : `Client « ${nom} » créé. ${email} avait déjà un compte : il garde son mot de passe actuel.`,
    motDePasse: utilisateur.motDePasse,
  };
}

const roles = ["responsable", "contributeur", "lecteur"] as const;

export async function ajouterUtilisateur(
  entrepriseId: string,
  email: string,
  role: (typeof roles)[number],
): Promise<Resultat> {
  if (!(await verifierAdmin())) return { ok: false, message: "Accès réservé aux administrateurs Frisk." };
  const admin = supabaseAdmin();
  if (!admin) return { ok: false, message: SANS_CLE };

  if (!roles.includes(role)) return { ok: false, message: "Rôle inconnu." };
  email = email.trim().toLowerCase();
  const utilisateur = await obtenirUtilisateur(admin, email);
  if (!utilisateur) return { ok: false, message: "Le compte n'a pas pu être créé. Vérifiez l'adresse e-mail." };

  const { error } = await admin
    .from("membres")
    .upsert({ user_id: utilisateur.id, entreprise_id: entrepriseId, email, role });
  if (error) return { ok: false, message: "L'utilisateur n'a pas pu être rattaché à l'entreprise." };
  return {
    ok: true,
    message: utilisateur.motDePasse ? `${email} a été ajouté.` : `${email} avait déjà un compte : il garde son mot de passe.`,
    motDePasse: utilisateur.motDePasse,
  };
}

export async function reinitialiserMotDePasse(userId: string): Promise<Resultat> {
  if (!(await verifierAdmin())) return { ok: false, message: "Accès réservé aux administrateurs Frisk." };
  const admin = supabaseAdmin();
  if (!admin) return { ok: false, message: SANS_CLE };

  const motDePasse = motDePasseProvisoire();
  const { error } = await admin.auth.admin.updateUserById(userId, {
    password: motDePasse,
    user_metadata: { mot_de_passe_provisoire: true },
  });
  if (error) return { ok: false, message: "Le mot de passe n'a pas pu être réinitialisé." };
  return { ok: true, message: "Nouveau mot de passe provisoire créé.", motDePasse };
}

// Téléphone perdu : retire la double authentification d'un utilisateur, qui se reconnecte avec son
// seul mot de passe puis peut la réactiver.
export async function reinitialiserDoubleAuth(userId: string): Promise<Resultat> {
  if (!(await verifierAdmin())) return { ok: false, message: "Accès réservé aux administrateurs Frisk." };
  const admin = supabaseAdmin();
  if (!admin) return { ok: false, message: SANS_CLE };

  const { data, error } = await admin.auth.admin.mfa.listFactors({ userId });
  if (error) return { ok: false, message: "La double authentification n'a pas pu être lue." };
  if (!data.factors.length) return { ok: true, message: "Cet utilisateur n'avait pas de double authentification." };
  for (const facteur of data.factors) {
    const { error: erreur } = await admin.auth.admin.mfa.deleteFactor({ userId, id: facteur.id });
    if (erreur) return { ok: false, message: "La double authentification n'a pas pu être retirée." };
  }
  return { ok: true, message: "Double authentification retirée : l'utilisateur se connecte avec son mot de passe et peut la réactiver." };
}

// ---------- Données d'un client : export complet et suppression définitive (RGPD, fin de contrat) ----------

const BUCKET = "attestations";

// Fichiers du client dans le stockage : <entreprise>/<élément>/<fichier>.
async function fichiersDuClient(admin: ClientAdmin, entrepriseId: string) {
  const chemins: string[] = [];
  const { data: dossiers } = await admin.storage.from(BUCKET).list(entrepriseId, { limit: 1000 });
  for (const dossier of dossiers ?? []) {
    const { data: fichiers } = await admin.storage.from(BUCKET).list(`${entrepriseId}/${dossier.name}`, { limit: 1000 });
    for (const f of fichiers ?? []) chemins.push(`${entrepriseId}/${dossier.name}/${f.name}`);
  }
  return chemins;
}

// Lecture par pages : la base ne renvoie pas plus de 1 000 lignes à la fois.
async function toutLire<T>(lire: (debut: number, fin: number) => PromiseLike<{ data: T[] | null; error: unknown }>) {
  const lignes: T[] = [];
  for (let debut = 0; ; debut += 1000) {
    const { data, error } = await lire(debut, debut + 999);
    if (error) throw error;
    lignes.push(...(data ?? []));
    if (!data || data.length < 1000) return lignes;
  }
}

export type Export = { ok: true; nom: string; contenu: string } | { ok: false; message: string };

export async function exporterClient(entrepriseId: string): Promise<Export> {
  if (!(await verifierAdmin())) return { ok: false, message: "Accès réservé aux administrateurs Frisk." };
  const admin = supabaseAdmin();
  if (!admin) return { ok: false, message: SANS_CLE };

  try {
    const { data: entreprise } = await admin.from("entreprises").select("id, nom, actif, created_at").eq("id", entrepriseId).single();
    if (!entreprise) return { ok: false, message: "Client introuvable." };
    const [{ data: membres }, { data: espace }, versions, journal, fichiers] = await Promise.all([
      admin.from("membres").select("email, role, created_at").eq("entreprise_id", entrepriseId),
      admin.from("espaces").select("contenu, updated_at").eq("entreprise_id", entrepriseId).maybeSingle(),
      toutLire((a, b) => admin.from("versions").select("numero, motif, auteur, created_at, contenu").eq("entreprise_id", entrepriseId).order("numero").range(a, b)),
      toutLire((a, b) =>
        admin.from("journal").select("created_at, auteur, collection, element_id, action, avant, apres").eq("entreprise_id", entrepriseId).order("id").range(a, b),
      ),
      fichiersDuClient(admin, entrepriseId),
    ]);
    // Liens de téléchargement des fichiers joints, valables 7 jours.
    const { data: liens } = fichiers.length ? await admin.storage.from(BUCKET).createSignedUrls(fichiers, 7 * 24 * 3600) : { data: [] };
    const contenu = {
      format: "Frisk Plateforme – export complet",
      exporteLe: new Date().toISOString(),
      entreprise,
      utilisateurs: membres ?? [],
      donnees: espace?.contenu ?? null,
      derniereModification: espace?.updated_at ?? null,
      versionsDuDocumentUnique: versions,
      journalDesModifications: journal,
      fichiers: (liens ?? []).map((l) => ({ chemin: l.path, lienValable7Jours: l.signedUrl })),
    };
    return { ok: true, nom: `Frisk Plateforme - export complet - ${entreprise.nom} - ${new Date().toISOString().slice(0, 10)}.json`, contenu: JSON.stringify(contenu, null, 2) };
  } catch {
    return { ok: false, message: "L'export n'a pas pu être réalisé. Réessayez dans un instant." };
  }
}

// Suppression définitive : fichiers, versions figées, journal, données, accès, puis comptes devenus
// orphelins (rattachés à aucune autre entreprise). Le nom exact de l'entreprise est demandé.
export async function supprimerClient(entrepriseId: string, nomConfirme: string): Promise<Resultat> {
  if (!(await verifierAdmin())) return { ok: false, message: "Accès réservé aux administrateurs Frisk." };
  const admin = supabaseAdmin();
  if (!admin) return { ok: false, message: SANS_CLE };

  const { data: entreprise } = await admin.from("entreprises").select("nom, groupe_id").eq("id", entrepriseId).single();
  if (!entreprise) return { ok: false, message: "Client introuvable." };
  if (nomConfirme.trim() !== entreprise.nom) return { ok: false, message: "Le nom saisi ne correspond pas : rien n'a été supprimé." };

  const fichiers = await fichiersDuClient(admin, entrepriseId);
  for (let i = 0; i < fichiers.length; i += 100) {
    const { error } = await admin.storage.from(BUCKET).remove(fichiers.slice(i, i + 100));
    if (error) return { ok: false, message: "Les fichiers joints n'ont pas pu être supprimés : rien d'autre n'a été effacé." };
  }

  const { data: membres } = await admin.from("membres").select("user_id").eq("entreprise_id", entrepriseId);
  // Les versions figées sont protégées contre la suppression par les utilisateurs ; seule la clé serveur peut les effacer.
  const { error: erreurVersions } = await admin.from("versions").delete().eq("entreprise_id", entrepriseId);
  if (erreurVersions) return { ok: false, message: "Les versions du document unique n'ont pas pu être supprimées." };
  // Journal, données et accès suivent la suppression de l'entreprise (suppression en cascade).
  const { error } = await admin.from("entreprises").delete().eq("id", entrepriseId);
  if (error) return { ok: false, message: "Le client n'a pas pu être supprimé." };

  let comptes = 0;
  for (const { user_id } of membres ?? []) {
    const [{ count }, { data: estAdmin }] = await Promise.all([
      admin.from("membres").select("user_id", { count: "exact", head: true }).eq("user_id", user_id),
      admin.from("admins_frisk").select("user_id").eq("user_id", user_id).maybeSingle(),
    ]);
    if (!count && !estAdmin) {
      const { error: erreurCompte } = await admin.auth.admin.deleteUser(user_id);
      if (!erreurCompte) comptes++;
    }
  }
  if (entreprise.groupe_id) {
    const { count } = await admin.from("entreprises").select("id", { count: "exact", head: true }).eq("groupe_id", entreprise.groupe_id);
    if (!count) await admin.from("groupes").delete().eq("id", entreprise.groupe_id);
  }

  return {
    ok: true,
    message: `« ${entreprise.nom} » a été supprimé définitivement : données, ${fichiers.length} fichier(s) joint(s), versions, journal et ${comptes} compte(s) utilisateur sans autre accès.`,
  };
}
