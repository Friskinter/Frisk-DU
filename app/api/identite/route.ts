import { adresseSite } from "@/lib/identite";
import { identiteDuSite } from "@/lib/identite-serveur";
import { MODE_TEST } from "@/lib/mode-test";
import { supabaseServeur } from "@/lib/supabase/serveur";

// Recherche du logo et de la couleur sur le site web de l'entreprise (réglages, identité visuelle).
// Réservée aux utilisateurs connectés ; le site est lu par le serveur, qui renvoie les images
// trouvées (le navigateur ne peut pas lire directement les images d'un autre site).

const LIMITE_PAR_HEURE = 20;
const recherches = new Map<string, number[]>();
const refus = (erreur: string, status: number) => Response.json({ erreur }, { status });

export async function POST(requete: Request) {
  let utilisateur = "test";
  if (!MODE_TEST) {
    const { data } = await (await supabaseServeur()).auth.getUser();
    if (!data.user) return refus("Connectez-vous pour rechercher votre site.", 401);
    utilisateur = data.user.id;
  }
  const maintenant = Date.now();
  const recentes = (recherches.get(utilisateur) ?? []).filter((t) => t > maintenant - 3_600_000);
  if (recentes.length >= LIMITE_PAR_HEURE) return refus("Trop de recherches : réessayez dans une heure ou déposez votre logo.", 429);
  recherches.set(utilisateur, [...recentes, maintenant]);

  const corps = (await requete.json().catch(() => null)) as { site?: unknown } | null;
  const site = typeof corps?.site === "string" && corps.site.length <= 300 ? adresseSite(corps.site) : null;
  if (!site) return refus("Adresse du site invalide. Exemple : www.mon-entreprise.fr", 400);

  try {
    return Response.json(await identiteDuSite(site));
  } catch {
    return refus("Impossible de lire ce site. Vérifiez l'adresse, ou déposez directement votre logo.", 422);
  }
}
