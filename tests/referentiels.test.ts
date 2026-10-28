import { describe, expect, it } from "vitest";
import { metiers } from "@/lib/bibliotheque";
import { donneesDemo } from "@/lib/demo";
import { facteursPenibilite, grilleFrequence, grilleGravite, niveauxCriticite } from "@/lib/referentiel";

describe("référentiels", () => {
  it("grilles de cotation complètes de 1 à 4", () => {
    expect(grilleGravite.map((g) => g.valeur)).toEqual([1, 2, 3, 4]);
    expect(grilleFrequence.map((f) => f.valeur)).toEqual([1, 2, 3, 4]);
  });

  it("niveaux de criticité ordonnés", () => {
    const bornes = niveauxCriticite.map((n) => n.min);
    expect(bornes).toEqual([...bornes].sort((a, b) => a - b));
  });

  it("les 10 facteurs de pénibilité, dont 6 ouvrent le C2P", () => {
    expect(facteursPenibilite).toHaveLength(10);
    expect(facteursPenibilite.filter((f) => f.c2p)).toHaveLength(6);
  });
});

describe("bibliothèque de risques", () => {
  const codes = new Set(facteursPenibilite.map((f) => f.code));

  it.each(metiers.map((m) => [m.nom, m] as const))("%s : situations valides", (_, m) => {
    expect(m.risques.length).toBeGreaterThan(0);
    for (const r of m.risques) {
      expect(r.gravite).toBeGreaterThanOrEqual(1);
      expect(r.gravite).toBeLessThanOrEqual(4);
      expect(r.frequence).toBeGreaterThanOrEqual(1);
      expect(r.frequence).toBeLessThanOrEqual(4);
      expect(r.prevention.trim()).not.toBe("");
      if (r.penibilite) expect(codes.has(r.penibilite)).toBe(true);
    }
  });

  it("identifiants de métier uniques", () => {
    expect(new Set(metiers.map((m) => m.id)).size).toBe(metiers.length);
  });
});

describe("données de démonstration", () => {
  const d = donneesDemo("2026-10-28");

  it("chaque mouvement vise un article et une taille existants", () => {
    for (const m of d.mouvements) {
      const a = d.articles.find((x) => x.id === m.articleId);
      expect(a).toBeDefined();
      expect(a!.tailles).toContain(m.taille);
    }
  });

  it("aucun stock négatif", () => {
    const solde = new Map<string, number>();
    for (const m of d.mouvements) {
      const k = `${m.articleId}|${m.taille}`;
      solde.set(k, (solde.get(k) ?? 0) + (m.type === "entree" ? m.quantite : -m.quantite));
    }
    for (const v of solde.values()) expect(v).toBeGreaterThanOrEqual(0);
  });
});
