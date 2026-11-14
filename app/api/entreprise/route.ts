import { ficheDepuisResultat, lireRecherche, type ResultatApi } from "@/lib/fiche-officielle";
import { MODE_TEST } from "@/lib/mode-test";
import { supabaseServeur } from "@/lib/supabase/serveur";

// Recherche de la fiche officielle d'une entreprise (réglages) : par SIRET, SIREN ou nom, dans
// l'API publique « Recherche d'entreprises » de l'État. Réservée aux utilisateurs connectés.

const API = "https://recherche-entreprises.api.gouv.fr/search";
const LIMITE_PAR_HEURE = 30;
const recherches = new Map<string, number[]>();
const refus = (erreur: string, status: number) => Response.json({ erreur }, { status });

export async function POST(requete: Request) {
  let utilisateur = "test";
  if (!MODE_TEST) {
    const { data } = await (await supabaseServeur()).auth.getUser();
    if (!data.user) return refus("Connectez-vous pour rechercher votre entreprise.", 401);
    utilisateur = data.user.id;
  }
  const maintenant = Date.now();
  const recentes = (recherches.get(utilisateur) ?? []).filter((t) => t > maintenant - 3_600_000);
  if (recentes.length >= LIMITE_PAR_HEURE) return refus("Trop de recherches : réessayez dans une heure.", 429);
  recherches.set(utilisateur, [...recentes, maintenant]);

  const corps = (await requete.json().catch(() => null)) as { recherche?: unknown } | null;
  const recherche = typeof corps?.recherche === "string" ? lireRecherche(corps.recherche) : null;
  if (!recherche) return refus("Saisissez un SIRET (14 chiffres), un SIREN (9 chiffres) ou le nom de l'entreprise.", 400);

  try {
    const url = `${API}?${new URLSearchParams({ q: recherche, per_page: "5", etat_administratif: "A" })}`;
    const reponse = await fetch(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(8000) });
    if (!reponse.ok) throw new Error(String(reponse.status));
    const { results } = (await reponse.json()) as { results?: ResultatApi[] };
    return Response.json({ entreprises: (results ?? []).map(ficheDepuisResultat) });
  } catch {
    return refus("Le répertoire des entreprises ne répond pas. Réessayez dans un instant, ou remplissez la fiche à la main.", 502);
  }
}
