import { describe, expect, it } from "vitest";
import { nouvelleAction } from "@/lib/actions";
import { donneesDemo, donneesVides } from "@/lib/demo";
import { etapesDemarrage, suggestionsDemarrage } from "@/lib/demarrage";
import { nouvelleLigne } from "@/lib/donnees";

const faites = (etapes: ReturnType<typeof etapesDemarrage>) => etapes.filter((e) => e.faite).map((e) => e.code);

describe("assistant de démarrage", () => {
  it("nouvelle entreprise : tout reste à faire, dans l'ordre", () => {
    const etapes = etapesDemarrage(donneesVides(), { versions: 0, lienActif: false });
    expect(etapes.map((e) => e.code)).toEqual(["fiche", "unites", "salaries", "risques", "actions", "version", "signalement"]);
    expect(faites(etapes)).toEqual([]);
  });

  it("les étapes dont l'état n'est pas encore connu ne sont pas affichées", () => {
    expect(etapesDemarrage(donneesVides()).map((e) => e.code)).not.toContain("version");
    expect(etapesDemarrage(donneesVides()).map((e) => e.code)).not.toContain("signalement");
  });

  it("chaque étape se coche d'elle-même", () => {
    const risque = nouvelleLigne("Atelier", { gravite: 4, frequence: 3 });
    const d = {
      ...donneesVides(),
      fiche: { siret: "", adresse: "1 rue du Port", activite: "", effectif: "8", responsable: "M. Dupont" },
      unites: ["Atelier"],
      salaries: [{ id: "s1", nom: "Paul", service: "", poste: "", tailles: {} }],
      duerp: [risque, nouvelleLigne("Atelier"), nouvelleLigne("Atelier")],
    };
    expect(faites(etapesDemarrage(d, { versions: 1, lienActif: true }))).toEqual(["fiche", "unites", "salaries", "risques", "version", "signalement"]);
    // L'action sur le risque prioritaire complète la mise en place.
    const avecAction = { ...d, actions: [nouvelleAction(risque.id)] };
    expect(etapesDemarrage(avecAction, { versions: 1, lienActif: true }).every((e) => e.faite)).toBe(true);
  });

  it("fiche incomplète : l'étape reste à faire", () => {
    const d = { ...donneesVides(), fiche: { siret: "", adresse: "1 rue du Port", activite: "", effectif: "", responsable: "M. Dupont" } };
    expect(faites(etapesDemarrage(d))).not.toContain("fiche");
  });

  it("démonstration : mise en place terminée, rien de plus à suggérer côté EPI et vérifications", () => {
    const d = donneesDemo("2026-10-28");
    expect(etapesDemarrage(d, { versions: 2, lienActif: true }).every((e) => e.faite)).toBe(true);
    expect(suggestionsDemarrage(d).map((s) => s.code)).not.toContain("equipements");
    expect(suggestionsDemarrage(donneesVides()).map((s) => s.code)).toEqual(["exigences", "equipements", "produits", "articles"]);
  });
});
