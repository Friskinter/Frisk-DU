import "server-only";
import Stripe from "stripe";
import { cleTarif, offres, type CodeOffre, type Periodicite } from "./abonnement";
import { MODE_TEST } from "./mode-test";
import { supabaseServeur } from "./supabase/serveur";

// Paiement des abonnements avec Stripe. Clés dans les variables d'environnement de l'hébergeur :
// STRIPE_SECRET_KEY (clé secrète) et STRIPE_WEBHOOK_SECRET (secret de signature des notifications).

export function stripe() {
  const cle = process.env.STRIPE_SECRET_KEY?.trim();
  return cle ? new Stripe(cle) : null;
}

export const toutesLesCles = offres.flatMap((o) => (["mois", "an"] as Periodicite[]).map((p) => cleTarif(o.code, p)));

export type Tarif = { montant: number; devise: string; ht: boolean };

// Prix définis dans Stripe, retrouvés par leur clé de recherche (frisk_du_<offre>_<periodicite>).
export async function lireTarifs(client: Stripe): Promise<Record<string, Tarif & { id: string }>> {
  const { data } = await client.prices.list({ lookup_keys: toutesLesCles, active: true, limit: 20 });
  return Object.fromEntries(
    data
      .filter((p) => p.lookup_key && p.unit_amount !== null)
      .map((p) => [p.lookup_key!, { id: p.id, montant: p.unit_amount! / 100, devise: p.currency, ht: p.tax_behavior !== "inclusive" }]),
  );
}

// L'utilisateur connecté est-il responsable de cette entreprise (ou administrateur Frisk) ?
export async function responsableConnecte(entrepriseId: unknown): Promise<{ email: string } | null> {
  if (typeof entrepriseId !== "string" || !/^[0-9a-f-]{36}$/.test(entrepriseId)) return null;
  if (MODE_TEST) return { email: "test@frisk.fr" };
  const supabase = await supabaseServeur();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  const { data: role } = await supabase.rpc("role_dans", { e: entrepriseId });
  return role === "responsable" || role === "admin" ? { email: data.user.email ?? "" } : null;
}

export function adresseApplication(requete: Request) {
  return process.env.URL_APPLICATION ?? new URL(requete.url).origin;
}

export type DemandePaiement = { offre: CodeOffre; periodicite: Periodicite };
