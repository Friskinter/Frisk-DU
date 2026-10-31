import { describe, expect, it } from "vitest";
import { normaliser, rechercher } from "@/lib/recherche";
import { action, article, donnees, equipement, evenement, formation, ligne, produit, salarie } from "./aides";

describe("recherche dans toute l'application", () => {
  const paul = salarie({ nom: "Paul Martin", service: "Atelier", poste: "Soudeur" });
  const risque = ligne({ unite: "Atelier", danger: "Échafaudage", risque: "Chute de hauteur" });
  const d = donnees({
    salaries: [paul, salarie({ nom: "Martine Durand" })],
    duerp: [risque],
    actions: [action(risque.id, { intitule: "Acheter un échafaudage roulant" })],
    evenements: [evenement({ salarieId: paul.id, type: "accident-travail", date: "2026-03-04" })],
    formations: [formation({ salarieId: paul.id, type: "sst" })],
    equipements: [equipement({ nom: "Extincteur hall", reference: "EXT-42" })],
    produits: [produit({ nom: "Dégraissant DX 40" })],
    articles: [article({ nom: "Gants anti-coupure" })],
  });

  it("ignore accents, majuscules et ponctuation", () => {
    expect(normaliser("  Échafaudage, l'atelier ")).toBe("echafaudage l atelier");
  });

  it("trouve un élément de chaque module et ouvre directement sa fiche", () => {
    const lien = (recherche: string) => rechercher(d, recherche)[0]?.lien;
    expect(lien("paul")).toBe(`/salaries?salarie=${paul.id}`);
    expect(lien("dx 40")).toMatch(/^\/produits\?produit=/);
    expect(lien("ext-42")).toMatch(/^\/verifications\?equipement=/);
    expect(lien("gants")).toMatch(/^\/epi\?article=/);
    expect(lien("penibilite")).toBe("/penibilite");
  });

  it("tous les mots doivent correspondre", () => {
    const titres = rechercher(d, "echafaudage roulant").map((r) => r.titre);
    expect(titres).toEqual(["Acheter un échafaudage roulant"]);
  });

  it("le titre qui commence par la recherche passe en premier", () => {
    const resultats = rechercher(d, "martin");
    expect(resultats[0].titre).toBe("Martine Durand");
    // Paul Martin vient ensuite (un mot du titre commence par « martin »), puis sa formation et son accident.
    expect(resultats.map((r) => r.categorie)).toEqual(["Salariés", "Salariés", "Accidents", "Formations"]);
  });

  it("rien à chercher : aucun résultat", () => {
    expect(rechercher(d, "  ")).toEqual([]);
    expect(rechercher(d, "introuvable")).toEqual([]);
  });
});
