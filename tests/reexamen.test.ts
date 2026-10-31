import { describe, expect, it } from "vitest";
import { calculerAlertes } from "@/lib/alertes";
import { donneesVides } from "@/lib/demo";
import { nouvelleLigne } from "@/lib/donnees";
import { valeurLisible } from "@/lib/journal";
import { changementsEnAttente, marquerReexamine, signalerChangement, unitesSansRisque } from "@/lib/reexamen";
import type { Donnees } from "@/lib/types";

const AUJOURDHUI = "2026-11-02";

function donnees(): Donnees {
  return {
    ...donneesVides(),
    unites: ["Atelier", "Bureau", "Quai"],
    duerp: [
      nouvelleLigne("Atelier", { id: "r1", danger: "Machines" }),
      nouvelleLigne("Atelier", { id: "r2", danger: "Bruit" }),
      nouvelleLigne("Bureau", { id: "r3", danger: "Écran" }),
    ],
  };
}

describe("unité de travail modifiée → réexaminer ses risques", () => {
  it("marque à réexaminer tous les risques de l'unité, et seulement eux", () => {
    const d = signalerChangement(donnees(), "Atelier", "Nouvelle presse plieuse", "2026-10-20");
    expect(d.duerp.filter((l) => l.reexamen).map((l) => l.id)).toEqual(["r1", "r2"]);
    expect(changementsEnAttente(d)).toEqual([{ unite: "Atelier", depuis: "2026-10-20", motif: "Nouvelle presse plieuse", risques: 2 }]);
  });

  it("donne un motif par défaut", () => {
    const d = signalerChangement(donnees(), "Bureau", "  ", AUJOURDHUI);
    expect(d.duerp.find((l) => l.id === "r3")?.reexamen?.motif).toBe("Changement dans l'unité");
  });

  it("lève la demande risque par risque", () => {
    let d = signalerChangement(donnees(), "Atelier", "Réaménagement", "2026-10-20");
    d = marquerReexamine(d, "r1");
    expect(changementsEnAttente(d)).toEqual([{ unite: "Atelier", depuis: "2026-10-20", motif: "Réaménagement", risques: 1 }]);
    d = marquerReexamine(d, "r2");
    expect(changementsEnAttente(d)).toEqual([]);
  });

  it("crée une alerte qui mène au DUERP filtré sur l'unité", () => {
    const d = signalerChangement(donnees(), "Atelier", "Nouvelle presse plieuse", "2026-10-20");
    const alerte = calculerAlertes(d, AUJOURDHUI).find((a) => a.id === "risques-a-reexaminer");
    expect(alerte).toMatchObject({
      gravite: "importante",
      lien: "/duerp?unite=Atelier",
      titre: "2 risques à réexaminer après un changement dans une unité de travail",
    });
    expect(alerte?.detail).toContain("Atelier, nouvelle presse plieuse (20/10/2026)");
    expect(calculerAlertes(marquerReexamine(marquerReexamine(d, "r1"), "r2"), AUJOURDHUI).some((a) => a.id === "risques-a-reexaminer")).toBe(false);
  });

  it("signale les unités sans risque évalué, sauf quand le DUERP est encore vide", () => {
    expect(unitesSansRisque(donnees())).toEqual(["Quai"]);
    expect(unitesSansRisque({ unites: ["Quai"], duerp: [] })).toEqual([]);
    const alerte = calculerAlertes(donnees(), AUJOURDHUI).find((a) => a.id === "unites-sans-risque");
    expect(alerte).toMatchObject({ lien: "/duerp?unite=Quai", titre: "1 unité de travail sans risque évalué" });
  });

  it("se lit dans le journal des modifications", () => {
    expect(valeurLisible("reexamen", { motif: "Nouvelle presse", depuis: "2026-10-20" })).toBe("à réexaminer : Nouvelle presse (20/10/2026)");
    expect(valeurLisible("reexamen", null)).toBe("réexaminé");
  });
});
