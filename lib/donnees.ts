// Contenu lu en base : complète les listes apparues depuis son enregistrement
// (contenus antérieurs au plan d'actions ou au registre des accidents).

import { avecActions } from "./actions";
import { nouvelId } from "./calculs";
import type { Donnees, LigneDuerp } from "./types";

export function normaliser(donnees: Donnees): Donnees {
  const d = avecActions(donnees);
  return d.evenements ? d : { ...d, evenements: [] };
}

export function nouvelleLigne(unite: string, champs: Partial<LigneDuerp> = {}): LigneDuerp {
  return {
    id: nouvelId(),
    unite,
    activite: "",
    danger: "",
    risque: "",
    effectif: 1,
    gravite: 1,
    frequence: 1,
    mesures: "",
    maitrise: "insuffisante",
    penibilite: "",
    seuilPenibilite: "non",
    ...champs,
  };
}
