// Fiche d'un salarié : tout ce qui le concerne, réuni depuis les différents modules (formations, EPI,
// accueil, causeries, accidents, produits chimiques, risques de son unité de travail).

import { etatAccueil, type EtatAccueil } from "./accueils";
import { decalerJours, risqueResiduel } from "./calculs";
import { etatFormation, exigencesDuPoste, formationsEnVigueur, libelleFormation, typeFormation, type EtatFormation } from "./formations";
import type { Accueil, Causerie, Donnees, Evenement, Formation, LigneDuerp, Mouvement, Produit, Salarie } from "./types";

export type FicheSalarie = {
  salarie: Salarie;
  formations: { formation: Formation; etat: EtatFormation }[]; // formations en vigueur
  manquantes: { type: string; expiree: boolean }[]; // exigées pour son poste
  remises: { mouvement: Mouvement; article: string; signee: boolean }[]; // EPI remis, du plus récent au plus ancien
  accueil: { accueil: Accueil; etat: EtatAccueil } | null; // le plus récent
  causeries: Causerie[]; // auxquelles il a participé, de la plus récente à la plus ancienne
  evenements: Evenement[]; // accidents et presque-accidents dont il est la victime
  produits: Produit[]; // produits chimiques auxquels il est exposé
  unite: string; // unité de travail connue par son accueil, "" sinon
  risques: LigneDuerp[]; // risques de son unité, du plus élevé au plus faible
  penibilite: LigneDuerp[]; // parmi eux, ceux dont le seuil de pénibilité est dépassé
  pointsAttention: string[];
};

const parDateDecroissante = <T,>(date: (x: T) => string) => (a: T, b: T) => date(b).localeCompare(date(a));

export function ficheSalarie(d: Donnees, salarieId: string, aujourdhui: string): FicheSalarie | null {
  const salarie = d.salaries.find((s) => s.id === salarieId);
  if (!salarie) return null;

  const formations = formationsEnVigueur(d.formations.filter((f) => f.salarieId === salarieId))
    .sort(parDateDecroissante((f) => f.obtenueLe))
    .map((formation) => ({ formation, etat: etatFormation(formation, aujourdhui) }));
  const manquantes = exigencesDuPoste(d.exigences, salarie.poste).flatMap((e) => {
    const f = formations.find((x) => x.formation.type === e.type);
    if (f && f.etat !== "expiree") return [];
    return [{ type: e.type, expiree: !!f }];
  });

  const remises = d.mouvements
    .filter((m) => m.type === "sortie" && m.salarieId === salarieId)
    .sort(parDateDecroissante((m) => m.date))
    .map((mouvement) => ({
      mouvement,
      article: d.articles.find((a) => a.id === mouvement.articleId)?.nom ?? "Article supprimé",
      signee: !!(mouvement.signatureId && d.signatures?.[mouvement.signatureId]),
    }));

  const dernierAccueil = d.accueils
    .filter((a) => a.salarieId === salarieId)
    .sort(parDateDecroissante((a) => a.accueilLe || a.arriveeLe))[0];
  const accueil = dernierAccueil ? { accueil: dernierAccueil, etat: etatAccueil(dernierAccueil, d.signatures, aujourdhui) } : null;

  const causeries = d.causeries.filter((c) => c.participants.some((p) => p.salarieId === salarieId)).sort(parDateDecroissante((c) => c.date));
  const evenements = d.evenements.filter((e) => e.salarieId === salarieId).sort(parDateDecroissante((e) => e.date));
  const produits = d.produits.filter((p) => p.actif && p.salariesExposes.includes(salarieId));

  const unite = dernierAccueil?.unite ?? "";
  const risques = unite ? d.duerp.filter((l) => l.unite === unite).sort((a, b) => risqueResiduel(b) - risqueResiduel(a)) : [];
  const penibilite = risques.filter((l) => l.penibilite && l.seuilPenibilite === "oui");

  const pointsAttention: string[] = [];
  for (const m of manquantes) {
    pointsAttention.push(`${typeFormation(m.type).libelle} : ${m.expiree ? "expirée" : "manquante"} (exigée pour son poste)`);
  }
  for (const { formation } of formations.filter((f) => f.etat === "a-renouveler")) {
    pointsAttention.push(`${libelleFormation(formation)} : à renouveler`);
  }
  const nonSignees = remises.filter((r) => !r.signee).length;
  if (nonSignees) pointsAttention.push(`${nonSignees} remise${nonSignees > 1 ? "s" : ""} d'EPI à faire signer`);
  if (accueil?.etat === "a-faire") pointsAttention.push("Accueil sécurité à faire");
  if (accueil?.etat === "a-signer") pointsAttention.push("Fiche d'accueil à faire signer");
  if (!causeries.some((c) => c.date >= decalerJours(aujourdhui, -365))) pointsAttention.push("Aucune causerie depuis un an");

  return { salarie, formations, manquantes, remises, accueil, causeries, evenements, produits, unite, risques, penibilite, pointsAttention };
}
