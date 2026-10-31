// Envoi d'un e-mail par Resend, et journal de chaque envoi (table envois_email, migration 022),
// consultable par Frisk dans la console : on voit ce qui est parti, et pourquoi un envoi a échoué.

import type { supabaseAdmin } from "./supabase/serveur";

export type TypeEnvoi = "recapitulatif" | "urgences" | "signalement";
export type Message = { from: string; to: string; subject: string; html: string; text: string };
export type ResultatEnvoi = { reussi: boolean; erreur: string };
export type LigneEnvoi = { type: TypeEnvoi; entreprise_id: string; destinataire: string } & ResultatEnvoi;

type Admin = NonNullable<ReturnType<typeof supabaseAdmin>>;

export const libellesEnvoi: Record<TypeEnvoi, string> = {
  recapitulatif: "Récapitulatif du lundi",
  urgences: "Urgences",
  signalement: "Signalement terrain",
};

const LONGUEUR_ERREUR = 500;
export const CONSERVATION_JOURS = 90;

// Raison d'un refus de Resend, d'après sa réponse (ex. « Resend 422 : Invalid `to` field »).
export async function raisonRefus(reponse: Response) {
  let message = reponse.statusText;
  try {
    const corps = (await reponse.json()) as { message?: unknown };
    if (typeof corps.message === "string" && corps.message) message = corps.message;
  } catch {
    // Réponse sans JSON : le code suffit.
  }
  return `Resend ${reponse.status}${message ? ` : ${message}` : ""}`.slice(0, LONGUEUR_ERREUR);
}

// Envoie un e-mail ; ne lève jamais d'erreur, pour que les autres destinataires soient servis.
export async function envoyerEmail(cle: string, message: Message): Promise<ResultatEnvoi> {
  try {
    const reponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${cle}`, "Content-Type": "application/json" },
      body: JSON.stringify(message),
    });
    return reponse.ok ? { reussi: true, erreur: "" } : { reussi: false, erreur: await raisonRefus(reponse) };
  } catch (e) {
    return { reussi: false, erreur: `Resend injoignable : ${e instanceof Error ? e.message : String(e)}`.slice(0, LONGUEUR_ERREUR) };
  }
}

// Note les envois dans le journal. Un échec d'écriture n'empêche pas la suite des envois.
export async function journaliserEnvois(admin: Admin, lignes: LigneEnvoi[]) {
  if (!lignes.length) return;
  try {
    await admin.from("envois_email").insert(lignes);
  } catch {
    // Le journal n'est qu'une aide au suivi.
  }
}

// Retire du journal les envois de plus de 90 jours (l'adresse du destinataire est une donnée personnelle).
export async function purgerJournal(admin: Admin) {
  try {
    await admin.from("envois_email").delete().lt("created_at", new Date(Date.now() - CONSERVATION_JOURS * 86_400_000).toISOString());
  } catch {
    // Sera refait demain.
  }
}

// Envoi automatique impossible faute de configuration : noté dans les erreurs de la console.
export async function signalerConfigurationManquante(admin: Admin, page: string) {
  try {
    await admin.from("erreurs").insert({
      origine: "serveur",
      message: "E-mails non envoyés : RESEND_API_KEY ou ALERTES_EXPEDITEUR manquante dans Vercel.",
      page,
    });
  } catch {
    // Rien de plus à faire.
  }
}

// Ligne du journal telle que la console la lit.
export type EnvoiJournal = {
  id: number;
  created_at: string;
  type: TypeEnvoi;
  destinataire: string;
  reussi: boolean;
  erreur: string;
  entreprises: { nom: string } | null;
};

// Envois réussis et échecs des 7 derniers jours.
export function bilanEnvois(envois: Pick<EnvoiJournal, "created_at" | "reussi">[], maintenant: number) {
  const recents = envois.filter((e) => new Date(e.created_at).getTime() > maintenant - 7 * 86_400_000);
  return { reussis: recents.filter((e) => e.reussi).length, echecs: recents.filter((e) => !e.reussi).length };
}
