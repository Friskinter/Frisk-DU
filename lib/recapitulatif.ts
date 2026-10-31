// Contenu du récapitulatif du lundi : les urgences, les échéances de la semaine, les autres points à
// traiter et la prochaine étape du parcours. Tout est calculé à partir des données, comme le tableau
// de bord : le récapitulatif dit la même chose que l'application.

import { calculerAlertes, type Alerte } from "./alertes";
import { calculerEcheances, type Echeance } from "./echeances";
import { calculerParcours, type EtapeParcours } from "./parcours";
import type { Donnees } from "./types";

export type Recapitulatif = {
  urgences: Alerte[]; // alertes critiques
  echeances: Echeance[]; // de la semaine, d'aujourd'hui (lundi) à dimanche ; celles en retard sont déjà des alertes
  autres: Alerte[]; // points à traiter et à surveiller
  prochaine?: EtapeParcours; // prochaine étape de « Mon parcours QHSE »
};

// Lundi + 6 jours : jusqu'au dimanche.
export const JOURS_SEMAINE = 6;

export function preparerRecapitulatif(
  d: Donnees,
  aujourdhui: string,
  contexte: { versions: number; derniereVersion: string | null; lienActif: boolean },
): Recapitulatif {
  const alertes = calculerAlertes(d, aujourdhui, contexte.derniereVersion);
  return {
    urgences: alertes.filter((a) => a.gravite === "critique"),
    echeances: calculerEcheances(d, aujourdhui, JOURS_SEMAINE).filter((e) => !e.enRetard),
    autres: alertes.filter((a) => a.gravite !== "critique"),
    prochaine: calculerParcours(d, { aujourdhui, ...contexte }).prochaine,
  };
}

// Rien à signaler cette semaine : pas d'e-mail (la prochaine étape du parcours seule ne suffit pas,
// pour ne pas écrire chaque lundi à une entreprise qui n'a rien d'urgent).
export const recapitulatifVide = (r: Recapitulatif) => !r.urgences.length && !r.echeances.length && !r.autres.length;
