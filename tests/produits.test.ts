import { describe, expect, it } from "vitest";
import { calculerAlertes } from "@/lib/alertes";
import { donneesDemo } from "@/lib/demo";
import { normaliser } from "@/lib/donnees";
import { libelleElement, valeurLisible } from "@/lib/journal";
import {
  classementCmr,
  estCmr,
  etatFds,
  libelleMention,
  lireMentions,
  normaliserMention,
  pictogrammesDe,
} from "@/lib/produits";
import type { Donnees } from "@/lib/types";
import { donnees, ligne, produit, salarie } from "./aides";

const aujourdhui = "2026-10-28";

describe("produits chimiques", () => {
  it("lecture des mentions de danger copiées depuis la FDS", () => {
    expect(normaliserMention("h 350 i")).toBe("H350i");
    expect(normaliserMention("H360Fd")).toBe("H360Fd");
    expect(normaliserMention("P280")).toBeNull();
    expect(lireMentions("H225, H319; h336\nH225 H411 P210 EUH066 H350i : Peut provoquer le cancer")).toEqual(["H225", "H319", "H336", "H411", "H350i"]);
    expect(lireMentions("")).toEqual([]);
    expect(libelleMention("H350i")).toBe("H350i : Peut provoquer le cancer");
    expect(libelleMention("H999")).toBe("H999");
  });

  it("pictogrammes déduits des mentions", () => {
    expect(pictogrammesDe(["H225", "H304", "H336", "H411"]).map((p) => p.code)).toEqual(["SGH02", "SGH07", "SGH08", "SGH09"]);
    expect(pictogrammesDe(["H314"]).map((p) => p.libelle)).toEqual(["Corrosif"]);
    expect(pictogrammesDe(["H412"])).toEqual([]);
  });

  it("classement CMR : catégorie 1 (avéré ou présumé) ou 2 (suspecté)", () => {
    expect(classementCmr({ mentionsH: ["H350", "H340", "H373"] })).toEqual({ categorie: 1, effets: ["cancérogène", "mutagène"] });
    expect(classementCmr({ mentionsH: ["H360FD"] })).toEqual({ categorie: 1, effets: ["toxique pour la reproduction"] });
    expect(classementCmr({ mentionsH: ["H351", "H226"] })).toEqual({ categorie: 2, effets: ["cancérogène"] });
    // Avéré l'emporte sur suspecté.
    expect(classementCmr({ mentionsH: ["H351", "H350i"] })?.categorie).toBe(1);
    expect(classementCmr({ mentionsH: ["H315", "H362"] })).toBeNull();
    expect(estCmr({ mentionsH: ["H351"] })).toBe(false);
  });

  it("état de la FDS : manquante, de plus de 3 ans, à jour", () => {
    expect(etatFds({ fdsDate: "" }, aujourdhui)).toBe("manquante");
    expect(etatFds({ fdsDate: "", fds: { chemin: "a/b/c.pdf", nom: "c.pdf" } }, aujourdhui)).toBe("a-jour");
    expect(etatFds({ fdsDate: "2023-10-01" }, aujourdhui)).toBe("ancienne");
    expect(etatFds({ fdsDate: "2024-01-15" }, aujourdhui)).toBe("a-jour");
  });

  it("anciens contenus : liste ajoutée", () => {
    const ancien = { ...donnees(), produits: undefined } as unknown as Donnees;
    expect(normaliser(ancien).produits).toEqual([]);
  });
});

describe("alertes des produits chimiques", () => {
  const ids = (d: Donnees) => calculerAlertes(d, aujourdhui).map((a) => a.id);

  it("CMR à documenter, FDS manquante ou ancienne, produit hors DUERP", () => {
    const l = ligne({ id: "r" });
    const s = salarie({ id: "s" });
    const d = donnees({
      duerp: [l],
      salaries: [s],
      produits: [
        produit({ nom: "Huile usagée", mentionsH: ["H350"], fdsDate: "2026-01-01", risqueId: "r" }),
        produit({ nom: "Diluant", mentionsH: ["H225"], fdsDate: "2020-01-01", risqueId: "r" }),
        produit({ nom: "Nettoyant", mentionsH: ["H315"] }),
        produit({ nom: "Ancien solvant", mentionsH: ["H350"], actif: false }),
      ],
    });
    const alertes = calculerAlertes(d, aujourdhui);
    expect(ids(d)).toEqual(expect.arrayContaining(["chimie-cmr", "chimie-fds-manquante", "chimie-fds-ancienne", "chimie-duerp"]));
    expect(alertes.find((a) => a.id === "chimie-cmr")!.detail).toContain("Huile usagée");
    // Un produit retiré n'alerte plus.
    expect(JSON.stringify(alertes)).not.toContain("Ancien solvant");
    expect(alertes.find((a) => a.id === "chimie-duerp")!.detail).toContain("Nettoyant");
  });

  it("un CMR documenté (substitution et salariés exposés) n'alerte plus", () => {
    const d = donnees({
      duerp: [ligne({ id: "r" })],
      produits: [produit({ mentionsH: ["H350"], fdsDate: "2026-01-01", risqueId: "r", substitution: "Aucun produit de remplacement à ce jour", salariesExposes: ["s"] })],
    });
    expect(ids(d).filter((i) => i.startsWith("chimie"))).toEqual([]);
  });

  it("base non migrée et démonstration", () => {
    const ancien = { ...donnees(), produits: undefined } as unknown as Donnees;
    expect(() => calculerAlertes(ancien, aujourdhui)).not.toThrow();
    expect(ids(donneesDemo(aujourdhui))).toEqual(expect.arrayContaining(["chimie-cmr", "chimie-fds-manquante", "chimie-fds-ancienne", "chimie-duerp"]));
  });
});

describe("journal des produits", () => {
  it("libellés lisibles", () => {
    expect(valeurLisible("mentionsH", ["H225", "H350"])).toBe("H225, H350");
    expect(valeurLisible("actif", false)).toBe("non (produit retiré)");
    expect(valeurLisible("salariesExposes", ["a", "b"])).toBe("2 salarié(s)");
    expect(valeurLisible("fdsDate", "2025-03-01")).toBe("01/03/2025");
    expect(valeurLisible("fds", { chemin: "x", nom: "fds.pdf" })).toBe("fds.pdf");
  });

  it("nom du produit", () => {
    const d = donnees({ produits: [produit({ id: "p", nom: "Dégraissant" })] });
    const entree = { id: 1, created_at: "", auteur: "", collection: "produits", element_id: "p", action: "ajout" as const, avant: null, apres: {} };
    expect(libelleElement(entree, d)).toBe("Dégraissant");
  });
});
