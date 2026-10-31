import { describe, expect, it } from "vitest";
import { donneesVides } from "@/lib/demo";
import { emailRecapitulatif } from "@/lib/email-alertes";
import { preparerRecapitulatif, recapitulatifVide } from "@/lib/recapitulatif";
import type { Action, Donnees } from "@/lib/types";

const LUNDI = "2026-11-02";
const action = (id: string, intitule: string, echeance: string): Action => ({
  id, risqueId: "", intitule, principe: "eviter" as Action["principe"], responsable: "Marie Durand", echeance, statut: "a-faire" as Action["statut"],
  cout: null, ressources: "", indicateur: "", realiseeLe: "", efficacite: "" as Action["efficacite"], commentaire: "",
});
const contexte = { versions: 0, derniereVersion: null, lienActif: false };

function donnees(): Donnees {
  return {
    ...donneesVides(),
    actions: [
      action("a1", "Réparer la rambarde du quai", "2026-10-20"), // en retard : alerte urgente
      action("a2", "Afficher les consignes incendie", "2026-11-05"), // cette semaine
      action("a3", "Changer les extincteurs", "2026-11-08"), // dimanche : encore cette semaine
      action("a4", "Former au port du harnais", "2026-11-09"), // lundi suivant
    ],
  };
}

describe("récapitulatif du lundi", () => {
  it("rassemble urgences, échéances de la semaine, points à traiter et prochaine étape du parcours", () => {
    const r = preparerRecapitulatif(donnees(), LUNDI, contexte);
    expect(r.urgences.map((a) => a.id)).toContain("actions-retard");
    expect(r.urgences.every((a) => a.gravite === "critique")).toBe(true);
    expect(r.autres.every((a) => a.gravite !== "critique")).toBe(true);
    // Les échéances de la semaine seulement, sans celles en retard (déjà dans les urgences).
    expect(r.echeances.map((e) => e.titre)).toEqual(["Afficher les consignes incendie", "Changer les extincteurs"]);
    expect(r.prochaine?.code).toBe("profil");
    expect(recapitulatifVide(r)).toBe(false);
  });

  it("n'envoie rien quand il n'y a rien à signaler", () => {
    expect(recapitulatifVide({ urgences: [], echeances: [], autres: [], prochaine: undefined })).toBe(true);
  });

  it("donne au responsable le détail des échéances et la prochaine étape du parcours", () => {
    const r = preparerRecapitulatif(donnees(), LUNDI, contexte);
    const { sujet, html, texte } = emailRecapitulatif("E1", r, LUNDI, "https://app", "responsable");
    expect(sujet).toMatch(/^Frisk Plateforme · E1 : \d+ urgences?, .*2 échéances cette semaine$/);
    for (const contenu of [html, texte]) {
      expect(contenu).toContain("Afficher les consignes incendie");
      expect(contenu).toContain("Marie Durand");
      expect(contenu).toContain("Décrire votre entreprise");
    }
    // Les urgences d'abord, puis les échéances, puis le reste.
    expect(texte.indexOf("URGENT")).toBeLessThan(texte.indexOf("ÉCHÉANCES DE LA SEMAINE"));
    expect(texte.indexOf("ÉCHÉANCES DE LA SEMAINE")).toBeLessThan(texte.indexOf("PROCHAINE ÉTAPE"));
  });

  it("donne au lecteur un décompte des échéances, sans noms ni parcours", () => {
    const r = preparerRecapitulatif(donnees(), LUNDI, contexte);
    for (const role of ["lecteur", "contributeur"] as const) {
      const { html, texte } = emailRecapitulatif("E1", r, LUNDI, "https://app", role);
      for (const contenu of [html, texte]) {
        expect(contenu).toContain("Actions de prévention : 2");
        expect(contenu).not.toContain("Afficher les consignes incendie");
        expect(contenu).not.toContain("Marie Durand");
        expect(contenu).not.toContain("Décrire votre entreprise");
      }
    }
    expect(emailRecapitulatif("E1", r, LUNDI, "https://app", "lecteur").texte).toContain("Version résumée");
  });

  it("signale au lecteur que le détail des échéances est réservé, même sans alerte", () => {
    const r = { urgences: [], autres: [], echeances: preparerRecapitulatif(donnees(), LUNDI, contexte).echeances };
    expect(emailRecapitulatif("E1", r, LUNDI, "https://app", "lecteur").texte).toContain("Version résumée");
    expect(emailRecapitulatif("E1", r, LUNDI, "https://app", "responsable").texte).not.toContain("Version résumée");
  });
});
