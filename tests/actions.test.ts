import { describe, expect, it } from "vitest";
import { actionEnRetard, actionsDe, avecActions, effectifDeclare, estPapripact, nouvelleAction } from "@/lib/actions";
import { donnees, ligne } from "./aides";

describe("plan d'actions", () => {
  const aujourdhui = "2026-10-28";

  it("une action est en retard seulement si elle n'est pas réalisée et que l'échéance est passée", () => {
    expect(actionEnRetard(nouvelleAction("l", { echeance: "2026-10-27" }), aujourdhui)).toBe(true);
    expect(actionEnRetard(nouvelleAction("l", { echeance: "2026-10-28" }), aujourdhui)).toBe(false);
    expect(actionEnRetard(nouvelleAction("l", { echeance: "2026-10-01", statut: "fait" }), aujourdhui)).toBe(false);
    expect(actionEnRetard(nouvelleAction("l", { echeance: "" }), aujourdhui)).toBe(false);
  });

  it("reconstitue les actions de l'ancien format (une action par ligne)", () => {
    const ancien = {
      duerp: [
        ligne({ id: "a", action: "Garde-corps", responsable: "R", echeance: "2026-12-01", statut: "en-cours" }),
        ligne({ id: "b", action: "" }),
      ],
    };
    const actions = actionsDe(ancien);
    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({ risqueId: "a", intitule: "Garde-corps", responsable: "R", statut: "en-cours" });
  });

  it("garde les actions du nouveau format telles quelles", () => {
    const a = nouvelleAction("l1", { intitule: "X" });
    expect(actionsDe({ duerp: [], actions: [a] })).toEqual([a]);
    const d = donnees({ actions: [a] });
    expect(avecActions(d)).toBe(d);
  });

  it("programme annuel (PAPRIPACT) à partir de 50 salariés", () => {
    const fiche = (effectif: string) => ({ fiche: { siret: "", adresse: "", activite: "", effectif, responsable: "" } });
    expect(effectifDeclare(fiche("14 salariés"))).toBe(14);
    expect(effectifDeclare(fiche("1 250"))).toBe(1250);
    expect(estPapripact(fiche("49"))).toBe(false);
    expect(estPapripact(fiche("50 salariés"))).toBe(true);
    expect(estPapripact({})).toBe(false);
  });
});
