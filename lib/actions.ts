// Plan d'actions de prévention : une ou plusieurs actions par risque du DUERP.

import { nouvelId } from "./calculs";
import type { Action, Donnees, LigneDuerp } from "./types";

export function nouvelleAction(risqueId: string, champs: Partial<Action> = {}): Action {
  return {
    id: nouvelId(),
    risqueId,
    intitule: "",
    principe: "",
    responsable: "",
    echeance: "",
    statut: "a-faire",
    cout: null,
    ressources: "",
    indicateur: "",
    realiseeLe: "",
    efficacite: "non-evaluee",
    commentaire: "",
    ...champs,
  };
}

// Actions d'un contenu ; pour l'ancien format (une action par ligne du DUERP, ex. versions figées
// avant le plan d'actions), elles sont reconstituées à partir des lignes.
export function actionsDe(donnees: Pick<Donnees, "duerp"> & { actions?: Action[] }): Action[] {
  if (donnees.actions) return donnees.actions;
  return donnees.duerp
    .filter((l) => l.action?.trim())
    .map((l) =>
      nouvelleAction(l.id, {
        id: `${l.id}-action`,
        intitule: l.action ?? "",
        responsable: l.responsable ?? "",
        echeance: l.echeance ?? "",
        statut: l.statut ?? "a-faire",
      }),
    );
}

// Contenu chargé d'une base pas encore migrée : garantit la présence de la liste des actions.
export function avecActions(donnees: Donnees): Donnees {
  return donnees.actions ? donnees : { ...donnees, actions: actionsDe(donnees) };
}

export function actionsDuRisque(actions: Action[], risque: LigneDuerp) {
  return actions.filter((a) => a.risqueId === risque.id);
}

export function actionEnRetard(action: Action, aujourdhui: string) {
  return action.statut !== "fait" && !!action.echeance && action.echeance < aujourdhui;
}

// Au moins 50 salariés : programme annuel de prévention (PAPRIPACT) ; sinon, liste des actions.
export function effectifDeclare(donnees: Pick<Donnees, "fiche">) {
  const n = parseInt((donnees.fiche?.effectif ?? "").replace(/\s/g, ""), 10);
  return Number.isFinite(n) ? n : null;
}

export function estPapripact(donnees: Pick<Donnees, "fiche">) {
  return (effectifDeclare(donnees) ?? 0) >= 50;
}
