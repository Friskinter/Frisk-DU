// Contenu lu en base : complète les listes apparues depuis son enregistrement
// (contenus antérieurs au plan d'actions, au registre des accidents, aux formations, aux vérifications,
// aux produits chimiques, aux plans de prévention ou aux protocoles de sécurité).

import { avecActions } from "./actions";
import { nouvelId } from "./calculs";
import type { Donnees, LigneDuerp } from "./types";

export function normaliser(donnees: Donnees): Donnees {
  const d = avecActions(donnees);
  if (d.evenements && d.formations && d.exigences && d.equipements && d.verifications && d.produits && d.interventions && d.protocoles) return d;
  return {
    ...d,
    evenements: d.evenements ?? [],
    formations: d.formations ?? [],
    exigences: d.exigences ?? [],
    equipements: d.equipements ?? [],
    verifications: d.verifications ?? [],
    produits: d.produits ?? [],
    interventions: d.interventions ?? [],
    protocoles: d.protocoles ?? [],
  };
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
