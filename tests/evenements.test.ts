import { describe, expect, it } from "vitest";
import { calculerAlertes } from "@/lib/alertes";
import { donneesDemo } from "@/lib/demo";
import { normaliser } from "@/lib/donnees";
import {
  calculerIndicateurs,
  declarationEnRetard,
  ecartsCotation,
  echeanceDeclaration,
  estClos,
  etapes,
  graviteConstatee,
  heuresTravaillees,
  nomVictime,
  peutAllerAuRegistre,
} from "@/lib/evenements";
import { detailsChangement, libelleElement, valeurLisible } from "@/lib/journal";
import type { Donnees } from "@/lib/types";
import { action, donnees, evenement, ligne } from "./aides";

const aujourdhui = "2026-10-28";

describe("accidents et presque-accidents", () => {
  it("un nouvel événement attend une déclaration seulement s'il s'agit d'un accident", () => {
    expect(evenement({ type: "accident-travail" })).toMatchObject({ declaration: "a-faire", soins: "premiers-soins" });
    expect(evenement({ type: "accident-trajet" }).declaration).toBe("a-faire");
    expect(evenement({ type: "presque-accident" })).toMatchObject({ declaration: "non-requise", soins: "aucun" });
    expect(evenement({ type: "situation-dangereuse" }).declaration).toBe("non-requise");
  });

  it("déclaration dans les 48 heures, dimanches non compris", () => {
    expect(echeanceDeclaration({ date: "2026-10-22" })).toBe("2026-10-24"); // jeudi → samedi
    expect(echeanceDeclaration({ date: "2026-10-23" })).toBe("2026-10-26"); // vendredi → lundi
    expect(echeanceDeclaration({ date: "2026-10-24" })).toBe("2026-10-27"); // samedi → mardi
    expect(echeanceDeclaration({ date: "" })).toBe("");
    expect(declarationEnRetard(evenement({ date: "2026-10-22" }), aujourdhui)).toBe(true);
    expect(declarationEnRetard(evenement({ date: "2026-10-27" }), aujourdhui)).toBe(false);
    expect(declarationEnRetard(evenement({ date: "2026-10-22", declaration: "faite" }), aujourdhui)).toBe(false);
  });

  it("registre des accidents bénins : ni arrêt ni soins médicaux, accident du travail seulement", () => {
    expect(peutAllerAuRegistre({ type: "accident-travail", soins: "premiers-soins" })).toBe(true);
    expect(peutAllerAuRegistre({ type: "accident-travail", soins: "soins-medicaux" })).toBe(false);
    expect(peutAllerAuRegistre({ type: "accident-travail", soins: "arret" })).toBe(false);
    expect(peutAllerAuRegistre({ type: "accident-trajet", soins: "premiers-soins" })).toBe(false);
  });

  it("gravité constatée sur l'échelle de cotation", () => {
    expect(graviteConstatee(evenement({ type: "presque-accident" }))).toBe(0);
    expect(graviteConstatee(evenement({ soins: "premiers-soins" }))).toBe(1);
    expect(graviteConstatee(evenement({ soins: "soins-medicaux" }))).toBe(2);
    expect(graviteConstatee(evenement({ soins: "arret", joursArret: 3 }))).toBe(2);
    expect(graviteConstatee(evenement({ soins: "arret", joursArret: 12 }))).toBe(3);
  });

  it("écarts entre l'événement et la cotation du risque", () => {
    const risque = ligne({ id: "r", gravite: 2, frequence: 1, maitrise: "bonne" });
    const e1 = evenement({ risqueId: "r", date: "2026-10-01", soins: "arret", joursArret: 20 });
    const e2 = evenement({ risqueId: "r", date: "2026-06-01", type: "presque-accident", gravitePotentielle: 4 });
    const ecarts = ecartsCotation(e1, risque, [e1, e2], aujourdhui);
    expect(ecarts).toHaveLength(3);
    expect(ecarts[0]).toContain("gravité 3");
    expect(ecarts[1]).toContain("2 événements en 12 mois");
    expect(ecarts[2]).toContain("Maîtrise jugée bonne");
    // Gravité potentielle prise en compte ; un risque bien coté ne donne pas d'écart.
    expect(ecartsCotation(e2, risque, [e2], aujourdhui)[0]).toContain("gravité 4");
    expect(ecartsCotation(e2, ligne({ id: "r", gravite: 4, frequence: 3 }), [e1, e2], aujourdhui)).toEqual([]);
  });

  it("avancement : déclaration, analyse, report dans le DUERP, actions", () => {
    const e = evenement({ id: "e", date: "2026-10-01" });
    expect(etapes(e, [])).toEqual({ declaration: false, analyse: false, risque: false, actions: true });
    const traite = { ...e, declaration: "faite" as const, analyseeLe: "2026-10-05", risqueId: "r", reevalueLe: "2026-10-05" };
    expect(estClos(traite, [])).toBe(true);
    const enCours = action("r", { evenementId: "e", statut: "en-cours" });
    expect(estClos(traite, [enCours])).toBe(false);
    expect(estClos(traite, [{ ...enCours, statut: "fait" }])).toBe(true);
    // Un risque rattaché mais dont la cotation n'a pas été revue n'est pas traité.
    expect(etapes({ ...traite, reevalueLe: "" }, []).risque).toBe(false);
  });

  it("taux de fréquence et de gravité sur 12 mois, hors accidents de trajet", () => {
    const d = donnees({
      fiche: { siret: "", adresse: "", activite: "", effectif: "10", responsable: "", heures: "20 000" },
      evenements: [
        evenement({ date: "2026-09-01", soins: "arret", joursArret: 10 }),
        evenement({ date: "2026-05-01", soins: "arret", joursArret: 4 }),
        evenement({ date: "2026-08-01", type: "accident-trajet", soins: "arret", joursArret: 30 }),
        evenement({ date: "2025-01-01", soins: "arret", joursArret: 50 }), // plus de 12 mois
        evenement({ date: "2026-10-01", soins: "premiers-soins" }),
        evenement({ date: "2026-10-02", type: "presque-accident" }),
        evenement({ date: "2026-10-03", type: "situation-dangereuse" }),
      ],
    });
    const i = calculerIndicateurs(d, aujourdhui);
    expect(i.accidentsAvecArret).toBe(2);
    expect(i.joursArret).toBe(14);
    expect(i.tauxFrequence).toBe(100); // 2 × 1 000 000 / 20 000
    expect(i.tauxGravite).toBe(0.7); // 14 × 1 000 / 20 000
    expect(i.heuresEstimees).toBe(false);
    expect(i.presqueAccidents).toBe(2);
    expect(i.joursSansAccident).toBe(57);
  });

  it("heures travaillées estimées à partir de l'effectif, sinon inconnues", () => {
    expect(heuresTravaillees({ fiche: { siret: "", adresse: "", activite: "", effectif: "14 salariés", responsable: "" } })).toEqual({
      heures: 14 * 1607,
      estimation: true,
    });
    expect(heuresTravaillees({})).toBeNull();
    const i = calculerIndicateurs(donnees({ evenements: [] }), aujourdhui);
    expect(i.tauxFrequence).toBeNull();
    expect(i.joursSansAccident).toBeNull();
  });

  it("personne concernée : salarié ou personne extérieure", () => {
    const d = donnees({ salaries: [{ id: "s1", nom: "Durand C.", service: "", poste: "", tailles: {} }] });
    expect(nomVictime(evenement({ salarieId: "s1" }), d)).toBe("Durand C.");
    expect(nomVictime(evenement({ salarieId: "externe", victime: "Intérimaire X" }), d)).toBe("Intérimaire X");
    expect(nomVictime(evenement(), d)).toBe("");
  });

  it("anciens contenus : la liste des événements est ajoutée", () => {
    const ancien = { ...donnees(), evenements: undefined } as unknown as Donnees;
    expect(normaliser(ancien).evenements).toEqual([]);
    const d = donnees();
    expect(normaliser(d)).toBe(d);
  });
});

describe("alertes liées aux accidents", () => {
  const ids = (d: Donnees) => calculerAlertes(d, aujourdhui).map((a) => a.id);

  it("déclaration, analyse et report dans le DUERP", () => {
    const d = donnees({
      evenements: [
        evenement({ date: "2026-10-27" }),
        evenement({ date: "2026-10-10", declaration: "faite" }),
        evenement({ date: "2026-09-01", type: "presque-accident" }),
      ],
    });
    const alertes = calculerAlertes(d, aujourdhui);
    expect(ids(d)).toEqual(expect.arrayContaining(["accidents-a-declarer", "accidents-a-analyser", "presque-accidents-a-analyser", "accidents-duerp"]));
    // Un seul événement concerné : le lien ouvre directement sa fiche.
    expect(alertes.find((a) => a.id === "accidents-a-declarer")?.lien).toMatch(/^\/accidents\?evenement=/);
    expect(alertes.find((a) => a.id === "accidents-duerp")?.lien).toBe("/accidents");
  });

  it("pas de nom de victime dans les alertes (elles partent par e-mail)", () => {
    const d = donnees({
      salaries: [{ id: "s1", nom: "Durand C.", service: "", poste: "", tailles: {} }],
      evenements: [evenement({ date: "2026-10-01", salarieId: "s1", lieu: "Quai 2" })],
    });
    const texte = JSON.stringify(calculerAlertes(d, aujourdhui));
    expect(texte).toContain("Quai 2");
    expect(texte).not.toContain("Durand");
  });

  it("un événement traité ne génère plus d'alerte", () => {
    const d = donnees({
      evenements: [
        evenement({ date: "2026-09-01", declaration: "faite", analyseeLe: "2026-09-03", risqueId: "r", reevalueLe: "2026-09-03" }),
      ],
    });
    expect(ids(d).filter((i) => i.includes("accident"))).toEqual([]);
  });

  it("contenu sans liste d'événements (récapitulatif e-mail d'une base non migrée)", () => {
    const ancien = { ...donnees(), evenements: undefined } as unknown as Donnees;
    expect(() => calculerAlertes(ancien, aujourdhui)).not.toThrow();
  });

  it("démonstration : un accident bénin récent attend son analyse et son report", () => {
    const d = donneesDemo(aujourdhui);
    expect(d.evenements).toHaveLength(3);
    expect(ids(d)).not.toContain("accidents-a-declarer");
  });
});

describe("journal des accidents", () => {
  it("libellés lisibles", () => {
    expect(valeurLisible("type", "presque-accident")).toBe("Presque-accident");
    expect(valeurLisible("declaration", "registre")).toBe("Inscrit au registre des accidents bénins");
    expect(valeurLisible("gravitePotentielle", 0)).toBe("(non évaluée)");
    expect(valeurLisible("pourquoi", ["Sol glissant", "Fuite"])).toBe("1. Sol glissant 2. Fuite");
    expect(valeurLisible("facteurs", { individu: "", tache: "Urgence", materiel: "", milieu: "" })).toBe("Tâche : Urgence");
    // Le type d'un mouvement d'EPI reste affiché tel quel.
    expect(valeurLisible("type", "sortie")).toBe("sortie");
  });

  it("nom de l'événement et détail des changements", () => {
    const e = evenement({ id: "e1", date: "2026-10-01", lieu: "Quai 2" });
    const entree = {
      id: 1, created_at: "", auteur: "", collection: "evenements", element_id: "e1",
      action: "modification" as const, avant: { soins: "premiers-soins" }, apres: { soins: "arret" },
    };
    expect(libelleElement(entree, donnees({ evenements: [e] }))).toBe("Accident du travail du 01/10/2026 (Quai 2)");
    expect(detailsChangement(entree)).toEqual([{ champ: "Conséquences", avant: "Premiers soins sur place", apres: "Arrêt de travail" }]);
  });
});
