import { dateDuJour } from "@/lib/calculs";
import { normaliser } from "@/lib/donnees";
import { emailRecapitulatif } from "@/lib/email-alertes";
import { envoyerEmail, journaliserEnvois, signalerConfigurationManquante, type LigneEnvoi } from "@/lib/envoi-email";
import { destinatairesAvecRole } from "@/lib/preferences-email";
import { preparerRecapitulatif, recapitulatifVide } from "@/lib/recapitulatif";
import { supabaseAdmin } from "@/lib/supabase/serveur";
import type { Donnees } from "@/lib/types";

// Récapitulatif du lundi (urgences, échéances de la semaine, points à traiter, prochaine étape du
// parcours, lib/recapitulatif.ts), envoyé par e-mail aux utilisateurs de chaque entreprise.
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
  const expediteur = process.env.ALERTES_EXPEDITEUR; // ex. « Frisk Plateforme <alertes@frisk.fr> »
  if (!apercu && (!cleResend || !expediteur)) {
    await signalerConfigurationManquante(admin, "/api/alertes");
    return Response.json({ erreur: "RESEND_API_KEY ou ALERTES_EXPEDITEUR manquante." }, { status: 500 });
  }

  const aujourdhui = dateDuJour();
  const urlApplication = process.env.URL_APPLICATION ?? new URL(requete.url).origin;

  const { data: entreprises, error } = await admin
    .from("entreprises")
    .select("id, nom, jeton_signalement, membres(user_id, email, role), espaces(contenu), versions(created_at)")
    .eq("actif", true);
  if (error) return Response.json({ erreur: "Lecture des entreprises impossible." }, { status: 500 });
  // Préférences de chaque personne (récapitulatif du lundi oui ou non).
  const { data: preferences, error: erreurPreferences } = await admin
    .from("preferences_email")
    .select("user_id, entreprise_id, recapitulatif, immediats");
  if (erreurPreferences) return Response.json({ erreur: "Lecture des préférences d'e-mail impossible." }, { status: 500 });

  const rapport: { entreprise: string; destinataires: string[]; urgences: number; echeances: number; alertes: number; envoye: boolean }[] = [];

  // Suivi des erreurs : conservation limitée à 90 jours.
  if (!apercu) await admin.from("erreurs").delete().lt("created_at", new Date(Date.now() - 90 * 86_400_000).toISOString());

  for (const e of entreprises ?? []) {
    const donnees = (e.espaces as unknown as { contenu: Donnees } | null)?.contenu;
    const pour = destinatairesAvecRole((e.membres ?? []) as { user_id: string; email: string; role: string }[], e.id, preferences ?? [], "recapitulatif");
    const destinataires = pour.map((d) => d.email);
    if (!donnees || !destinataires.length || donnees.preferences?.alertesEmail === false) continue;

    const dates = ((e.versions ?? []) as { created_at: string }[]).map((v) => v.created_at.slice(0, 10)).sort();
    const recap = preparerRecapitulatif(normaliser(donnees), aujourdhui, {
      versions: dates.length,
      derniereVersion: dates.at(-1) ?? null,
      lienActif: !!e.jeton_signalement,
    });
    if (recapitulatifVide(recap)) continue;

    let envoye = false;
    if (!apercu && cleResend && expediteur) {
      // Un e-mail par destinataire : les adresses des collègues ne sont pas dévoilées, et le
      // contenu suit le rôle de chacun (détail complet pour les responsables).
      const journal: LigneEnvoi[] = [];
      for (const { email: to, role } of pour) {
        const { sujet, html, texte } = emailRecapitulatif(e.nom, recap, aujourdhui, urlApplication, role);
        const resultat = await envoyerEmail(cleResend, { from: expediteur, to, subject: sujet, html, text: texte });
        journal.push({ type: "recapitulatif", entreprise_id: e.id, destinataire: to, ...resultat });
      }
      await journaliserEnvois(admin, journal);
      envoye = journal.every((l) => l.reussi);
    }
    rapport.push({
      entreprise: e.nom,
      destinataires,
      urgences: recap.urgences.length,
      echeances: recap.echeances.length,
      alertes: recap.autres.length,
      envoye,
    });
  }

  return Response.json({ date: aujourdhui, apercu, rapport });
}
