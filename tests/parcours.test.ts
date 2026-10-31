import { describe, expect, it } from "vitest";
import { donneesDemo, donneesVides } from "@/lib/demo";
import { calculerParcours, questionsSansReponse } from "@/lib/parcours";
import type { Donnees, ProfilEntreprise } from "@/lib/types";

const AUJOURDHUI = "2026-10-31";
const avecProfil = (profil: ProfilEntreprise, d: Donnees = donneesVides()): Donnees => ({
  ...d,
  fiche: { siret: "", adresse: "", activite: "", effectif: "", responsable: "", ...d.fiche, profil },
});
const codes = (d: Donnees, contexte = {}) => calculerParcours(d, { aujourdhui: AUJOURDHUI, ...contexte }).etapes.map((e) => e.code);
const pistes = (d: Donnees) => calculerParcours(d, { aujourdhui: AUJOURDHUI }).pistes.map((p) => p.code);

describe("mon parcours QHSE", () => {
  it("nouvelle entreprise sans profil : le profil d'abord, tous les sujets proposés, aucune piste", () => {
    const d = donneesVides();
    const parcours = calculerParcours(d, { aujourdhui: AUJOURDHUI });
    expect(parcours.etapes[0]).toMatchObject({ code: "profil", etat: "a-faire" });
    expect(parcours.prochaine?.code).toBe("profil");
    expect(codes(d)).toEqual(expect.arrayContaining(["accueils", "formations", "equipements", "chimiques", "exterieures", "epi"]));
    expect(pistes(d)).toEqual([]);
    expect(parcours.pourcentage).toBe(0);
  });

  it("le profil se complète question par question", () => {
    expect(questionsSansReponse(undefined)).toBe(5);
    expect(questionsSansReponse({ secteur: "btp", tranche: "1-10" })).toBe(3);
    const d = avecProfil({ secteur: "btp", tranche: "1-10" });
    expect(calculerParcours(d, { aujourdhui: AUJOURDHUI }).etapes[0].etat).toBe("en-cours");
    const complet = avecProfil({ secteur: "btp", tranche: "1-10", exterieurs: "nsp", chimiques: "oui", equipements: "oui" });
    expect(calculerParcours(complet, { aujourdhui: AUJOURDHUI }).etapes[0].etat).toBe("fait");
  });

  it("une réponse « non » ne retire jamais un sujet : il devient une piste à vérifier", () => {
    const d = avecProfil({ secteur: "services", tranche: "1-10", exterieurs: "non", chimiques: "non", equipements: "non" });
    expect(codes(d)).not.toContain("chimiques");
    expect(pistes(d)).toEqual(["equipements", "chimiques", "exterieures", "epi"]);
    // L'accueil sécurité et les formations restent proposés à tous.
    expect(codes(d)).toEqual(expect.arrayContaining(["accueils", "formations"]));
    // « Je ne sais pas » garde le sujet dans le parcours.
    expect(codes(avecProfil({ chimiques: "nsp" }))).toContain("chimiques");
  });

  it("un sujet déjà traité reste dans le parcours, même avec une réponse « non »", () => {
    const d = avecProfil({ chimiques: "non" }, { ...donneesVides(), produits: donneesDemo(AUJOURDHUI).produits });
    expect(codes(d)).toContain("chimiques");
    expect(pistes(d)).not.toContain("chimiques");
  });

  it("le secteur oriente le DUERP express et les EPI", () => {
    const btp = calculerParcours(avecProfil({ secteur: "btp" }), { aujourdhui: AUJOURDHUI });
    expect(btp.etapes.find((e) => e.code === "risques")!.aide).toContain("« BTP »");
    expect(btp.etapes.map((e) => e.code)).toContain("epi");
    expect(pistes(avecProfil({ secteur: "services" }))).toContain("epi");
  });

  it("dans la durée : mise à jour annuelle et plan d'actions, une fois les bases posées", () => {
    const demo = avecProfil({ secteur: "transport-logistique", tranche: "11-49", exterieurs: "oui", chimiques: "oui", equipements: "oui" }, donneesDemo(AUJOURDHUI));
    const contexte = { versions: 2, lienActif: true };
    // Démonstration : bases posées, mais des actions en retard.
    const parcours = calculerParcours(demo, { aujourdhui: AUJOURDHUI, ...contexte, derniereVersion: "2026-03-01" });
    expect(parcours.etapes.find((e) => e.code === "mise-a-jour")).toMatchObject({ etat: "fait" });
    expect(parcours.etapes.find((e) => e.code === "mise-a-jour")!.aide).toMatch(/Obligatoire au moins une fois par an/);
    expect(parcours.etapes.find((e) => e.code === "revue-actions")).toMatchObject({ etat: "en-cours" });
    // Version de plus d'un an : la mise à jour est à faire.
    expect(calculerParcours(demo, { aujourdhui: AUJOURDHUI, ...contexte, derniereVersion: "2025-06-01" }).etapes.find((e) => e.code === "mise-a-jour")!.etat).toBe("a-faire");
    // Bases pas encore posées : rien « dans la durée ».
    expect(codes(donneesVides(), { derniereVersion: null })).not.toContain("mise-a-jour");
  });

  it("l'avancement compte les étapes faites, sans les pistes", () => {
    const d = avecProfil({ secteur: "services", tranche: "1-10", exterieurs: "non", chimiques: "non", equipements: "non" }, {
      ...donneesVides(),
      fiche: { siret: "", adresse: "1 rue du Port", activite: "", effectif: "3", responsable: "Mme Martin" },
    });
    const parcours = calculerParcours(d, { aujourdhui: AUJOURDHUI });
    expect(parcours.faites).toBe(2); // profil et fiche
    expect(parcours.total).toBe(parcours.etapes.length);
    expect(parcours.pourcentage).toBe(Math.round((2 / parcours.total) * 100));
  });
});
