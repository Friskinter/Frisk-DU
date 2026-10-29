import { renderToBuffer } from "@react-pdf/renderer";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import {
  accueilsEnRetard,
  emargement,
  etatAccueil,
  formationRenforcee,
  messagesDuTheme,
  nomArrivant,
  nouvelAccueil,
  nouvelleCauserie,
  pointsAccueil,
  risquesDuPoste,
  salariesSansCauserie,
  themesCauserie,
} from "@/lib/accueils";
import { calculerAlertes } from "@/lib/alertes";
import { risqueResiduel } from "@/lib/calculs";
import { donneesDemo } from "@/lib/demo";
import { normaliser } from "@/lib/donnees";
import { libelleElement } from "@/lib/journal";
import { FeuilleEmargement, FicheAccueil } from "@/lib/pdf/accueil";
import type { Donnees } from "@/lib/types";

const aujourdhui = "2026-10-28";
const signatures: Donnees["signatures"] = { s1: { image: "data:image/png;base64,AA", date: aujourdhui, salarieId: "x" } };

describe("accueil sécurité", () => {
  it("référentiels : codes et thèmes uniques, messages pour chaque thème", () => {
    expect(new Set(pointsAccueil.map((p) => p.code)).size).toBe(pointsAccueil.length);
    expect(new Set(themesCauserie.map((t) => t.theme)).size).toBe(themesCauserie.length);
    for (const t of themesCauserie) expect(messagesDuTheme(t.theme).split("\n").length).toBeGreaterThanOrEqual(3);
    expect(messagesDuTheme("Thème libre")).toBe("");
  });

  it("états : à venir, à faire, à faire signer, fait", () => {
    expect(etatAccueil(nouvelAccueil({ arriveeLe: "2026-11-02" }), signatures, aujourdhui)).toBe("a-venir");
    expect(etatAccueil(nouvelAccueil({ arriveeLe: "2026-10-27" }), signatures, aujourdhui)).toBe("a-faire");
    expect(etatAccueil(nouvelAccueil(), signatures, aujourdhui)).toBe("a-faire");
    expect(etatAccueil(nouvelAccueil({ accueilLe: aujourdhui }), signatures, aujourdhui)).toBe("a-signer");
    expect(etatAccueil(nouvelAccueil({ accueilLe: aujourdhui, signatureId: "s1" }), signatures, aujourdhui)).toBe("fait");
  });

  it("formation renforcée : CDD ou intérim sur un poste à risques seulement", () => {
    expect(formationRenforcee({ contrat: "interim", posteARisque: true })).toBe(true);
    expect(formationRenforcee({ contrat: "cdd", posteARisque: true })).toBe(true);
    expect(formationRenforcee({ contrat: "cdi", posteARisque: true })).toBe(false);
    expect(formationRenforcee({ contrat: "interim", posteARisque: false })).toBe(false);
  });

  it("risques du poste : ceux de l'unité, du plus élevé au plus faible", () => {
    const d = donneesDemo(aujourdhui);
    const risques = risquesDuPoste(d.duerp, "Zone de stockage");
    expect(risques.length).toBeGreaterThan(0);
    expect(risques.every((l) => l.unite === "Zone de stockage")).toBe(true);
    expect(risques.map(risqueResiduel)).toEqual([...risques.map(risqueResiduel)].sort((a, b) => b - a));
    expect(risquesDuPoste(d.duerp, "")).toEqual([]);
  });

  it("alertes : arrivant sans accueil (critique, formation renforcée signalée), accueil à faire signer", () => {
    const d = normaliser(donneesDemo(aujourdhui));
    const alerte = calculerAlertes(d, aujourdhui).find((a) => a.id === "accueils-a-faire");
    expect(alerte?.gravite).toBe("critique");
    expect(alerte?.titre).toBe("1 nouvel arrivant sans accueil sécurité");
    expect(alerte?.detail).toContain("Thomas B.");
    expect(alerte?.detail).toContain("Formation renforcée");
    expect(accueilsEnRetard(d.accueils, aujourdhui)).toHaveLength(1);
    const nonSigne = { ...d, accueils: [nouvelAccueil({ nom: "Lina", accueilLe: aujourdhui })] };
    expect(calculerAlertes(nonSigne, aujourdhui).map((a) => a.id)).toContain("accueils-a-signer");
  });
});

describe("causeries sécurité", () => {
  it("émargement et salariés sans causerie", () => {
    const d = donneesDemo(aujourdhui);
    const [c] = d.causeries;
    expect(emargement(c, d.signatures)).toEqual({ signes: 4, total: 5 });
    const absents = salariesSansCauserie(d, aujourdhui);
    expect(absents).toHaveLength(d.salaries.length - 5);
    expect(absents.some((s) => s.nom === "Martin L.")).toBe(false);
  });

  it("alerte : aucune causerie depuis 3 mois, seulement si l'entreprise en a déjà fait", () => {
    const d = normaliser(donneesDemo(aujourdhui));
    expect(calculerAlertes(d, aujourdhui).some((a) => a.id === "causeries-anciennes")).toBe(false);
    const ancienne = { ...d, causeries: [nouvelleCauserie({ date: "2026-06-01", theme: "Port des EPI" })] };
    expect(calculerAlertes(ancienne, aujourdhui).some((a) => a.id === "causeries-anciennes")).toBe(true);
    expect(calculerAlertes({ ...d, causeries: [] }, aujourdhui).some((a) => a.id === "causeries-anciennes")).toBe(false);
  });

  it("journal et noms lisibles", () => {
    const d = normaliser(donneesDemo(aujourdhui));
    const [interim] = d.accueils.filter((a) => !a.salarieId);
    expect(nomArrivant(interim, d)).toBe("Thomas B. (agence Intérim Plus)");
    expect(libelleElement({ id: 1, created_at: "", auteur: "", collection: "accueils", element_id: d.accueils[0].id, action: "ajout", avant: null, apres: null }, d)).toBe(
      "Accueil sécurité : Leroy M.",
    );
    expect(libelleElement({ id: 2, created_at: "", auteur: "", collection: "causeries", element_id: d.causeries[0].id, action: "ajout", avant: null, apres: null }, d)).toMatch(
      /^Causerie du .* : Circulation : piétons et chariots$/,
    );
  });

  it("PDF : fiche d'accueil et feuille d'émargement", async () => {
    const d = donneesDemo(aujourdhui);
    const logo = `${process.cwd()}/public/logo-frisk.png`;
    for (const accueil of d.accueils) {
      const pdf = await renderToBuffer(createElement(FicheAccueil, { donnees: d, accueil, aujourdhui, logo }) as Parameters<typeof renderToBuffer>[0]);
      expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
    }
    const pdf = await renderToBuffer(createElement(FeuilleEmargement, { donnees: d, causerie: d.causeries[0], aujourdhui, logo }) as Parameters<typeof renderToBuffer>[0]);
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
  }, 30_000);
});
