import Stripe from "stripe";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Faux Stripe et faux client Supabase « administrateur » : on observe ce que les routes leur demandent.
const etat = vi.hoisted(() => ({
  abonnement: { id: "sub_1", status: "active", customer: "cus_1", metadata: { entreprise_id: "10000000-0000-0000-0000-000000000001" } as Record<string, string>, items: { data: [{ current_period_end: 1_798_761_600, price: { lookup_key: "frisk_du_pe_mois" } }] } },
  entreprise: { id: "10000000-0000-0000-0000-000000000001", nom: "ACME", abonnement: "essai", stripe_client: null as string | null, stripe_abonnement: null as string | null },
  mises: [] as Record<string, unknown>[],
  sessions: [] as Record<string, unknown>[],
  responsable: true,
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/serveur", () => ({
  supabaseServeur: async () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }),
  supabaseAdmin: () => ({
    from: () => {
      const requete = {
        select: () => requete,
        eq: () => requete,
        maybeSingle: async () => ({ data: etat.entreprise }),
        update: (maj: Record<string, unknown>) => {
          etat.mises.push(maj);
          return { eq: async () => ({ error: null }) };
        },
      };
      return requete;
    },
  }),
}));

vi.mock("@/lib/stripe", async () => {
  const vrai = await vi.importActual<typeof import("@/lib/stripe")>("@/lib/stripe");
  const reel = new Stripe("sk_test_faux");
  const client = {
    webhooks: reel.webhooks,
    subscriptions: { retrieve: async () => etat.abonnement },
    prices: { list: async () => ({ data: [{ id: "price_pe_mois", lookup_key: "frisk_du_pe_mois", unit_amount: 4900, currency: "eur", tax_behavior: "exclusive" }] }) },
    customers: { create: async () => ({ id: "cus_nouveau" }) },
    checkout: {
      sessions: {
        create: async (s: Record<string, unknown>) => {
          etat.sessions.push(s);
          return { url: "https://checkout.stripe.com/c/pay/test" };
        },
      },
    },
  };
  return {
    ...vrai,
    stripe: () => client,
    responsableConnecte: async () => (etat.responsable ? { email: "resp@acme.fr" } : null),
  };
});

const { POST: webhook } = await import("@/app/api/stripe/webhook/route");
const { POST: paiement } = await import("@/app/api/abonnement/paiement/route");

const SECRET = "whsec_test";
function notification(type: string, objet: Record<string, unknown>, secret = SECRET) {
  const corps = JSON.stringify({ id: "evt_1", object: "event", type, data: { object: objet } });
  const signature = Stripe.webhooks.generateTestHeaderString({ payload: corps, secret });
  return new Request("https://du.frisk.fr/api/stripe/webhook", { method: "POST", body: corps, headers: { "stripe-signature": signature } });
}

beforeEach(() => {
  process.env.STRIPE_WEBHOOK_SECRET = SECRET;
  etat.mises = [];
  etat.sessions = [];
  etat.responsable = true;
  etat.abonnement.status = "active";
  etat.entreprise = { ...etat.entreprise, abonnement: "essai", stripe_client: null, stripe_abonnement: null };
});

describe("notifications de Stripe", () => {
  it("refusent une signature invalide", async () => {
    const r = await webhook(notification("customer.subscription.updated", { id: "sub_1" }, "whsec_autre"));
    expect(r.status).toBe(400);
    expect(etat.mises).toEqual([]);
  });

  it("activent l'abonnement après le paiement", async () => {
    const r = await webhook(notification("checkout.session.completed", { subscription: "sub_1", client_reference_id: etat.entreprise.id }));
    expect(r.status).toBe(200);
    expect(etat.mises).toEqual([
      { abonnement: "actif", offre: "pe", periodicite: "mois", abonnement_fin: "2027-01-01T00:00:00.000Z", stripe_abonnement: "sub_1", stripe_client: "cus_1" },
    ]);
  });

  it("passent l'espace en lecture seule à la résiliation", async () => {
    etat.abonnement.status = "canceled";
    etat.entreprise.stripe_abonnement = "sub_1";
    await webhook(notification("customer.subscription.deleted", { id: "sub_1", metadata: etat.abonnement.metadata }));
    expect(etat.mises[0]).toMatchObject({ abonnement: "termine" });
  });

  it("n'écrasent pas l'abonnement en cours avec un ancien abonnement résilié", async () => {
    etat.abonnement.status = "canceled";
    etat.entreprise.stripe_abonnement = "sub_nouveau";
    await webhook(notification("customer.subscription.deleted", { id: "sub_1", metadata: etat.abonnement.metadata }));
    expect(etat.mises).toEqual([]);
  });

  it("ignorent les autres notifications", async () => {
    const r = await webhook(notification("customer.created", { id: "cus_1" }));
    expect(r.status).toBe(200);
    expect(etat.mises).toEqual([]);
  });
});

describe("souscription", () => {
  const demande = (corps: Record<string, unknown>) =>
    paiement(new Request("https://du.frisk.fr/api/abonnement/paiement", { method: "POST", body: JSON.stringify({ entrepriseId: etat.entreprise.id, offre: "pe", periodicite: "mois", cgv: true, ...corps }) }));

  it("ouvre le paiement Stripe pour le responsable, avec l'entreprise en référence", async () => {
    const r = await demande({});
    expect(await r.json()).toEqual({ url: "https://checkout.stripe.com/c/pay/test" });
    expect(etat.mises).toEqual([{ stripe_client: "cus_nouveau" }]);
    expect(etat.sessions[0]).toMatchObject({
      mode: "subscription",
      customer: "cus_nouveau",
      client_reference_id: etat.entreprise.id,
      line_items: [{ price: "price_pe_mois", quantity: 1 }],
      subscription_data: { metadata: { entreprise_id: etat.entreprise.id } },
    });
  });

  it("refuse sans responsable, sans conditions de vente, ou si déjà abonné", async () => {
    etat.responsable = false;
    expect((await demande({})).status).toBe(403);
    etat.responsable = true;
    expect((await demande({ cgv: false })).status).toBe(400);
    expect((await demande({ offre: "gratuit" })).status).toBe(400);
    etat.entreprise = { ...etat.entreprise, abonnement: "actif", stripe_abonnement: "sub_1" };
    expect((await demande({})).status).toBe(409);
    expect(etat.sessions).toEqual([]);
  });
});
