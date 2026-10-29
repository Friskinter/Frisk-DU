import { renderToBuffer } from "@react-pdf/renderer";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { nouvelleAction } from "@/lib/actions";
import { donneesDemo } from "@/lib/demo";
import { normaliser } from "@/lib/donnees";
import { nouvelEvenement } from "@/lib/evenements";
import { appliquerOperations, calculerOperations } from "@/lib/operations";
import { RapportAnnuel } from "@/lib/pdf/rapport-annuel";
import { anneesDisponibles, calculerRapport, evolution } from "@/lib/rapport";

const aujourdhui = "2026-10-28";

describe("rapport annuel", () => {
  it("années proposées : celles des données, jamais dans le futur", () => {
    const d = normaliser(donneesDemo(aujourdhui));
    const annees = anneesDisponibles(d, aujourdhui);
    expect(annees[0]).toBe(2026);
    expect(annees).not.toContain(2027);
    expect(annees).toEqual([...annees].sort((a, b) => b - a));
  });

  it("accidents de l'année : avec et sans arrêt, trajet, presque-accidents, taux et comparaison", () => {
    const base = normaliser(donneesDemo(aujourdhui));
    const d = {
      ...base,
      fiche: { ...base.fiche!, heures: "20000" },
      evenements: [
        nouvelEvenement({ type: "accident-travail", date: "2025-03-01", soins: "arret", joursArret: 5 }),
        nouvelEvenement({ type: "accident-travail", date: "2025-06-01", soins: "arret", joursArret: 3 }),
        nouvelEvenement({ type: "accident-travail", date: "2026-02-01", soins: "arret", joursArret: 10 }),
        nouvelEvenement({ type: "accident-travail", date: "2026-03-01", soins: "premiers-soins" }),
        nouvelEvenement({ type: "accident-trajet", date: "2026-04-01", soins: "arret", joursArret: 7 }),
        nouvelEvenement({ type: "presque-accident", date: "2026-05-01", signalement: { par: "Anonyme", recuLe: "2026-05-01T08:00:00Z" } }),
      ],
    };
    const { accidents } = calculerRapport(d, 2026, aujourdhui);
    expect(accidents).toMatchObject({ accidentsTravail: 2, avecArret: 1, sansArret: 1, trajet: 1, joursArret: 10, presqueAccidents: 1, signalesTerrain: 1 });
    // Taux de fréquence : accidents du travail avec arrêt par million d'heures (le trajet n'y entre pas).
    expect(accidents.tauxFrequence).toBe(50);
    expect(accidents.tauxGravite).toBe(0.5);
    expect(accidents.precedent).toMatchObject({ avecArret: 2, joursArret: 8 });
    expect(accidents.liste.map((x) => x.type)).toEqual(["Accident du travail", "Accident du travail", "Accident de trajet"]);
    expect(evolution(1, 2)).toBe("-1");
    expect(evolution(3, 1)).toBe("+2");
    expect(evolution(2, 2)).toBe("stable");
  });

  it("actions : réalisées dans l'année, programme de l'année suivante", () => {
    const base = normaliser(donneesDemo(aujourdhui));
    const d = {
      ...base,
      actions: [
        nouvelleAction("", { statut: "fait", realiseeLe: "2026-03-01", cout: 1000, principe: "collective" }),
        nouvelleAction("", { statut: "fait", realiseeLe: "2025-12-31", cout: 500 }),
        nouvelleAction("", { statut: "a-faire", echeance: "2027-06-01", cout: 200 }),
        nouvelleAction("", { statut: "en-cours", echeance: "2026-01-01" }),
        nouvelleAction("", { statut: "a-faire", echeance: "2028-01-01" }),
      ],
    };
    const { actions } = calculerRapport(d, 2026, aujourdhui);
    expect(actions).toMatchObject({ realisees: 1, budgetRealise: 1000, enCours: 3, enRetard: 1, budgetProgramme: 200 });
    expect(actions.parPrincipe).toEqual([{ libelle: "3. Protection collective", nombre: 1 }]);
    // Programme : actions non réalisées à mener d'ici la fin de l'année suivante, retards compris, par échéance.
    expect(actions.programme.map((a) => a.echeance)).toEqual(["2026-01-01", "2027-06-01"]);
  });

  it("année passée : situation au 31 décembre", () => {
    const d = normaliser(donneesDemo(aujourdhui));
    expect(calculerRapport(d, 2025, aujourdhui).reference).toBe("2025-12-31");
    expect(calculerRapport(d, 2026, aujourdhui).reference).toBe(aujourdhui);
  });

  it("démonstration : visites, causeries, accueils et entreprises extérieures comptés", () => {
    const r = calculerRapport(normaliser(donneesDemo(aujourdhui)), 2026, aujourdhui);
    expect(r.terrain).toMatchObject({ visites: 1, conformiteMoyenne: 83, causeries: 1, participations: 5, accueils: 1 });
    expect(r.exterieures.plans).toBeGreaterThanOrEqual(1);
    expect(r.duerp.parNiveau.reduce((t, n) => t + n.nombre, 0)).toBe(r.duerp.risques);
  });

  it("la synthèse de l'employeur s'enregistre dans les préférences", () => {
    const avant = normaliser(donneesDemo(aujourdhui));
    const apres = { ...avant, preferences: { ...avant.preferences, syntheses: { "2026": "Année de progrès." } } };
    const ops = calculerOperations(avant, apres);
    expect(ops).toEqual([{ type: "racine", cle: "preferences", valeur: apres.preferences }]);
    expect(appliquerOperations(avant, ops).preferences?.syntheses?.["2026"]).toBe("Année de progrès.");
  });

  it("PDF du rapport, y compris pour une entreprise vide", async () => {
    const logo = `${process.cwd()}/public/logo-frisk.png`;
    const d = normaliser(donneesDemo(aujourdhui));
    for (const donnees of [d, { ...d, evenements: [], actions: [], formations: [], visites: [], causeries: [] }]) {
      const rapport = calculerRapport(donnees, 2026, aujourdhui);
      const pdf = await renderToBuffer(createElement(RapportAnnuel, { donnees, rapport, synthese: "", aujourdhui, logo }) as Parameters<typeof renderToBuffer>[0]);
      expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
    }
  }, 30_000);
});
