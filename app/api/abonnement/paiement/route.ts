import { cleTarif, offreValide } from "@/lib/abonnement";
import { adresseApplication, lireTarifs, responsableConnecte, stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase/serveur";

// Souscription : ouvre la page de paiement sécurisée de Stripe pour l'offre choisie.
// L'abonnement n'est activé qu'à la réception de la notification signée de Stripe (webhook).
const refus = (erreur: string, status: number) => Response.json({ erreur }, { status });

export async function POST(requete: Request) {
  const corps = (await requete.json().catch(() => null)) as { entrepriseId?: unknown; offre?: unknown; periodicite?: unknown; cgv?: unknown } | null;
  const responsable = await responsableConnecte(corps?.entrepriseId);
  if (!responsable) return refus("Seul un responsable de l'entreprise peut souscrire l'abonnement.", 403);
  if (!offreValide(corps?.offre) || (corps?.periodicite !== "mois" && corps?.periodicite !== "an")) return refus("Offre inconnue.", 400);
  if (corps.cgv !== true) return refus("Acceptez les conditions générales de vente pour continuer.", 400);
  const client = stripe();
  const admin = supabaseAdmin();
  if (!client || !admin) return refus("Le paiement en ligne n'est pas encore disponible. Contactez Frisk pour vous abonner.", 503);

  const entrepriseId = corps.entrepriseId as string;
  const { data: entreprise } = await admin
    .from("entreprises")
    .select("nom, abonnement, stripe_client, stripe_abonnement")
    .eq("id", entrepriseId)
    .maybeSingle();
  if (!entreprise) return refus("Entreprise introuvable.", 404);
  if (entreprise.stripe_abonnement && (entreprise.abonnement === "actif" || entreprise.abonnement === "impaye")) {
    return refus("Votre abonnement est déjà actif : changez d'offre depuis « Gérer mon abonnement ».", 409);
  }

  try {
    const tarif = (await lireTarifs(client))[cleTarif(corps.offre, corps.periodicite)];
    if (!tarif) return refus("Ce tarif n'est pas encore disponible. Contactez Frisk pour vous abonner.", 503);

    let clientStripe = entreprise.stripe_client as string | null;
    if (!clientStripe) {
      const nouveau = await client.customers.create({
        email: responsable.email || undefined,
        name: entreprise.nom as string,
        metadata: { entreprise_id: entrepriseId },
        preferred_locales: ["fr"],
      });
      clientStripe = nouveau.id;
      await admin.from("entreprises").update({ stripe_client: clientStripe }).eq("id", entrepriseId);
    }

    const application = adresseApplication(requete);
    const session = await client.checkout.sessions.create({
      mode: "subscription",
      customer: clientStripe,
      client_reference_id: entrepriseId,
      line_items: [{ price: tarif.id, quantity: 1 }],
      subscription_data: { metadata: { entreprise_id: entrepriseId } },
      metadata: { entreprise_id: entrepriseId },
      allow_promotion_codes: true,
      billing_address_collection: "required",
      tax_id_collection: { enabled: true },
      customer_update: { address: "auto", name: "auto" },
      locale: "fr",
      success_url: `${application}/abonnement?paiement=ok`,
      cancel_url: `${application}/abonnement`,
    });
    return session.url ? Response.json({ url: session.url }) : refus("La page de paiement n'a pas pu être ouverte.", 502);
  } catch {
    return refus("La page de paiement n'a pas pu être ouverte. Réessayez dans un instant.", 502);
  }
}
