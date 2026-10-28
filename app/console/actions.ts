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
  await admin.from("membres").insert({ user_id: utilisateur.id, entreprise_id: entreprise.id, email, role: "responsable" });
  await admin.from("espaces").insert({ entreprise_id: entreprise.id, contenu });

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
