import { dateDuJour } from "@/lib/calculs";
import { emailSignalement } from "@/lib/email-alertes";
import { envoyerEmail, journaliserEnvois, type LigneEnvoi } from "@/lib/envoi-email";
import { destinataires } from "@/lib/preferences-email";
import { couleurValide, logoValide } from "@/lib/identite";
import { typesEvenement } from "@/lib/referentiel";
import { evenementSignale, extensions, jetonValide, lireFormulaire, PHOTOS_MAX, TAILLE_ENVOI_MAX, TAILLE_PHOTO_MAX, typeImage } from "@/lib/signalement";
import { supabaseAdmin } from "@/lib/supabase/serveur";
import type { Donnees } from "@/lib/types";

// Signalement terrain, sans compte : le jeton secret du lien (QR code) désigne l'entreprise.
// GET : nom de l'entreprise et unités de travail, pour le formulaire.
// POST : enregistre le signalement et ses photos, puis prévient les responsables par e-mail.

const BUCKET = "attestations";
const LIMITE_PAR_HEURE = 30; // identique à la fonction signaler_evenement (migration 013)
const refus = (erreur: string, status: number) => Response.json({ erreur }, { status });

async function entrepriseDuJeton(jeton: unknown) {
  const admin = supabaseAdmin();
  if (!admin || !jetonValide(jeton)) return null;
  const { data } = await admin.from("entreprises").select("id, nom, actif").eq("jeton_signalement", jeton).maybeSingle();
  if (!data?.actif) return null;
  const { data: espace } = await admin.from("espaces").select("contenu").eq("entreprise_id", data.id).maybeSingle();
  const contenu = espace?.contenu as Donnees | undefined;
  const unites = [...new Set([...(contenu?.unites ?? []), ...(contenu?.duerp ?? []).map((l) => l.unite)].filter(Boolean))];
  const evenements = new Set((contenu?.evenements ?? []).map((e) => e.id));
  // Logo et couleur de l'entreprise, pour que le formulaire soit à ses couleurs.
  const identite = {
    ...(logoValide(contenu?.identite?.logo) ? { logo: contenu.identite.logo } : {}),
    ...(couleurValide(contenu?.identite?.couleur) ? { couleur: contenu.identite.couleur } : {}),
  };
  return { admin, id: data.id as string, nom: data.nom as string, unites, evenements, identite };
}

export async function GET(requete: Request) {
  const entreprise = await entrepriseDuJeton(new URL(requete.url).searchParams.get("jeton"));
  if (!entreprise) return refus("Ce lien de signalement n'est plus valable. Demandez le nouveau lien à votre responsable.", 404);
  return Response.json({ entreprise: entreprise.nom, unites: entreprise.unites, identite: entreprise.identite });
}

export async function POST(requete: Request) {
  if (Number(requete.headers.get("content-length") ?? 0) > TAILLE_ENVOI_MAX + 64 * 1024) {
    return refus("Photos trop lourdes : envoyez-en moins ou de plus petites.", 413);
  }
  let donnees: FormData;
  try {
    donnees = await requete.formData();
  } catch {
    return refus("Envoi incomplet. Réessayez.", 400);
  }
  const entreprise = await entrepriseDuJeton(donnees.get("jeton"));
  if (!entreprise) return refus("Ce lien de signalement n'est plus valable. Demandez le nouveau lien à votre responsable.", 404);

  const aujourdhui = dateDuJour();
  const lecture = lireFormulaire(Object.fromEntries([...donnees.entries()].filter(([, v]) => typeof v === "string")), aujourdhui);
  if (!lecture.ok) return refus(lecture.erreur, 400);
  const id = String(donnees.get("id") ?? "");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id)) return refus("Envoi incomplet. Réessayez.", 400);
  // Envoi répété (double appui, réseau instable) : déjà enregistré, rien à déposer ni à prévenir.
  if (entreprise.evenements.has(id)) return Response.json({ ok: true });

  const { admin } = entreprise;
  // Limite vérifiée avant tout dépôt de photo (la base la contrôle aussi à l'enregistrement).
  const { count } = await admin
    .from("journal")
    .select("id", { count: "exact", head: true })
    .eq("entreprise_id", entreprise.id)
    .eq("auteur", "Signalement terrain")
    .gt("created_at", new Date(Date.now() - 3600_000).toISOString());
  if ((count ?? 0) >= LIMITE_PAR_HEURE) return refus("Trop de signalements en une heure. Prévenez directement votre responsable.", 429);

  // Photos : nombre, taille et type réel vérifiés avant tout dépôt.
  const fichiers = donnees.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
  if (fichiers.length > PHOTOS_MAX) return refus(`${PHOTOS_MAX} photos au maximum.`, 400);
  const images: { octets: Uint8Array; type: string }[] = [];
  for (const f of fichiers) {
    if (f.size > TAILLE_PHOTO_MAX) return refus("Une photo est trop lourde.", 413);
    const octets = new Uint8Array(await f.arrayBuffer());
    const type = typeImage(octets);
    if (!type) return refus("Seules les photos (JPEG, PNG, WebP) sont acceptées.", 400);
    images.push({ octets, type });
  }

  const photos: { chemin: string; nom: string }[] = [];
  for (const [n, image] of images.entries()) {
    const nom = `photo-${n + 1}.${extensions[image.type]}`;
    const chemin = `${entreprise.id}/${id}/${Date.now()}-${nom}`;
    const { error } = await admin.storage.from(BUCKET).upload(chemin, image.octets, { contentType: image.type });
    if (error) {
      if (photos.length) await admin.storage.from(BUCKET).remove(photos.map((p) => p.chemin));
      return refus("L'envoi des photos a échoué. Réessayez.", 502);
    }
    photos.push({ chemin, nom });
  }

  const evenement = evenementSignale(lecture.formulaire, id, photos, entreprise.unites, new Date().toISOString());
  const { error } = await admin.rpc("signaler_evenement", { p_jeton: donnees.get("jeton"), p_evenement: evenement });
  if (error) {
    if (photos.length) await admin.storage.from(BUCKET).remove(photos.map((p) => p.chemin));
    if (error.code === "54000") return refus("Trop de signalements en une heure. Prévenez directement votre responsable.", 429);
    return refus("Le signalement n'a pas pu être enregistré. Réessayez.", 500);
  }

  await prevenirResponsables(entreprise, evenement, requete);
  return Response.json({ ok: true });
}

// E-mail aux responsables, si l'envoi d'e-mails est configuré. Un échec n'annule pas le signalement.
async function prevenirResponsables(
  entreprise: { admin: NonNullable<ReturnType<typeof supabaseAdmin>>; id: string; nom: string },
  evenement: ReturnType<typeof evenementSignale>,
  requete: Request,
) {
  const cle = process.env.RESEND_API_KEY;
  const expediteur = process.env.ALERTES_EXPEDITEUR;
  if (!cle || !expediteur) return;
  try {
    const [{ data }, { data: preferences }] = await Promise.all([
      entreprise.admin.from("membres").select("user_id, email").eq("entreprise_id", entreprise.id).eq("role", "responsable"),
      entreprise.admin.from("preferences_email").select("user_id, entreprise_id, recapitulatif, immediats").eq("entreprise_id", entreprise.id),
    ]);
    const url = process.env.URL_APPLICATION ?? new URL(requete.url).origin;
    const type = typesEvenement.find((t) => t.valeur === evenement.type)?.libelle ?? "Événement";
    const { sujet, html, texte } = emailSignalement(
      entreprise.nom, type, evenement.type === "accident-travail", `${url}/accidents?evenement=${evenement.id}`,
    );
    // Seulement les responsables qui n'ont pas coupé les e-mails immédiats.
    const journal: LigneEnvoi[] = [];
    for (const email of destinataires((data ?? []) as { user_id: string; email: string }[], entreprise.id, preferences ?? [], "immediats")) {
      const resultat = await envoyerEmail(cle, { from: expediteur, to: email, subject: sujet, html, text: texte });
      journal.push({ type: "signalement", entreprise_id: entreprise.id, destinataire: email, ...resultat });
    }
    await journaliserEnvois(entreprise.admin, journal);
  } catch {
    // Le signalement est enregistré ; l'e-mail n'est qu'une commodité.
  }
}
