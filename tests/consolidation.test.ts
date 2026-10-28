import { describe, expect, it } from "vitest";
import { indicateursSite, risquesPrioritaires, totaliser } from "@/lib/consolidation";
import { donneesDemo } from "@/lib/demo";
import type { Donnees } from "@/lib/types";
import { action, donnees, evenement, ligne } from "./aides";

const aujourdhui = "2026-10-28";

describe("vue d'ensemble d'un groupe", () => {
  it("indicateurs d'un établissement", () => {
    const d = donnees({
      fiche: { siret: "", adresse: "", activite: "", effectif: "", responsable: "", heures: "10000" },
      duerp: [ligne({ id: "a", gravite: 4, frequence: 4 }), ligne({ gravite: 3, frequence: 3 }), ligne()],
      actions: [action("a", { statut: "fait" }), action("a", { echeance: "2026-01-01" })],
      evenements: [evenement({ date: "2026-09-01", soins: "arret", joursArret: 5 })],
    });
    expect(indicateursSite(d, aujourdhui, "2026-01-01")).toMatchObject({
      risques: 3, prioritaires: 2, critiques: 1, actions: 2, actionsFaites: 1, actionsRetard: 1,
      accidentsArret: 1, joursArret: 5, heures: 10000, derniereVersion: "2026-01-01",
    });
  });

  it("contenu ancien sans les listes récentes", () => {
    const ancien = { version: 1, entreprise: "Site B", services: [], unites: [], duerp: [], salaries: [], articles: [], mouvements: [] } as unknown as Donnees;
    expect(() => indicateursSite(ancien, aujourdhui, null)).not.toThrow();
    expect(indicateursSite(ancien, aujourdhui, null).risques).toBe(0);
  });

  it("totaux et taux du groupe calculés sur les sites dont les heures sont connues", () => {
    const base = indicateursSite(donnees(), aujourdhui, null);
    const t = totaliser([
      { ...base, accidentsArret: 2, joursArret: 10, heures: 20000, actionsRetard: 1 },
      { ...base, accidentsArret: 1, joursArret: 30, heures: null, actionsRetard: 2 },
      { ...base, accidentsArret: 0, joursArret: 0, heures: 30000 },
    ]);
    expect(t).toMatchObject({ accidentsArret: 3, joursArret: 40, actionsRetard: 3, heures: 50000, sitesSansHeures: 1 });
    expect(t.tauxFrequence).toBe(40); // 2 × 1 000 000 / 50 000
    expect(t.tauxGravite).toBe(0.2); // 10 × 1 000 / 50 000
    expect(totaliser([]).tauxFrequence).toBeNull();
  });

  it("risques prioritaires de tous les sites, du plus élevé au moins élevé", () => {
    const a = { id: "a", nom: "Lyon", contenu: donnees({ duerp: [ligne({ danger: "Chute", gravite: 4, frequence: 4 }), ligne({ danger: "Écran" })] }) };
    const b = { id: "b", nom: "Paris", contenu: donnees({ duerp: [ligne({ danger: "Bruit", gravite: 3, frequence: 4 })] }) };
    expect(risquesPrioritaires([a, b]).map((r) => `${r.site.nom} ${r.ligne.danger}`)).toEqual(["Lyon Chute", "Paris Bruit"]);
  });

  it("démonstration : chaque module remonte dans les indicateurs", () => {
    const i = indicateursSite(donneesDemo(aujourdhui), aujourdhui, null);
    expect(i.risques).toBeGreaterThan(0);
    expect(i.verificationsRetard).toBeGreaterThan(0);
    expect(i.cmr).toBe(1);
    expect(i.formationsManquantes).toBeGreaterThan(0);
    expect(i.alertes).toBeGreaterThan(0);
  });
});
