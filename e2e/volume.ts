import { decalerJours } from "../lib/calculs";
import { donneesDemo } from "../lib/demo";
import type { Donnees } from "../lib/types";

// Un très gros client, pour vérifier que Frisk DU reste fluide : les éléments de démonstration
// sont recopiés jusqu'au volume voulu (les copies pointent vers les salariés, articles et risques
// d'origine, qui restent présents).
const volumes = {
  duerp: 500,
  actions: 400,
  evenements: 150,
  formations: 600,
  equipements: 120,
  verifications: 400,
  produits: 150,
  salaries: 200,
  mouvements: 8000,
} as const;

export function donneesVolumineuses(aujourdhui: string): Donnees {
  const d = donneesDemo(aujourdhui);
  const unites = Array.from({ length: 25 }, (_, i) => `Unité ${i + 1}`);
  const copier = <T extends { id: string }>(liste: T[], total: number, transformer: (e: T, i: number) => Partial<T> = () => ({})) =>
    Array.from({ length: Math.max(total, liste.length) }, (_, i) => {
      const e = liste[i % liste.length];
      return i < liste.length ? e : { ...e, ...transformer(e, i), id: `${e.id}-${i}` };
    });
  return {
    ...d,
    unites: [...d.unites, ...unites],
    duerp: copier(d.duerp, volumes.duerp, (_, i) => ({ unite: unites[i % unites.length] })),
    actions: copier(d.actions, volumes.actions),
    evenements: copier(d.evenements, volumes.evenements, (_, i) => ({ date: decalerJours(aujourdhui, -(i % 700)) })),
    formations: copier(d.formations, volumes.formations),
    equipements: copier(d.equipements, volumes.equipements),
    verifications: copier(d.verifications, volumes.verifications),
    produits: copier(d.produits, volumes.produits),
    salaries: copier(d.salaries, volumes.salaries, (s, i) => ({ nom: `${s.nom} ${i}` })),
    mouvements: copier(d.mouvements, volumes.mouvements, (_, i) => ({ date: decalerJours(aujourdhui, -(i % 730)), signatureId: undefined })),
  };
}
