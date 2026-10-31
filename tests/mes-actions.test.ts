import { describe, expect, it } from "vitest";
import { emailRecapitulatif } from "@/lib/email-alertes";
import { actionsARappeler, mesActions } from "@/lib/mes-actions";
import { action, donnees, ligne } from "./aides";

const AUJOURDHUI = "2026-11-02";
const MOI = "marie.dupont@exemple.fr";

describe("mes actions", () => {
  const risque = ligne();
  const d = donnees({
    duerp: [risque],
    actions: [
      action(risque.id, { intitule: "En retard", echeance: "2026-10-20", responsableEmail: "Marie.Dupont@exemple.fr" }),
      action(risque.id, { intitule: "Dans 3 jours", echeance: "2026-11-05", responsableEmail: MOI }),
      action(risque.id, { intitule: "Dans un mois", echeance: "2026-12-02", responsableEmail: MOI }),
      action(risque.id, { intitule: "Sans date", echeance: "", responsableEmail: MOI }),
      action(risque.id, { intitule: "Faite", echeance: "2026-10-01", statut: "fait", realiseeLe: "2026-10-25", responsableEmail: MOI }),
      action(risque.id, { intitule: "À un collègue", echeance: "2026-11-03", responsableEmail: "paul@exemple.fr" }),
      action(risque.id, { intitule: "Texte libre seulement", echeance: "2026-11-03", responsable: "Direction" }),
    ],
  });

  it("regroupe mes actions, quelle que soit la casse de l'adresse", () => {
    const m = mesActions(d, MOI, AUJOURDHUI);
    expect(m.enRetard.map((a) => a.intitule)).toEqual(["En retard"]);
    expect(m.aVenir.map((a) => a.intitule)).toEqual(["Dans 3 jours", "Dans un mois"]);
    expect(m.sansEcheance.map((a) => a.intitule)).toEqual(["Sans date"]);
    expect(m.faitesRecemment.map((a) => a.intitule)).toEqual(["Faite"]);
  });

  it("le lundi, rappelle les actions en retard ou à échéance dans la semaine", () => {
    expect(actionsARappeler(d, MOI, AUJOURDHUI).map((a) => a.intitule)).toEqual(["En retard", "Dans 3 jours"]);
    expect(actionsARappeler(d, "personne@exemple.fr", AUJOURDHUI)).toEqual([]);
  });

  it("l'e-mail du lundi commence par « Vos actions »", () => {
    const email = emailRecapitulatif("E1", { urgences: [], echeances: [], autres: [] }, AUJOURDHUI, "https://app", "contributeur", actionsARappeler(d, MOI, AUJOURDHUI));
    expect(email.sujet).toContain("2 actions vous sont confiées");
    expect(email.html).toContain("Vos actions");
    expect(email.html).toContain("En retard depuis le 20/10/2026");
    expect(email.texte).toContain("VOS ACTIONS");
    expect(email.texte).toContain("échéance le 05/11/2026 · Dans 3 jours");
    // Sans action confiée, rien ne change.
    expect(emailRecapitulatif("E1", { urgences: [], echeances: [], autres: [] }, AUJOURDHUI, "https://app").html).not.toContain("Vos actions");
  });
});
