// Alertes « nouvelles » : celles qu'une personne n'avait pas encore vues lors de sa dernière visite du
// tableau de bord (table alertes_vues, migration 021). Chaque alerte est résumée par une empreinte :
// son identifiant et ses éléments (ou, à défaut, son titre et son détail). Une alerte dont le contenu
// change (un nouvel élément, un nombre différent) redevient nouvelle.

import type { Alerte } from "./alertes";

// Empreinte courte (FNV-1a 32 bits) : la liste des éléments peut être longue.
function hacher(texte: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < texte.length; i++) {
    h ^= texte.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

export function empreinte(a: Alerte) {
  const contenu = a.elements?.length ? [...a.elements].sort().join("|") : `${a.titre}|${a.detail}`;
  return `${a.id}:${hacher(contenu)}`;
}

// `vues` : empreintes de la dernière visite ; null pour une première visite (rien n'est alors
// présenté comme nouveau, pour ne pas tout marquer d'un coup).
export function alertesNouvelles(alertes: Alerte[], vues: Set<string> | null): Set<string> {
  if (!vues) return new Set();
  return new Set(alertes.filter((a) => !vues.has(empreinte(a))).map((a) => a.id));
}

export const VISITE = "__visite__";

// Lignes lues dans la table : null si la personne n'a jamais visité le tableau de bord.
export function vuesDepuis(lignes: { empreinte: string }[]): Set<string> | null {
  if (!lignes.some((l) => l.empreinte === VISITE)) return null;
  return new Set(lignes.map((l) => l.empreinte).filter((e) => e !== VISITE));
}
