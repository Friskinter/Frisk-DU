import { describe, expect, it } from "vitest";
import { calculerAlertes } from "@/lib/alertes";
import { donneesDemo } from "@/lib/demo";
import { normaliser } from "@/lib/donnees";
import { libelleElement } from "@/lib/journal";
import { appliquerOperations, calculerOperations } from "@/lib/operations";
import type { Visite } from "@/lib/types";
import {
  actionPourNonConformite,
  bilanVisite,
  copierGrille,
  grillesModeles,
  grouperParTheme,
  nonConformitesOuvertes,
  nouvelleVisite,
  sansAction,
} from "@/lib/visites";

const aujourdhui = "2026-10-28";

function avecResultats(v: Visite, resultats: Visite["reponses"][number]["resultat"][]): Visite {
  return { ...v, reponses: v.reponses.map((r, n) => ({ ...r, resultat: resultats[n] ?? "" })) };
}

describe("visites et audits", () => {
  it("bibliothèque : identifiants uniques, chaque grille a des points et des thèmes", () => {
    const ids = grillesModeles.flatMap((g) => g.points.map((p) => p.id));
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(grillesModeles.map((g) => g.id)).size).toBe(grillesModeles.length);
    for (const g of grillesModeles) {
      expect(g.points.length).toBeGreaterThanOrEqual(8);
      expect(g.points.every((p) => p.theme && p.question)).toBe(true);
    }
  });

  it("une visite recopie les points de la grille : la modifier ensuite ne change pas la visite", () => {
    const grille = copierGrille(grillesModeles[1]);
    expect(grille.id).not.toBe(grillesModeles[1].id);
    expect(grille.points[0].id).not.toBe(grillesModeles[1].points[0].id);
    const v = nouvelleVisite(grille, aujourdhui);
    grille.points[0].question = "Autre question";
    expect(v.reponses[0].question).toBe(grillesModeles[1].points[0].question);
    expect(v).toMatchObject({ grille: "Entrepôt et quais", date: aujourdhui, clotureeLe: "" });
    expect(v.reponses.every((r) => r.resultat === "")).toBe(true);
  });

  it("taux de conformité : les points sans objet ne comptent pas", () => {
    const v = avecResultats(nouvelleVisite(grillesModeles[0], aujourdhui), ["conforme", "conforme", "conforme", "non-conforme", "sans-objet"]);
    expect(bilanVisite(v)).toEqual({ conformes: 3, nonConformes: 1, sansObjet: 1, restants: v.reponses.length - 5, total: v.reponses.length, taux: 75 });
    expect(bilanVisite(nouvelleVisite(grillesModeles[0], aujourdhui)).taux).toBeNull();
  });

  it("une non-conformité devient une action, et reste ouverte jusqu'à sa réalisation", () => {
    let v = avecResultats(nouvelleVisite(grillesModeles[0], aujourdhui), ["non-conforme", "conforme"]);
    v.reponses[0].commentaire = "Marquage effacé allée C";
    expect(sansAction([v], [])).toHaveLength(1);
    const a = actionPourNonConformite(v, v.reponses[0], aujourdhui);
    expect(a).toMatchObject({ visiteId: v.id, risqueId: "", echeance: "2026-11-27", statut: "a-faire" });
    expect(a.intitule).toContain("Marquage effacé allée C");
    v = { ...v, reponses: v.reponses.map((r, n) => (n === 0 ? { ...r, actionId: a.id } : r)) };
    expect(sansAction([v], [a])).toHaveLength(0);
    expect(nonConformitesOuvertes([v], [a])).toHaveLength(1);
    expect(nonConformitesOuvertes([v], [{ ...a, statut: "fait" }])).toHaveLength(0);
  });

  it("regroupe les points par thème dans l'ordre de la grille", () => {
    const groupes = grouperParTheme(grillesModeles[0].points);
    expect(groupes[0].theme).toBe("Circulation");
    expect(groupes.reduce((t, g) => t + g.elements.length, 0)).toBe(grillesModeles[0].points.length);
  });

  it("alertes : non-conformité sans action, visite non clôturée, plus de visite depuis 3 mois", () => {
    const d = normaliser(donneesDemo(aujourdhui));
    expect(calculerAlertes(d, aujourdhui).find((a) => a.id === "visites-sans-action")?.detail).toContain("trousse de premiers secours");
    const ouverte = { ...nouvelleVisite(grillesModeles[2], aujourdhui), date: "2026-10-10" };
    const ids = calculerAlertes({ ...d, visites: [ouverte] }, aujourdhui).map((a) => a.id);
    expect(ids).toContain("visites-a-cloturer");
    const ancienne = { ...ouverte, date: "2026-06-01", clotureeLe: "2026-06-01" };
    expect(calculerAlertes({ ...d, visites: [ancienne] }, aujourdhui).map((a) => a.id)).toContain("visites-anciennes");
    // Sans aucune visite, pas de reproche.
    expect(calculerAlertes({ ...d, visites: [] }, aujourdhui).some((a) => a.id.startsWith("visites-"))).toBe(false);
  });

  it("démonstration : une visite clôturée, une action en cours, une non-conformité sans action", () => {
    const d = donneesDemo(aujourdhui);
    const [v] = d.visites;
    expect(bilanVisite(v)).toMatchObject({ nonConformes: 2, sansObjet: 2, restants: 0 });
    expect(d.actions.find((a) => a.visiteId === v.id)?.statut).toBe("en-cours");
    expect(sansAction(d.visites, d.actions)).toHaveLength(1);
  });

  it("enregistrement : visite et action créées ensemble passent par les opérations", () => {
    const avant = normaliser(donneesDemo(aujourdhui));
    const v = avecResultats(nouvelleVisite(grillesModeles[4], aujourdhui), ["non-conforme"]);
    const a = actionPourNonConformite(v, v.reponses[0], aujourdhui);
    v.reponses[0].actionId = a.id;
    const apres = { ...avant, visites: [v, ...avant.visites], actions: [...avant.actions, a] };
    const ops = calculerOperations(avant, apres);
    expect(ops.map((o) => o.type === "ajout" && o.collection).sort()).toEqual(["actions", "visites"]);
    expect(appliquerOperations(avant, ops)).toEqual(apres);
  });

  it("journal : libellé lisible", () => {
    const d = normaliser(donneesDemo(aujourdhui));
    const v = d.visites[0];
    expect(
      libelleElement({ id: 1, created_at: "", auteur: "", collection: "visites", element_id: v.id, action: "modification", avant: null, apres: null }, d),
    ).toBe(`Visite du ${v.date.split("-").reverse().join("/")} : Visite sécurité générale (Zone de stockage)`);
  });
});
