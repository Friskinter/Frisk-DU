import { describe, expect, it } from "vitest";
import { auteurPropose, erreurAvis, type Avis } from "@/lib/avis";

const avis = (champs: Partial<Avis> = {}): Avis => ({
  note: 5,
  texte: "Très simple à prendre en main, notre DUERP est à jour.",
  auteur: "Marie D.",
  fonction: "Gérante",
  entrepriseAffichee: "",
  ...champs,
});

describe("avis clients", () => {
  it("accepte un avis complet", () => {
    expect(erreurAvis(avis())).toBeNull();
  });

  it("refuse une note hors de 1 à 5 étoiles", () => {
    expect(erreurAvis(avis({ note: 0 }))).toMatch(/note/);
    expect(erreurAvis(avis({ note: 6 }))).toMatch(/note/);
    expect(erreurAvis(avis({ note: 4.5 }))).toMatch(/note/);
  });

  it("exige un texte de 20 à 1 000 caractères, espaces de bord non comptés", () => {
    expect(erreurAvis(avis({ texte: "   Trop court    " }))).toMatch(/au moins 20/);
    expect(erreurAvis(avis({ texte: "x".repeat(1001) }))).toMatch(/1000/);
  });

  it("exige le nom à afficher", () => {
    expect(erreurAvis(avis({ auteur: " " }))).toMatch(/nom à afficher/);
  });

  it("propose prénom et initiale à partir d'une adresse prenom.nom", () => {
    expect(auteurPropose("marie.dupont@exemple.fr")).toBe("Marie D.");
    expect(auteurPropose("JEAN-martin@exemple.fr")).toBe("Jean M.");
    expect(auteurPropose("contact@exemple.fr")).toBe("");
    expect(auteurPropose("m.dupont@exemple.fr")).toBe("");
  });
});
