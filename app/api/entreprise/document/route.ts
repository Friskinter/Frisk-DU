import { lireFiche } from "@/lib/lecture-fiche";
import { DocumentIlisible, TAILLE_MAX_DOCUMENT, formatDocument, texteDuDocument } from "@/lib/lecture-document";
import { MODE_TEST } from "@/lib/mode-test";
import { chercherEntreprises } from "@/lib/repertoire-entreprises";
import { supabaseServeur } from "@/lib/supabase/serveur";

// Fiche d'entreprise déposée par le client (Kbis, avis de situation de l'INSEE, fiche interne) : le
// document est lu par le serveur puis oublié (rien n'est enregistré). Si un SIRET ou un SIREN y figure,
// la fiche officielle complète ce que le document ne dit pas. Réservé aux utilisateurs connectés.

const LIMITE_PAR_HEURE = 20;
const depots = new Map<string, number[]>();
const refus = (erreur: string, status: number) => Response.json({ erreur }, { status });

export async function POST(requete: Request) {
  let utilisateur = "test";
  if (!MODE_TEST) {
    const { data } = await (await supabaseServeur()).auth.getUser();
    if (!data.user) return refus("Connectez-vous pour importer votre fiche.", 401);
    utilisateur = data.user.id;
  }
  const maintenant = Date.now();
  const recents = (depots.get(utilisateur) ?? []).filter((t) => t > maintenant - 3_600_000);
  if (recents.length >= LIMITE_PAR_HEURE) return refus("Trop d'imports : réessayez dans une heure.", 429);
  depots.set(utilisateur, [...recents, maintenant]);

  const formulaire = await requete.formData().catch(() => null);
  const fichier = formulaire?.get("document");
  if (!(fichier instanceof File)) return refus("Aucun document reçu.", 400);
  if (fichier.size > TAILLE_MAX_DOCUMENT) return refus("Document trop lourd : 4 Mo au maximum.", 413);
  const format = formatDocument(fichier.name, fichier.type);
  if (!format) return refus("Format non pris en charge : déposez un PDF, un document Word (.docx), un classeur Excel (.xlsx) ou un fichier texte.", 415);

  let texte: string;
  try {
    texte = await texteDuDocument(format, new Uint8Array(await fichier.arrayBuffer()));
  } catch (e) {
    return refus(e instanceof DocumentIlisible ? e.message : "Ce document n'a pas pu être lu.", 422);
  }
  if (texte.replace(/\s/g, "").length < 20) {
    return refus("Ce document ne contient pas de texte lisible (un scan ou une photo, par exemple). Utilisez la recherche par SIRET, ou un PDF téléchargé depuis Infogreffe ou l'INSEE.", 422);
  }

  const lecture = lireFiche(texte);
  // Le répertoire officiel complète, sans jamais remplacer ce que dit le document.
  let officielle = null;
  if (lecture.siret || lecture.siren) {
    officielle = (await chercherEntreprises(lecture.siret ?? lecture.siren!, 1).catch(() => []))[0] ?? null;
  }
  return Response.json({ document: lecture.champs, officielle });
}
