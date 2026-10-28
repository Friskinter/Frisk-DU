import { calculerAlertes } from "@/lib/alertes";
import { dateDuJour } from "@/lib/calculs";
import { normaliser } from "@/lib/donnees";
import { emailAlertes } from "@/lib/email-alertes";
import { supabaseAdmin } from "@/lib/supabase/serveur";
import type { Donnees } from "@/lib/types";

// Récapitulatif hebdomadaire des alertes, envoyé par e-mail aux utilisateurs de chaque entreprise.
// Appelé chaque lundi par le planificateur de l'hébergeur (voir vercel.json), avec l'en-tête
// « Authorization: Bearer <CRON_SECRET> ». Avec ?apercu=1, rien n'est envoyé : la réponse liste
// les e-mails qui seraient partis.
export async function GET(requete: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || requete.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ erreur: "Accès refusé." }, { status: 401 });
  }
  const admin = supabaseAdmin();
  if (!admin) return Response.json({ erreur: "SUPABASE_SECRET_KEY manquante." }, { status: 500 });

  const apercu = new URL(requete.url).searchParams.get("apercu") === "1";
  const cleResend = process.env.RESEND_API_KEY;
  const expediteur = process.env.ALERTES_EXPEDITEUR; // ex. « Frisk DU <alertes@frisk.fr> »
  if (!apercu && (!cleResend || !expediteur)) {
    return Response.json({ erreur: "RESEND_API_KEY ou ALERTES_EXPEDITEUR manquante." }, { status: 500 });
  }

  const aujourdhui = dateDuJour();
  const urlApplication = process.env.URL_APPLICATION ?? new URL(requete.url).origin;

  const { data: entreprises, error } = await admin
    .from("entreprises")
    .select("id, nom, membres(email), espaces(contenu), versions(created_at)")
    .eq("actif", true);
  if (error) return Response.json({ erreur: "Lecture des entreprises impossible." }, { status: 500 });

  const rapport: { entreprise: string; destinataires: string[]; alertes: number; envoye: boolean }[] = [];

  for (const e of entreprises ?? []) {
    const donnees = (e.espaces as unknown as { contenu: Donnees } | null)?.contenu;
    const destinataires = ((e.membres ?? []) as { email: string }[]).map((m) => m.email);
    if (!donnees || !destinataires.length || donnees.preferences?.alertesEmail === false) continue;

    const dates = ((e.versions ?? []) as { created_at: string }[]).map((v) => v.created_at.slice(0, 10)).sort();
    const alertes = calculerAlertes(normaliser(donnees), aujourdhui, dates.at(-1) ?? null);
    if (!alertes.length) continue;

    let envoye = false;
    if (!apercu) {
      const { sujet, html, texte } = emailAlertes(e.nom, alertes, aujourdhui, urlApplication);
      const reponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${cleResend}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: expediteur, to: destinataires, subject: sujet, html, text: texte }),
      });
      envoye = reponse.ok;
    }
    rapport.push({ entreprise: e.nom, destinataires, alertes: alertes.length, envoye });
  }

  return Response.json({ date: aujourdhui, apercu, rapport });
}
