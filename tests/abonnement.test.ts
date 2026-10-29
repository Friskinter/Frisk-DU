import { describe, expect, it } from "vitest";
import {
  accesEntreprise,
  cleTarif,
  joursRestants,
  lireCleTarif,
  majDepuisStripe,
  moduleAbonne,
  modulesAbonnes,
  offreConseillee,
  operationPermiseEssai,
  statutDepuisStripe,
} from "@/lib/abonnement";
import { erreurIgnoree, lireRapport, pageSansSecret } from "@/lib/erreurs";
import { existsSync } from "node:fs";

const maintenant = new Date("2026-10-29T12:00:00Z");

describe("accès selon l'abonnement", () => {
  it("ouvre tout aux abonnés, même en attente de paiement", () => {
    expect(accesEntreprise({ abonnement: "actif", essaiFin: null }, maintenant)).toBe("complet");
    expect(accesEntreprise({ abonnement: "impaye", essaiFin: null }, maintenant)).toBe("complet");
  });

  it("limite l'essai, puis passe en lecture seule", () => {
    expect(accesEntreprise({ abonnement: "essai", essaiFin: "2026-11-01T12:00:00Z" }, maintenant)).toBe("essai");
    expect(accesEntreprise({ abonnement: "essai", essaiFin: "2026-10-29T11:59:00Z" }, maintenant)).toBe("lecture");
    expect(accesEntreprise({ abonnement: "essai", essaiFin: null }, maintenant)).toBe("lecture");
    expect(accesEntreprise({ abonnement: "termine", essaiFin: "2027-01-01T00:00:00Z" }, maintenant)).toBe("lecture");
  });

  it("compte les jours d'essai restants", () => {
    expect(joursRestants("2026-11-05T12:00:00Z", maintenant)).toBe(7);
    expect(joursRestants("2026-10-29T18:00:00Z", maintenant)).toBe(1);
    expect(joursRestants("2026-10-28T12:00:00Z", maintenant)).toBe(0);
  });

  it("pendant l'essai : document unique, plan d'actions, salariés et réglages seulement", () => {
    expect(operationPermiseEssai({ type: "ajout", collection: "duerp", id: "r", apres: null, valeur: { id: "r" } })).toBe(true);
    expect(operationPermiseEssai({ type: "modification", collection: "actions", id: "a", champs: {} })).toBe(true);
    expect(operationPermiseEssai({ type: "suppression", collection: "salaries", id: "s" })).toBe(true);
    expect(operationPermiseEssai({ type: "racine", cle: "fiche", valeur: {} })).toBe(true);
    expect(operationPermiseEssai({ type: "racine", cle: "identite", valeur: {} })).toBe(false);
    expect(operationPermiseEssai({ type: "ajout", collection: "evenements", id: "e", apres: null, valeur: { id: "e" } })).toBe(false);
    expect(operationPermiseEssai({ type: "signature", id: "x", valeur: { image: "", date: "", salarieId: "" } as never })).toBe(false);
  });

  it("présente chaque module réservé avec sa capture", () => {
    expect(moduleAbonne("/accidents")?.titre).toMatch(/Accidents/);
    expect(moduleAbonne("/duerp")).toBeUndefined();
    expect(moduleAbonne("/reglages")).toBeUndefined();
    for (const m of modulesAbonnes) expect(existsSync(`${process.cwd()}/public${m.capture}`), m.capture).toBe(true);
  });
});

describe("offres", () => {
  it("conseille la tranche d'après l'effectif", () => {
    expect(offreConseillee("1 à 10 salariés")).toBe("tpe");
    expect(offreConseillee("14 salariés")).toBe("pe");
    expect(offreConseillee("11 à 49 salariés")).toBe("pe");
    expect(offreConseillee("50 à 249 salariés")).toBe("pme");
    expect(offreConseillee("")).toBe("tpe");
  });

  it("relie chaque prix Stripe à son offre par sa clé de recherche", () => {
    expect(cleTarif("pe", "an")).toBe("frisk_du_pe_an");
    expect(lireCleTarif("frisk_du_pme_mois")).toEqual({ offre: "pme", periodicite: "mois" });
    expect(lireCleTarif("frisk_du_xyz_an")).toBeNull();
    expect(lireCleTarif(null)).toBeNull();
  });
});

describe("abonnement Stripe", () => {
  const sub = (status: string) => ({
    id: "sub_1",
    status,
    customer: "cus_1",
    metadata: { entreprise_id: "e1" },
    items: { data: [{ current_period_end: 1_798_761_600, price: { lookup_key: "frisk_du_tpe_an" } }] },
  });

  it("traduit le statut Stripe", () => {
    expect(statutDepuisStripe("active")).toBe("actif");
    expect(statutDepuisStripe("past_due")).toBe("impaye");
    expect(statutDepuisStripe("canceled")).toBe("termine");
    expect(statutDepuisStripe("incomplete")).toBeNull();
  });

  it("donne les colonnes de l'entreprise à mettre à jour", () => {
    expect(majDepuisStripe(sub("active"))).toEqual({
      abonnement: "actif",
      offre: "tpe",
      periodicite: "an",
      abonnement_fin: "2027-01-01T00:00:00.000Z",
      stripe_abonnement: "sub_1",
      stripe_client: "cus_1",
    });
    expect(majDepuisStripe(sub("incomplete"))).toBeNull();
    expect(majDepuisStripe({ ...sub("canceled"), customer: { id: "cus_2" } })?.stripe_client).toBe("cus_2");
  });
});

describe("suivi des erreurs", () => {
  it("ne garde que le message technique, borné, sans secret dans l'adresse", () => {
    const r = lireRapport({ message: "TypeError: x is undefined", detail: "a".repeat(10_000), page: `/signaler/${"b".repeat(64)}?x=1`, navigateur: "Chrome", entrepriseId: "pas-un-id" });
    expect(r).toEqual({ message: "TypeError: x is undefined", detail: "a".repeat(4000), page: "/signaler/…", navigateur: "Chrome" });
    expect(lireRapport({ message: "  " })).toBeNull();
    expect(lireRapport("texte")).toBeNull();
    expect(pageSansSecret("https://du.frisk.fr/duerp?onglet=2")).toBe("/duerp");
  });

  it("ignore les erreurs sans intérêt", () => {
    expect(erreurIgnoree("TypeError: Failed to fetch")).toBe(true);
    expect(erreurIgnoree("ResizeObserver loop completed with undelivered notifications.")).toBe(true);
    expect(erreurIgnoree("Error", "at chrome-extension://abc/script.js")).toBe(true);
    expect(erreurIgnoree("TypeError: Cannot read properties of undefined")).toBe(false);
  });
});
