import { describe, expect, it } from "vitest";
import { detailsChangement, libelleElement, type EntreeJournal } from "@/lib/journal";
import { donnees, ligne } from "./aides";

const entree = (champs: Partial<EntreeJournal>): EntreeJournal => ({
  id: 1, created_at: "2026-10-28T10:00:00Z", auteur: "a@b.fr", collection: "duerp", element_id: "l1",
  action: "modification", avant: null, apres: null, ...champs,
});

describe("journal lisible", () => {
  it("traduit les cotations et les dates", () => {
    const d = detailsChangement(entree({ avant: { gravite: 3, echeance: "2026-11-01" }, apres: { gravite: 4, echeance: "2026-12-15" } }));
    expect(d).toEqual([
      { champ: "Gravité", avant: "3 – Grave", apres: "4 – Très grave" },
      { champ: "Échéance", avant: "01/11/2026", apres: "15/12/2026" },
    ]);
  });

  it("nomme la ligne du DUERP, même supprimée", () => {
    const d = donnees({ duerp: [ligne({ id: "l1", danger: "Chute de hauteur", unite: "Quai" })] });
    expect(libelleElement(entree({}), d)).toBe("Chute de hauteur — Quai");
    expect(libelleElement(entree({ action: "suppression", element_id: "x", avant: { danger: "Bruit", unite: "Atelier" } }), d)).toBe(
      "Bruit — Atelier",
    );
  });

  it("décrit un réglage d'entreprise", () => {
    const e = entree({ collection: "entreprise", element_id: "unites", avant: ["Atelier"], apres: ["Atelier", "Quai"] });
    expect(detailsChangement(e)).toEqual([{ champ: "Unités de travail", avant: "Atelier", apres: "Atelier, Quai" }]);
  });
});
