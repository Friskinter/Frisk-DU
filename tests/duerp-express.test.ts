import { describe, expect, it } from "vitest";
import { metiers } from "@/lib/bibliotheque";
import { niveauDe, risqueResiduel } from "@/lib/calculs";
import { donneesVides } from "@/lib/demo";
import { actionsProposees, appliquerExpress, cleRisque, ligneDepuis, maitriseDepuis, mesuresDe, principeDe, unitesDe, type ChoixRisque } from "@/lib/duerp-express";
import { famillesDangers, facteursPenibilite } from "@/lib/referentiel";

const boulangerie = metiers.find((m) => m.id === "boulangerie")!;
const choix = (m = boulangerie): ChoixRisque[] => m.risques.map((modele, i) => ({ cle: cleRisque(modele, i), modele, inclus: true, enPlace: [] }));

describe("bibliothèque par métier", () => {
  it("couvre une vingtaine de métiers, avec des dangers et facteurs de pénibilité connus", () => {
    expect(metiers.length).toBeGreaterThanOrEqual(20);
    expect(new Set(metiers.map((m) => m.id)).size).toBe(metiers.length);
    for (const m of metiers) {
      expect(m.risques.length, m.nom).toBeGreaterThanOrEqual(5);
      for (const r of m.risques) {
        expect(famillesDangers, `${m.nom} : ${r.danger}`).toContain(r.danger);
        if (r.penibilite) expect(facteursPenibilite.map((f) => f.code), r.penibilite).toContain(r.penibilite);
        expect(r.gravite).toBeGreaterThanOrEqual(1);
        expect(r.frequence).toBeLessThanOrEqual(4);
        expect(mesuresDe(r).length, `${m.nom} : ${r.activite}`).toBeGreaterThanOrEqual(1);
      }
    }
  });
});

describe("DUERP express", () => {
  it("découpe les mesures aux virgules, sauf entre parenthèses", () => {
    expect(mesuresDe({ prevention: "Postes réglables (écran, siège, éclairage), pauses régulières" })).toEqual(["Postes réglables (écran, siège, éclairage)", "Pauses régulières"]);
  });

  it("propose les unités du métier", () => {
    expect(unitesDe(boulangerie)).toEqual(["Fournil", "Laboratoire", "Vente", "Toute l'entreprise"]);
  });

  it("déduit la maîtrise des mesures déjà en place", () => {
    expect(maitriseDepuis(0, 4)).toBe("insuffisante");
    expect(maitriseDepuis(2, 4)).toBe("partielle");
    expect(maitriseDepuis(4, 4)).toBe("bonne");
  });

  it("classe les mesures selon les principes généraux de prévention", () => {
    expect(principeDe("Gants et manchettes anti-chaleur")).toBe("epi");
    expect(principeDe("Formation gestes et postures")).toBe("formation");
    expect(principeDe("Plannings anticipés")).toBe("organisation");
    expect(principeDe("Produits moins dangereux et prédosés")).toBe("substituer");
    expect(principeDe("Aspiration raccordée à chaque machine")).toBe("collective");
  });

  it("baisse le risque restant quand des mesures sont en place", () => {
    const [farine] = choix();
    const sans = risqueResiduel(ligneDepuis(farine, 1));
    const avec = risqueResiduel(ligneDepuis({ ...farine, enPlace: mesuresDe(farine.modele) }, 1));
    expect(avec).toBeLessThan(sans);
    expect(ligneDepuis({ ...farine, enPlace: mesuresDe(farine.modele).slice(0, 2) }, 3)).toMatchObject({ effectif: 3, maitrise: "partielle", penibilite: "chimique", seuilPenibilite: "a-evaluer" });
  });

  it("transforme les mesures manquantes en actions, avec une échéance selon le niveau", () => {
    const [farine] = choix();
    const unePartie = { ...farine, enPlace: [mesuresDe(farine.modele)[0]] };
    const actions = actionsProposees([unePartie], "2026-10-29");
    expect(actions.map((a) => a.intitule)).toEqual(mesuresDe(farine.modele).slice(1));
    const niveau = niveauDe(risqueResiduel(ligneDepuis(unePartie, 1))).code;
    expect(actions[0].echeance).toBe(niveau === "critique" ? "2026-11-28" : niveau === "important" ? "2027-01-27" : "2027-04-27");
    // Un risque faible ne donne pas d'action.
    const faible = { ...farine, modele: { ...farine.modele, gravite: 1, frequence: 1 } };
    expect(actionsProposees([faible], "2026-10-29")).toEqual([]);
  });

  it("ajoute risques, actions et unités sans doublon", () => {
    const risques = choix();
    const actions = actionsProposees(risques, "2026-10-29");
    const unites = unitesDe(boulangerie).map((nom) => ({ nom, effectif: 2 }));
    const d0 = { ...donneesVides(), unites: ["Vente"] };
    const premier = appliquerExpress(d0, { unites, risques, actions, responsable: "Claire, gérante" });
    expect(premier.risquesAjoutes).toBe(boulangerie.risques.length);
    expect(premier.actionsAjoutees).toBe(actions.length);
    expect(premier.donnees.unites).toEqual(["Vente", "Fournil", "Laboratoire", "Toute l'entreprise"]);
    expect(premier.donnees.actions.every((a) => premier.donnees.duerp.some((l) => l.id === a.risqueId))).toBe(true);
    expect(premier.donnees.actions[0]).toMatchObject({ responsable: "Claire, gérante", statut: "a-faire" });
    // Relancé une seconde fois : rien n'est ajouté en double.
    const second = appliquerExpress(premier.donnees, { unites, risques, actions, responsable: "" });
    expect(second.risquesAjoutes).toBe(0);
    expect(second.actionsAjoutees).toBe(0);
  });

  it("ignore les unités et risques décochés", () => {
    const risques = choix().map((r) => (r.modele.unite === "Vente" ? r : { ...r, inclus: r.modele.activite.startsWith("Ouverture") }));
    const r = appliquerExpress(donneesVides(), { unites: [{ nom: "Vente", effectif: 1 }], risques, actions: [], responsable: "" });
    expect(r.donnees.duerp.map((l) => l.unite)).toEqual(["Vente", "Vente"]);
    expect(r.donnees.unites).toEqual(["Vente"]);
  });
});
