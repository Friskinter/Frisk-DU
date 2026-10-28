import { nouvelId } from "@/lib/calculs";
import { donneesVides } from "@/lib/demo";
import type { Article, Donnees, LigneDuerp, Mouvement } from "@/lib/types";
export { nouvelleAction as action } from "@/lib/actions";

export function ligne(champs: Partial<LigneDuerp> = {}): LigneDuerp {
  return {
    id: nouvelId(), unite: "Atelier", activite: "Activité", danger: "Danger", risque: "Risque",
    effectif: 1, gravite: 1, frequence: 1, mesures: "", maitrise: "insuffisante", penibilite: "",
    seuilPenibilite: "non", ...champs,
  };
}

export function article(champs: Partial<Article> = {}): Article {
  return { id: nouvelId(), nom: "Gants", categorie: "Mains", tailles: ["9"], prix: 2, delai: 10, lot: 1, tampons: { "9": 10 }, ...champs };
}

export function mouvement(champs: Partial<Mouvement> = {}): Mouvement {
  return { id: nouvelId(), date: "2026-10-01", type: "entree", articleId: "", taille: "9", quantite: 1, salarieId: "", service: "", motif: "", ...champs };
}

export function donnees(champs: Partial<Donnees> = {}): Donnees {
  return { ...donneesVides(), ...champs };
}
export { nouvelEvenement as evenement } from "@/lib/evenements";
export { nouvelleExigence as exigence, nouvelleFormation as formation } from "@/lib/formations";

export function salarie(champs: Partial<import("@/lib/types").Salarie> = {}): import("@/lib/types").Salarie {
  return { id: nouvelId(), nom: "Salarié", service: "", poste: "", tailles: {}, ...champs };
}
export { nouvelEquipement as equipement, nouvelleObservation as observation, nouvelleVerification as verification } from "@/lib/verifications";
