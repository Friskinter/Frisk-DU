// « Mes actions » : les actions de prévention confiées à une personne (Action.responsableEmail), pour
// sa page et son récapitulatif du lundi.

import { actionEnRetard } from "./actions";
import { decalerJours } from "./calculs";
import type { Action, Donnees } from "./types";

export const memeAdresse = (a: string | undefined, b: string) => !!a && a.trim().toLowerCase() === b.trim().toLowerCase();

export type MesActions = {
  enRetard: Action[];
  aVenir: Action[]; // avec une échéance, de la plus proche à la plus lointaine
  sansEcheance: Action[];
  faitesRecemment: Action[]; // réalisées dans les 30 derniers jours
};

export function mesActions(d: Donnees, email: string, aujourdhui: string): MesActions {
  const miennes = d.actions.filter((a) => memeAdresse(a.responsableEmail, email));
  const ouvertes = miennes.filter((a) => a.statut !== "fait");
  const parEcheance = (a: Action, b: Action) => a.echeance.localeCompare(b.echeance);
  return {
    enRetard: ouvertes.filter((a) => actionEnRetard(a, aujourdhui)).sort(parEcheance),
    aVenir: ouvertes.filter((a) => a.echeance && !actionEnRetard(a, aujourdhui)).sort(parEcheance),
    sansEcheance: ouvertes.filter((a) => !a.echeance),
    faitesRecemment: miennes
      .filter((a) => a.statut === "fait" && a.realiseeLe >= decalerJours(aujourdhui, -30))
      .sort((a, b) => b.realiseeLe.localeCompare(a.realiseeLe)),
  };
}

// Actions à rappeler dans le récapitulatif du lundi : en retard, ou à échéance dans la semaine.
export function actionsARappeler(d: Donnees, email: string, aujourdhui: string, jours = 6): Action[] {
  const { enRetard, aVenir } = mesActions(d, email, aujourdhui);
  return [...enRetard, ...aVenir.filter((a) => a.echeance <= decalerJours(aujourdhui, jours))];
}
