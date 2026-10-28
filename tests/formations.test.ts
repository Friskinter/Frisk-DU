import { describe, expect, it } from "vitest";
import { calculerAlertes } from "@/lib/alertes";
import { nomDeStockage, verifierFichier } from "@/lib/attestations";
import { donneesDemo } from "@/lib/demo";
import { normaliser } from "@/lib/donnees";
import {
  ajouterMois,
  calculerExpiration,
  estRemplacee,
  etatFormation,
  formationsEnVigueur,
  formationsManquantes,
  libelleFormation,
  postesConnus,
  typesFormation,
} from "@/lib/formations";
import { libelleElement, valeurLisible } from "@/lib/journal";
import type { Donnees } from "@/lib/types";
import { donnees, exigence, formation, salarie } from "./aides";

const aujourdhui = "2026-10-28";

describe("formations et habilitations", () => {
  it("ajout de mois, y compris en fin de mois et d'année", () => {
    expect(ajouterMois("2026-10-28", 60)).toBe("2031-10-28");
    expect(ajouterMois("2026-01-31", 1)).toBe("2026-02-28");
    expect(ajouterMois("2028-01-31", 1)).toBe("2028-02-29");
    expect(ajouterMois("2026-11-15", 2)).toBe("2027-01-15");
    expect(ajouterMois("2026-10-28", -24)).toBe("2024-10-28");
  });

  it("expiration calculée selon la durée usuelle de chaque formation", () => {
    expect(calculerExpiration("caces-r489", "2026-03-01")).toBe("2031-03-01");
    expect(calculerExpiration("caces-r482", "2026-03-01")).toBe("2036-03-01");
    expect(calculerExpiration("sst", "2026-03-01")).toBe("2028-03-01");
    expect(calculerExpiration("habilitation-electrique", "2026-03-01")).toBe("2029-03-01");
    expect(calculerExpiration("accueil-securite", "2026-03-01")).toBe("");
    expect(calculerExpiration("sst", "")).toBe("");
    expect(formation({ type: "sst", obtenueLe: "2026-03-01" }).expireLe).toBe("2028-03-01");
    // Une date d'expiration saisie (celle de l'attestation) est conservée.
    expect(formation({ type: "sst", obtenueLe: "2026-03-01", expireLe: "2028-02-15" }).expireLe).toBe("2028-02-15");
  });

  it("référentiel : codes uniques, « autre » en dernier", () => {
    const codes = typesFormation.map((t) => t.code);
    expect(new Set(codes).size).toBe(codes.length);
    expect(codes.at(-1)).toBe("autre");
    expect(libelleFormation({ type: "autre", intitule: "Soudage" })).toBe("Soudage");
    expect(libelleFormation({ type: "inconnu", intitule: "" })).toBe("Autre formation");
  });

  it("état : valide, à renouveler dans les 90 jours, expirée, sans expiration", () => {
    expect(etatFormation({ expireLe: "2027-06-01" }, aujourdhui)).toBe("valide");
    expect(etatFormation({ expireLe: "2027-01-26" }, aujourdhui)).toBe("a-renouveler");
    expect(etatFormation({ expireLe: "2026-10-28" }, aujourdhui)).toBe("a-renouveler");
    expect(etatFormation({ expireLe: "2026-10-27" }, aujourdhui)).toBe("expiree");
    expect(etatFormation({ expireLe: "" }, aujourdhui)).toBe("permanente");
  });

  it("un recyclage remplace la session précédente", () => {
    const ancienne = formation({ salarieId: "s1", type: "sst", obtenueLe: "2022-01-01" });
    const recyclage = formation({ salarieId: "s1", type: "sst", obtenueLe: "2024-01-01" });
    const autreSalarie = formation({ salarieId: "s2", type: "sst", obtenueLe: "2021-01-01" });
    const soudage = formation({ salarieId: "s1", type: "autre", intitule: "Soudage", obtenueLe: "2020-01-01" });
    const echafaudage = formation({ salarieId: "s1", type: "autre", intitule: "Échafaudage", obtenueLe: "2020-01-01" });
    const liste = [recyclage, ancienne, autreSalarie, soudage, echafaudage];
    expect(formationsEnVigueur(liste)).toEqual([recyclage, autreSalarie, soudage, echafaudage]);
    expect(estRemplacee(ancienne, liste)).toBe(true);
    expect(estRemplacee(recyclage, liste)).toBe(false);
  });

  it("formations exigées par poste : manquantes ou expirées", () => {
    const cariste = salarie({ id: "c", poste: "Cariste" });
    const cariste2 = salarie({ id: "c2", poste: " cariste " });
    const comptable = salarie({ id: "x", poste: "Comptable" });
    const d = donnees({
      salaries: [cariste, cariste2, comptable],
      exigences: [exigence("Cariste", "caces-r489"), exigence("Cariste", "autorisation-conduite")],
      formations: [
        formation({ salarieId: "c", type: "caces-r489", obtenueLe: "2025-01-01" }),
        formation({ salarieId: "c", type: "autorisation-conduite", obtenueLe: "2025-01-01" }),
        formation({ salarieId: "c2", type: "caces-r489", obtenueLe: "2020-01-01" }), // expiré en 2025
      ],
    });
    expect(formationsManquantes(d, aujourdhui).map((m) => [m.salarie.id, m.type, m.expiree])).toEqual([
      ["c2", "caces-r489", true],
      ["c2", "autorisation-conduite", false],
    ]);
    expect(postesConnus(d)).toEqual(["Cariste", "Comptable"]);
  });

  it("anciens contenus : listes ajoutées", () => {
    const ancien = { ...donnees(), formations: undefined, exigences: undefined } as unknown as Donnees;
    expect(normaliser(ancien)).toMatchObject({ formations: [], exigences: [] });
  });

  it("attestations : nom de fichier et contrôles", () => {
    expect(nomDeStockage("Attestation SST – Hélène (2026).pdf")).toBe("Attestation-SST-Helene-2026-.pdf");
    expect(nomDeStockage("???")).toBe("attestation");
    expect(verifierFichier({ size: 1000, type: "application/pdf" })).toBeNull();
    expect(verifierFichier({ size: 1000, type: "application/zip" })).toContain("Format");
    expect(verifierFichier({ size: 6 * 1024 * 1024, type: "image/jpeg" })).toContain("5 Mo");
  });
});

describe("alertes liées aux formations", () => {
  const ids = (d: Donnees) => calculerAlertes(d, aujourdhui).map((a) => a.id);

  it("manquante pour le poste, expirée, à renouveler", () => {
    const d = donnees({
      salaries: [salarie({ id: "a", nom: "Martin", poste: "Cariste" }), salarie({ id: "b", nom: "Petit" })],
      exigences: [exigence("Cariste", "caces-r489")],
      formations: [
        formation({ salarieId: "a", type: "caces-r489", obtenueLe: "2020-01-01" }), // expirée et exigée
        formation({ salarieId: "b", type: "sst", obtenueLe: "2024-01-01" }), // expirée, non exigée
        formation({ salarieId: "b", type: "habilitation-electrique", obtenueLe: "2023-11-10" }), // expire le 10/11/2026
        formation({ salarieId: "b", type: "caces-r486", obtenueLe: "2021-12-20" }), // expire le 20/12/2026
        formation({ salarieId: "inconnu", type: "sst", obtenueLe: "2020-01-01" }), // salarié supprimé : ignorée
      ],
    });
    const alertes = calculerAlertes(d, aujourdhui);
    expect(ids(d)).toEqual(expect.arrayContaining(["formations-manquantes", "formations-expirees", "formations-30j", "formations-90j"]));
    const expirees = alertes.find((a) => a.id === "formations-expirees")!;
    expect(expirees.titre).toMatch(/^1 formation/);
    expect(expirees.detail).toContain("Petit : SST");
    expect(alertes.find((a) => a.id === "formations-manquantes")!.detail).toContain("Martin : R489 (expirée)");
  });

  it("aucune alerte sans formation ni exigence, ou pour une base non migrée", () => {
    expect(ids(donnees({ salaries: [salarie()] })).filter((i) => i.startsWith("formations"))).toEqual([]);
    const ancien = { ...donnees(), formations: undefined, exigences: undefined } as unknown as Donnees;
    expect(() => calculerAlertes(ancien, aujourdhui)).not.toThrow();
  });

  it("démonstration : une formation à renouveler et une autorisation manquante", () => {
    const d = donneesDemo(aujourdhui);
    expect(ids(d)).toEqual(expect.arrayContaining(["formations-manquantes", "formations-90j"]));
    expect(formationsManquantes(d, aujourdhui).map((m) => `${m.salarie.nom} ${m.type}`)).toEqual(
      expect.arrayContaining(["Leroy M. autorisation-conduite", "Michel R. habilitation-electrique"]),
    );
  });
});

describe("journal des formations", () => {
  it("libellés lisibles", () => {
    expect(valeurLisible("type", "caces-r489")).toBe("CACES® R489 – Chariots élévateurs");
    expect(valeurLisible("type", "accident-trajet")).toBe("Accident de trajet");
    expect(valeurLisible("expireLe", "2031-03-01")).toBe("01/03/2031");
    expect(valeurLisible("attestation", { chemin: "x/y/z.pdf", nom: "sst.pdf" })).toBe("sst.pdf");
  });

  it("nom de la formation et de l'exigence", () => {
    const d = donnees({ salaries: [salarie({ id: "s1", nom: "Simon T." })] });
    const entree = (collection: string, apres: Record<string, unknown>) => ({
      id: 1, created_at: "", auteur: "", collection, element_id: "z", action: "ajout" as const, avant: null, apres,
    });
    expect(libelleElement(entree("formations", { salarieId: "s1", type: "sst", intitule: "" }), d)).toBe("Sauveteur secouriste du travail (SST) — Simon T.");
    expect(libelleElement(entree("exigences", { poste: "Cariste", type: "caces-r489" }), d)).toBe("Cariste : CACES® R489 – Chariots élévateurs");
  });
});
