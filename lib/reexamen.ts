// Unité de travail modifiée → réexaminer ses risques. Le document unique doit être mis à jour lors
// de toute décision d'aménagement important modifiant les conditions de santé et de sécurité
// (art. R4121-2) : nouvel équipement, réaménagement, nouveau procédé… Le responsable signale le
// changement sur l'unité ; chacun de ses risques porte alors une demande de réexamen, levée quand la
// cotation est revue ou confirmée. Rien d'autre n'est stocké : l'alerte se calcule d'après les risques.

import type { Donnees, LigneDuerp } from "./types";

export type Reexamen = { depuis: string; motif: string }; // depuis : AAAA-MM-JJ

export const motifsChangement = [
  "Nouvel équipement ou nouvelle machine",
  "Réaménagement des locaux ou du poste",
  "Nouveau procédé ou nouveau produit",
  "Changement d'organisation ou d'horaires",
  "Accident ou incident",
];

// Champs dont la modification vaut réexamen du risque.
export const champsCotation: (keyof LigneDuerp)[] = ["gravite", "frequence", "maitrise", "mesures", "effectif"];

export const aReexaminer = (l: LigneDuerp) => !!l.reexamen;

// Signale un changement dans l'unité : tous ses risques sont à réexaminer.
export function signalerChangement(d: Donnees, unite: string, motif: string, date: string): Donnees {
  const reexamen: Reexamen = { depuis: date, motif: motif.trim() || "Changement dans l'unité" };
  return { ...d, duerp: d.duerp.map((l) => (l.unite === unite ? { ...l, reexamen } : l)) };
}

// Le risque a été réexaminé (cotation revue ou confirmée inchangée).
export function marquerReexamine(d: Donnees, ligneId: string): Donnees {
  return { ...d, duerp: d.duerp.map((l) => (l.id === ligneId && l.reexamen ? { ...l, reexamen: null } : l)) };
}

// Changements en attente, par unité : motif et date du plus ancien, nombre de risques concernés.
export function changementsEnAttente(d: Pick<Donnees, "duerp">) {
  const parUnite = new Map<string, Reexamen & { unite: string; risques: number }>();
  for (const l of d.duerp) {
    if (!l.reexamen) continue;
    const deja = parUnite.get(l.unite);
    if (!deja) parUnite.set(l.unite, { unite: l.unite, ...l.reexamen, risques: 1 });
    else parUnite.set(l.unite, { ...deja, ...(l.reexamen.depuis < deja.depuis ? l.reexamen : {}), risques: deja.risques + 1 });
  }
  return [...parUnite.values()].sort((a, b) => a.depuis.localeCompare(b.depuis) || a.unite.localeCompare(b.unite));
}

// Unités de travail déclarées sans aucun risque évalué (nouvelle unité, ou unité renommée dans les
// réglages alors que ses risques portent l'ancien nom).
export function unitesSansRisque(d: Pick<Donnees, "unites" | "duerp">) {
  if (!d.duerp.length) return [];
  const evaluees = new Set(d.duerp.map((l) => l.unite));
  return d.unites.filter((u) => u.trim() && !evaluees.has(u));
}
