import { adresseApplication, responsableConnecte, stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase/serveur";

// Gestion de l'abonnement sur le portail Stripe : moyen de paiement, factures, changement d'offre, résiliation.
const refus = (erreur: string, status: number) => Response.json({ erreur }, { status });

export async function POST(requete: Request) {
  const corps = (await requete.json().catch(() => null)) as { entrepriseId?: unknown } | null;
  if (!(await responsableConnecte(corps?.entrepriseId))) return refus("Seul un responsable de l'entreprise peut gérer l'abonnement.", 403);
  const client = stripe();
  const admin = supabaseAdmin();
  if (!client || !admin) return refus("La gestion en ligne de l'abonnement n'est pas encore disponible. Contactez Frisk.", 503);
  const { data: entreprise } = await admin.from("entreprises").select("stripe_client").eq("id", corps!.entrepriseId as string).maybeSingle();
  if (!entreprise?.stripe_client) return refus("Aucun abonnement en ligne pour cette entreprise.", 404);
  try {
    const session = await client.billingPortal.sessions.create({
      customer: entreprise.stripe_client as string,
      return_url: `${adresseApplication(requete)}/abonnement`,
      locale: "fr",
    });
    return Response.json({ url: session.url });
  } catch {
    return refus("L'espace de gestion n'a pas pu être ouvert. Réessayez dans un instant.", 502);
  }
}
