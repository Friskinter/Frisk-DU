// Contenu lu en base : complète les listes apparues depuis son enregistrement
// (contenus antérieurs au plan d'actions, au registre des accidents, aux formations, aux vérifications
// ou aux produits chimiques).

import { avecActions } from "./actions";
import { nouvelId } from "./calculs";
import type { Donnees, LigneDuerp } from "./types";

export function normaliser(donnees: Donnees): Donnees {
  const d = avecActions(donnees);
  if (d.evenements && d.formations && d.exigences && d.equipements && d.verifications && d.produits) return d;
  return {
    ...d,
    evenements: d.evenements ?? [],
    formations: d.formations ?? [],
    exigences: d.exigences ?? [],
    equipements: d.equipements ?? [],
    verifications: d.verifications ?? [],
    produits: d.produits ?? [],
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
