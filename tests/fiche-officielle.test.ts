import { describe, expect, it } from "vitest";
import { activiteDe, effectifDe, ficheDepuisResultat, lireRecherche, responsableDe } from "@/lib/fiche-officielle";

describe("fiche officielle de l'entreprise", () => {
  it("reconnaît un SIRET, un SIREN ou un nom", () => {
    expect(lireRecherche(" 356 000 000 00048 ")).toBe("35600000000048");
    expect(lireRecherche("356.000.000")).toBe("356000000");
    expect(lireRecherche("Logistique Démo")).toBe("Logistique Démo");
    // Numéro incomplet, ou nom trop court : pas de recherche.
    expect(lireRecherche("35600")).toBeNull();
    expect(lireRecherche("ab")).toBeNull();
  });

  it("traduit le code d'activité et la tranche d'effectif", () => {
    expect(activiteDe("52.10B")).toBe("Entreposage et services auxiliaires des transports (52.10B)");
    expect(activiteDe("00.00Z")).toBe("00.00Z");
    expect(effectifDe("11", "2023")).toBe("10 à 19 salariés (INSEE, 2023)");
    expect(effectifDe("NN", null)).toBe("");
  });

  it("prend le premier dirigeant en personne, avec son premier prénom", () => {
    expect(
      responsableDe([
        { type_dirigeant: "personne morale", denomination: "HOLDING X" },
        { type_dirigeant: "personne physique", nom: "DUPONT", prenoms: "MARIE-CLAIRE ANNE", qualite: "Présidente" },
      ]),
    ).toBe("Marie-Claire Dupont, Présidente");
    expect(responsableDe([{ type_dirigeant: "personne physique", nom: "MARTIN", prenoms: "PAUL", qualite: "Autre" }])).toBe("Paul Martin");
    expect(responsableDe([])).toBe("");
  });

  it("remplit la fiche à partir de la réponse du répertoire", () => {
    expect(
      ficheDepuisResultat({
        siren: "356000000",
        nom_complet: "LA POSTE (LA POSTE)",
        nom_raison_sociale: "LA POSTE",
        activite_principale: "53.10Z",
        tranche_effectif_salarie: "53",
        annee_tranche_effectif_salarie: "2024",
        siege: { siret: "35600000000048", adresse: "9 RUE DU COLONEL PIERRE AVIA 75015 PARIS", libelle_commune: "PARIS" },
        dirigeants: [],
      }),
    ).toEqual({
      raisonSociale: "LA POSTE",
      siren: "356000000",
      siret: "356 000 000 00048",
      adresse: "9 RUE DU COLONEL PIERRE AVIA 75015 PARIS",
      activite: "Activités de poste et de courrier (53.10Z)",
      effectif: "10 000 salariés et plus (INSEE, 2024)",
      responsable: "",
      ville: "PARIS",
    });
  });
});
