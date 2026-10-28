import { describe, expect, it } from "vitest";
import { calculerAlertes } from "@/lib/alertes";
import { donneesDemo } from "@/lib/demo";
import { normaliser } from "@/lib/donnees";
import { libelleElement, valeurLisible } from "@/lib/journal";
import type { Donnees } from "@/lib/types";
import {
  derniereVerification,
  etatEquipement,
  familles,
  observationLevee,
  observationsOuvertes,
  prochaineDate,
  typesEquipement,
} from "@/lib/verifications";
import { action, donnees, equipement, observation, verification } from "./aides";

const aujourdhui = "2026-10-28";

describe("vérifications périodiques", () => {
  it("référentiel : codes uniques, familles connues, périodicités positives", () => {
    const codes = typesEquipement.map((t) => t.code);
    expect(new Set(codes).size).toBe(codes.length);
    expect(codes.at(-1)).toBe("autre");
    for (const t of typesEquipement) {
      expect(familles.some((f) => f.valeur === t.famille)).toBe(true);
      expect(t.periodicite).toBeGreaterThan(0);
    }
  });

  it("périodicité usuelle reprise à la création, prochaine échéance calculée", () => {
    const chariot = equipement({ type: "chariots" });
    expect(chariot.periodicite).toBe(6);
    expect(equipement({ type: "extincteurs" }).periodicite).toBe(12);
    expect(verification(chariot, { date: "2026-08-31" }).prochaine).toBe("2027-02-28");
    expect(prochaineDate("", 12)).toBe("");
    // Le vérificateur habituel est proposé.
    expect(verification({ ...chariot, prestataire: "Bureau Alpes" }).prestataire).toBe("Bureau Alpes");
  });

  it("état : jamais vérifié, en retard, à prévoir, à jour — d'après la dernière vérification", () => {
    const e = equipement({ id: "e", type: "extincteurs" });
    expect(etatEquipement([], e, aujourdhui)).toBe("jamais");
    const ancienne = verification(e, { date: "2024-10-01" });
    expect(etatEquipement([ancienne], e, aujourdhui)).toBe("en-retard");
    const recente = verification(e, { date: "2025-12-15" }); // prochaine le 15/12/2026
    expect(etatEquipement([ancienne, recente], e, aujourdhui)).toBe("a-prevoir");
    expect(derniereVerification([recente, ancienne], "e")).toBe(recente);
    expect(etatEquipement([verification(e, { date: "2026-06-01" })], e, aujourdhui)).toBe("a-jour");
    // Une vérification sans date n'est pas prise en compte.
    expect(etatEquipement([verification(e, { date: "" })], e, aujourdhui)).toBe("jamais");
  });

  it("observations : levées à la main ou par l'action réalisée, seules celles du dernier rapport comptent", () => {
    const e = equipement({ id: "e" });
    const a = action("r", { id: "a1", statut: "en-cours" });
    const parAction = { ...observation("Prise sans différentiel"), actionId: "a1" };
    const levee = { ...observation("Obturateurs manquants"), leveeLe: "2026-10-01" };
    const vide = observation("  ");
    const ancienne = verification(e, { date: "2025-10-01", observations: [observation("Ancienne remarque")] });
    const derniere = verification(e, { date: "2026-10-01", observations: [parAction, levee, vide] });
    expect(observationLevee(levee, [])).toBe(true);
    expect(observationLevee(parAction, [a])).toBe(false);
    expect(observationLevee(parAction, [{ ...a, statut: "fait" }])).toBe(true);
    expect(observationsOuvertes([e], [ancienne, derniere], [a]).map((o) => o.observation.texte)).toEqual(["Prise sans différentiel"]);
  });

  it("anciens contenus : listes ajoutées", () => {
    const ancien = { ...donnees(), equipements: undefined, verifications: undefined } as unknown as Donnees;
    expect(normaliser(ancien)).toMatchObject({ equipements: [], verifications: [] });
  });
});

describe("alertes des vérifications", () => {
  const ids = (d: Donnees) => calculerAlertes(d, aujourdhui).map((a) => a.id);

  it("non conforme, en retard, jamais vérifié, bientôt, observations anciennes", () => {
    const nc = equipement({ nom: "Palan" });
    const retard = equipement({ nom: "Chariot", type: "chariots" });
    const jamais = equipement({ nom: "Racks", type: "rayonnages" });
    const bientot = equipement({ nom: "Extincteurs" });
    const d = donnees({
      equipements: [nc, retard, jamais, bientot],
      verifications: [
        verification(nc, { date: "2026-10-20", resultat: "non-conforme" }),
        verification(retard, { date: "2026-03-01" }),
        verification(bientot, { date: "2025-11-10", observations: [observation("Recharger 2 appareils")] }),
      ],
    });
    const alertes = calculerAlertes(d, aujourdhui);
    expect(ids(d)).toEqual(
      expect.arrayContaining(["verifications-non-conformes", "verifications-retard", "verifications-jamais", "verifications-bientot", "observations-a-lever"]),
    );
    expect(alertes.find((a) => a.id === "verifications-retard")!.detail).toBe("Chariot (01/09/2026)");
    expect(alertes.find((a) => a.id === "observations-a-lever")!.detail).toContain("Extincteurs : Recharger 2 appareils");
  });

  it("une observation récente (moins d'un mois) n'alerte pas encore", () => {
    const e = equipement({ nom: "Portes" });
    const d = donnees({ equipements: [e], verifications: [verification(e, { date: "2026-10-20", observations: [observation("Cellule à régler")] })] });
    expect(ids(d)).not.toContain("observations-a-lever");
  });

  it("base non migrée et démonstration", () => {
    const ancien = { ...donnees(), equipements: undefined, verifications: undefined } as unknown as Donnees;
    expect(() => calculerAlertes(ancien, aujourdhui)).not.toThrow();
    const demo = donneesDemo(aujourdhui);
    expect(ids(demo)).toEqual(expect.arrayContaining(["verifications-retard", "verifications-jamais", "verifications-bientot", "observations-a-lever"]));
  });
});

describe("journal des vérifications", () => {
  it("libellés lisibles", () => {
    expect(valeurLisible("type", "chariots")).toBe("Chariots élévateurs");
    expect(valeurLisible("resultat", "non-conforme")).toBe("Non conforme");
    expect(valeurLisible("periodicite", 6)).toBe("6 mois");
    expect(valeurLisible("prochaine", "2027-04-01")).toBe("01/04/2027");
    expect(valeurLisible("observations", [{ texte: "Klaxon", leveeLe: "2026-10-15" }, { texte: "", leveeLe: "" }])).toBe("Klaxon (levée le 15/10/2026)");
  });

  it("nom de l'équipement et de la vérification", () => {
    const e = equipement({ id: "q1", nom: "Chariot 1" });
    const d = donnees({ equipements: [e] });
    const entree = (collection: string, apres: Record<string, unknown>) => ({
      id: 1, created_at: "", auteur: "", collection, element_id: "x", action: "ajout" as const, avant: null, apres,
    });
    expect(libelleElement(entree("equipements", { nom: "Palan" }), d)).toBe("Palan");
    expect(libelleElement(entree("verifications", { equipementId: "q1", date: "2026-10-01" }), d)).toBe("Vérification du 01/10/2026 : Chariot 1");
  });
});
