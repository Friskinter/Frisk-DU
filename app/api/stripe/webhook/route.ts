import type Stripe from "stripe";
import { majDepuisStripe, type AbonnementStripe } from "@/lib/abonnement";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase/serveur";

// Notifications de Stripe (paiement réussi, renouvellement, impayé, résiliation), signées avec
// STRIPE_WEBHOOK_SECRET. L'état de l'abonnement est relu chez Stripe à chaque notification : l'ordre
// d'arrivée des notifications n'a donc pas d'importance.
const evenements = new Set([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.subscription.paused",
  "customer.subscription.resumed",
  "invoice.paid",
  "invoice.payment_failed",
]);

function abonnementConcerne(evenement: Stripe.Event): { abonnement: string | null; entreprise: string | null } {
  const objet = evenement.data.object as unknown as Record<string, unknown>;
  if (evenement.type === "checkout.session.completed") {
    return { abonnement: (objet.subscription as string | null) ?? null, entreprise: (objet.client_reference_id as string | null) ?? null };
  }
  if (evenement.type.startsWith("customer.subscription.")) {
    return { abonnement: objet.id as string, entreprise: ((objet.metadata as Record<string, string> | null)?.entreprise_id) ?? null };
  }
  // Factures : l'abonnement est indiqué dans les détails de la facture.
  const parent = objet.parent as { subscription_details?: { subscription?: string } } | null;
  return { abonnement: parent?.subscription_details?.subscription ?? (objet.subscription as string | null) ?? null, entreprise: null };
}

export async function POST(requete: Request) {
  const client = stripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const admin = supabaseAdmin();
  if (!client || !secret || !admin) return Response.json({ erreur: "Paiement non configuré." }, { status: 503 });

  let evenement: Stripe.Event;
  try {
    evenement = client.webhooks.constructEvent(await requete.text(), requete.headers.get("stripe-signature") ?? "", secret);
  } catch {
    return Response.json({ erreur: "Signature invalide." }, { status: 400 });
  }
  if (!evenements.has(evenement.type)) return Response.json({ recu: true });

  const { abonnement, entreprise: entrepriseIndiquee } = abonnementConcerne(evenement);
  if (!abonnement) return Response.json({ recu: true });

  const sub = (await client.subscriptions.retrieve(abonnement)) as unknown as AbonnementStripe;
  const maj = majDepuisStripe(sub);
  if (!maj) return Response.json({ recu: true });

  // Entreprise : celle indiquée à la souscription, sinon celle du client Stripe.
  const entrepriseId = sub.metadata?.entreprise_id ?? entrepriseIndiquee;
  const requeteEntreprise = admin.from("entreprises").select("id, stripe_abonnement");
  const { data: entreprise } = entrepriseId
    ? await requeteEntreprise.eq("id", entrepriseId).maybeSingle()
    : await requeteEntreprise.eq("stripe_client", maj.stripe_client).maybeSingle();
  if (!entreprise) return Response.json({ recu: true });

  // Un ancien abonnement (remplacé par un nouveau) ne doit pas écraser l'abonnement en cours.
  if (entreprise.stripe_abonnement && entreprise.stripe_abonnement !== sub.id && maj.abonnement !== "actif") {
    return Response.json({ recu: true });
  }

  const { error } = await admin.from("entreprises").update(maj).eq("id", entreprise.id);
  // En cas d'échec, Stripe renverra la notification plus tard.
  if (error) return Response.json({ erreur: "Mise à jour impossible." }, { status: 500 });
  return Response.json({ recu: true });
}
