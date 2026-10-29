import { lireTarifs, stripe } from "@/lib/stripe";

// Prix des abonnements, lus dans Stripe. Sans clé Stripe : paiement en ligne pas encore configuré.
export async function GET() {
  const client = stripe();
  if (!client) return Response.json({ configure: false, tarifs: {} });
  try {
    const tarifs = await lireTarifs(client);
    return Response.json({
      configure: true,
      tarifs: Object.fromEntries(Object.entries(tarifs).map(([cle, t]) => [cle, { montant: t.montant, devise: t.devise, ht: t.ht }])),
    });
  } catch {
    return Response.json({ configure: false, tarifs: {} });
  }
}
