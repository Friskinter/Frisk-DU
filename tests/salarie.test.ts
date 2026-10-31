import { describe, expect, it } from "vitest";
import { nouvelAccueil, nouvelleCauserie } from "@/lib/accueils";
import { ficheSalarie } from "@/lib/salarie";
import { article, donnees, evenement, exigence, formation, ligne, mouvement, produit, salarie } from "./aides";

const AUJOURDHUI = "2026-11-02";

describe("fiche salarié", () => {
  const paul = salarie({ nom: "Paul Martin", poste: "Cariste" });
  const autre = salarie({ nom: "Léa" });
  const gants = article({ nom: "Gants anti-coupure" });
  const quai = ligne({ unite: "Quai", danger: "Manutention", gravite: 3, frequence: 4, penibilite: "manutention", seuilPenibilite: "oui" });
  const bureau = ligne({ unite: "Bureaux", danger: "Écran" });
  const d = donnees({
    salaries: [paul, autre],
    articles: [gants],
    exigences: [exigence("cariste", "caces-r489"), exigence("Cariste", "sst")],
    formations: [
      formation({ salarieId: paul.id, type: "caces-r489", obtenueLe: "2020-01-10", expireLe: "2025-01-10" }),
      formation({ salarieId: paul.id, type: "caces-r489", obtenueLe: "2025-01-05", expireLe: "2026-12-15" }),
      formation({ salarieId: autre.id, type: "sst", obtenueLe: "2026-01-05", expireLe: "2028-01-05" }),
    ],
    mouvements: [
      mouvement({ type: "sortie", articleId: gants.id, salarieId: paul.id, date: "2026-09-01" }),
      mouvement({ type: "sortie", articleId: gants.id, salarieId: paul.id, date: "2026-10-01", signatureId: "s1" }),
      mouvement({ type: "sortie", articleId: gants.id, salarieId: autre.id, date: "2026-10-01" }),
    ],
    signatures: { s1: { image: "", date: "2026-10-01", salarieId: paul.id } },
    accueils: [nouvelAccueil({ salarieId: paul.id, unite: "Quai", arriveeLe: "2026-10-20", accueilLe: "" })],
    causeries: [nouvelleCauserie({ date: "2025-06-01", participants: [{ id: "p", salarieId: paul.id, nom: "" }] })],
    evenements: [evenement({ salarieId: paul.id, date: "2026-03-04" }), evenement({ salarieId: autre.id })],
    produits: [produit({ nom: "Dégraissant", salariesExposes: [paul.id] }), produit({ nom: "Ancien", salariesExposes: [paul.id], actif: false })],
    duerp: [bureau, quai],
  });

  it("réunit ce qui concerne le salarié, et seulement lui", () => {
    const f = ficheSalarie(d, paul.id, AUJOURDHUI)!;
    // Le recyclage remplace la session précédente.
    expect(f.formations.map((x) => [x.formation.obtenueLe, x.etat])).toEqual([["2025-01-05", "a-renouveler"]]);
    expect(f.manquantes).toEqual([{ type: "sst", expiree: false }]);
    expect(f.remises.map((r) => [r.mouvement.date, r.signee])).toEqual([["2026-10-01", true], ["2026-09-01", false]]);
    expect(f.remises[0].article).toBe("Gants anti-coupure");
    expect(f.accueil?.etat).toBe("a-faire");
    expect(f.causeries).toHaveLength(1);
    expect(f.evenements).toHaveLength(1);
    expect(f.produits.map((p) => p.nom)).toEqual(["Dégraissant"]);
  });

  it("retrouve les risques de son unité de travail par son accueil", () => {
    const f = ficheSalarie(d, paul.id, AUJOURDHUI)!;
    expect(f.unite).toBe("Quai");
    expect(f.risques.map((l) => l.danger)).toEqual(["Manutention"]);
    expect(f.penibilite.map((l) => l.danger)).toEqual(["Manutention"]);
  });

  it("liste les points d'attention", () => {
    expect(ficheSalarie(d, paul.id, AUJOURDHUI)!.pointsAttention).toEqual([
      "Sauveteur secouriste du travail (SST) : manquante (exigée pour son poste)",
      "CACES® R489 – Chariots élévateurs : à renouveler",
      "1 remise d'EPI à faire signer",
      "Accueil sécurité à faire",
      "Aucune causerie depuis un an",
    ]);
  });

  it("salarié inconnu : pas de fiche", () => {
    expect(ficheSalarie(d, "inconnu", AUJOURDHUI)).toBeNull();
  });
});
