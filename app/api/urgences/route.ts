import { calculerAlertes } from "@/lib/alertes";
import { dateDuJour } from "@/lib/calculs";
import { normaliser } from "@/lib/donnees";
import { emailUrgences } from "@/lib/email-alertes";
import { envoyerEmail, journaliserEnvois, purgerJournal, signalerConfigurationManquante, type LigneEnvoi } from "@/lib/envoi-email";
import { destinatairesAvecRole } from "@/lib/preferences-email";
import { supabaseAdmin } from "@/lib/supabase/serveur";
import type { Donnees } from "@/lib/types";
import { nouvellesUrgences } from "@/lib/urgences";

// E-mails immédiats : chaque matin, les urgences apparues depuis le dernier envoi (accident à
// déclarer, rupture d'EPI, action en retard…), en un seul e-mail par entreprise, aux personnes qui
// ont gardé « E-mails immédiats » dans Mon compte. Appelé par le planificateur de l'hébergeur
// (vercel.json) avec l'en-tête « Authorization: Bearer <CRON_SECRET> ». Avec ?apercu=1, rien n'est
// envoyé ni retenu : la réponse liste les e-mails qui seraient partis.
export async function GET(requete: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || requete.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ erreur: "Accès refusé." }, { status: 401 });
  }
  const admin = supabaseAdmin();
  if (!admin) return Response.json({ erreur: "SUPABASE_SECRET_KEY manquante." }, { status: 500 });

  const apercu = new URL(requete.url).searchParams.get("apercu") === "1";
  const cleResend = process.env.RESEND_API_KEY;
  const expediteur = process.env.ALERTES_EXPEDITEUR;
  if (!apercu && (!cleResend || !expediteur)) {
    await signalerConfigurationManquante(admin, "/api/urgences");
    return Response.json({ erreur: "RESEND_API_KEY ou ALERTES_EXPEDITEUR manquante." }, { status: 500 });
  }
  const aujourdhui = dateDuJour();
  const urlApplication = process.env.URL_APPLICATION ?? new URL(requete.url).origin;

  const [{ data: entreprises, error }, { data: preferences, error: erreurPreferences }, { data: signalees, error: erreurSignalees }] =
    await Promise.all([
      admin.from("entreprises").select("id, nom, membres(user_id, email, role), espaces(contenu), versions(created_at)").eq("actif", true),
      admin.from("preferences_email").select("user_id, entreprise_id, recapitulatif, immediats"),
      admin.from("alertes_envoyees").select("entreprise_id, cle"),
    ]);
  if (error || erreurPreferences || erreurSignalees) {
    return Response.json({ erreur: "Lecture des entreprises, des préférences ou des urgences signalées impossible." }, { status: 500 });
  }

  const rapport: { entreprise: string; destinataires: string[]; urgences: number; envoye: boolean }[] = [];

  // Journal des e-mails : conservation limitée à 90 jours.
  if (!apercu) await purgerJournal(admin);

  for (const e of entreprises ?? []) {
    const donnees = (e.espaces as unknown as { contenu: Donnees } | null)?.contenu;
    if (!donnees) continue;
    const dates = ((e.versions ?? []) as { created_at: string }[]).map((v) => v.created_at.slice(0, 10)).sort();
    const alertes = calculerAlertes(normaliser(donnees), aujourdhui, dates.at(-1) ?? null);
    const deja = new Set(((signalees ?? []) as { entreprise_id: string; cle: string }[]).filter((s) => s.entreprise_id === e.id).map((s) => s.cle));
    const { aSignaler, nouvelles, reglees } = nouvellesUrgences(alertes, deja);
    const pour = destinatairesAvecRole((e.membres ?? []) as { user_id: string; email: string; role: string }[], e.id, preferences ?? [], "immediats");

    let envoye = false;
    if (aSignaler.length && pour.length && !apercu && cleResend && expediteur) {
      // Un e-mail par destinataire : les adresses des collègues ne sont pas dévoilées, et le
      // contenu suit le rôle de chacun (détail complet pour les responsables).
      const journal: LigneEnvoi[] = [];
      for (const { email: to, role } of pour) {
        const { sujet, html, texte } = emailUrgences(e.nom, aSignaler, aujourdhui, urlApplication, role);
        const resultat = await envoyerEmail(cleResend, { from: expediteur, to, subject: sujet, html, text: texte });
        journal.push({ type: "urgences", entreprise_id: e.id, destinataire: to, ...resultat });
      }
      await journaliserEnvois(admin, journal);
      envoye = journal.every((l) => l.reussi);
    }
    if (aSignaler.length) rapport.push({ entreprise: e.nom, destinataires: pour.map((d) => d.email), urgences: aSignaler.length, envoye });

    // Retenir les urgences signalées (ou sans destinataire), oublier celles qui sont réglées.
    // Si l'envoi a échoué, rien n'est retenu : elles repartiront demain.
    if (apercu || (aSignaler.length && pour.length && !envoye)) continue;
    if (nouvelles.length) {
      await admin.from("alertes_envoyees").upsert(nouvelles.map((cle) => ({ entreprise_id: e.id, cle })), { onConflict: "entreprise_id,cle" });
    }
    if (reglees.length) {
      await admin.from("alertes_envoyees").delete().eq("entreprise_id", e.id).in("cle", reglees);
    }
  }

  return Response.json({ date: aujourdhui, apercu, rapport });
}
