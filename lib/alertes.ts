// Points à traiter : calculés à partir des données de l'entreprise.
// Utilisé dans l'application (tableau de bord) et pour le récapitulatif hebdomadaire par e-mail.

import { actionEnRetard, calculerStocks, decalerJours, formaterDate, niveauDe, risqueResiduel } from "./calculs";
import type { Donnees } from "./types";

export type Alerte = {
  id: string;
  gravite: "critique" | "importante" | "info";
  categorie: "DUERP" | "EPI" | "Pénibilité";
  titre: string;
  detail: string;
  lien: string; // page de l'application où traiter l'alerte
};

const liste = (elements: string[], max = 3) =>
  elements.slice(0, max).join(", ") + (elements.length > max ? ` et ${elements.length - max} autre(s)` : "");

const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? "s" : ""}`;

// `derniereVersion` : date (AAAA-MM-JJ) de la dernière version figée, null s'il n'y en a aucune,
// undefined si l'information n'est pas disponible (on ne crée alors pas d'alerte de mise à jour).
export function calculerAlertes(donnees: Donnees, aujourdhui: string, derniereVersion?: string | null): Alerte[] {
  const alertes: Alerte[] = [];
  const risques = donnees.duerp;

  // Mise à jour annuelle du document unique
  if (derniereVersion === null && risques.length) {
    alertes.push({
      id: "version-aucune", gravite: "importante", categorie: "DUERP", lien: "/duerp",
      titre: "Aucune version du DUERP n'a été figée",
      detail: "Figez une version datée : c'est elle qui fait foi et qui doit être conservée 40 ans.",
    });
  } else if (derniereVersion) {
    const echeance = decalerJours(derniereVersion, 365);
    if (echeance < aujourdhui) {
      alertes.push({
        id: "version-depassee", gravite: "critique", categorie: "DUERP", lien: "/duerp",
        titre: "Mise à jour annuelle du DUERP dépassée",
        detail: `La dernière version date du ${formaterDate(derniereVersion)} ; la mise à jour était due le ${formaterDate(echeance)}.`,
      });
    } else if (echeance < decalerJours(aujourdhui, 60)) {
      alertes.push({
        id: "version-proche", gravite: "info", categorie: "DUERP", lien: "/duerp",
        titre: "Mise à jour annuelle du DUERP à prévoir",
        detail: `À faire avant le ${formaterDate(echeance)}.`,
      });
    }
  }

  // Actions de prévention
  const enRetard = risques.filter((l) => actionEnRetard(l, aujourdhui));
  if (enRetard.length) {
    alertes.push({
      id: "actions-retard", gravite: "critique", categorie: "DUERP", lien: "/duerp",
      titre: `${pluriel(enRetard.length, "action")} de prévention en retard`,
      detail: liste(enRetard.map((l) => `${l.action} (${formaterDate(l.echeance)})`)),
    });
  }
  const bientot = risques.filter(
    (l) => l.statut !== "fait" && l.echeance && l.echeance >= aujourdhui && l.echeance <= decalerJours(aujourdhui, 15),
  );
  if (bientot.length) {
    alertes.push({
      id: "actions-bientot", gravite: "importante", categorie: "DUERP", lien: "/duerp",
      titre: `${pluriel(bientot.length, "action")} à échéance dans les 15 jours`,
      detail: liste(bientot.map((l) => `${l.action} (${formaterDate(l.echeance)})`)),
    });
  }
  const critiquesSansAction = risques.filter(
    (l) => niveauDe(risqueResiduel(l)).code === "critique" && !l.action.trim() && l.statut !== "fait",
  );
  if (critiquesSansAction.length) {
    alertes.push({
      id: "critiques-sans-action", gravite: "critique", categorie: "DUERP", lien: "/duerp",
      titre: `${pluriel(critiquesSansAction.length, "risque")} critique${critiquesSansAction.length > 1 ? "s" : ""} sans action prévue`,
      detail: liste(critiquesSansAction.map((l) => `${l.danger || l.activite} (${l.unite})`)),
    });
  }

  // Stocks d'EPI
  const stocks = calculerStocks(donnees, aujourdhui);
  const ruptures = stocks.filter((s) => s.etat === "rupture");
  if (ruptures.length) {
    alertes.push({
      id: "stocks-rupture", gravite: "critique", categorie: "EPI", lien: "/epi",
      titre: `${pluriel(ruptures.length, "référence")} d'EPI en rupture`,
      detail: liste(ruptures.map((s) => `${s.article.nom} (${s.taille})`)),
    });
  }
  const sousTampon = stocks.filter((s) => s.etat === "sous-tampon");
  if (sousTampon.length) {
    alertes.push({
      id: "stocks-tampon", gravite: "importante", categorie: "EPI", lien: "/epi",
      titre: `${pluriel(sousTampon.length, "référence")} d'EPI sous le stock tampon`,
      detail: `À commander : ${liste(sousTampon.map((s) => `${s.aCommander} ${s.article.nom} (${s.taille})`))}`,
    });
  }
  const nonSignees = donnees.mouvements.filter(
    (m) => m.type === "sortie" && !m.signatureId && m.date >= decalerJours(aujourdhui, -90) && m.date <= decalerJours(aujourdhui, -7),
  );
  if (nonSignees.length) {
    const salaries = new Set(nonSignees.map((m) => m.salarieId)).size;
    alertes.push({
      id: "epi-non-signes", gravite: "info", categorie: "EPI", lien: "/epi",
      titre: `${pluriel(nonSignees.length, "remise")} d'EPI non signée${nonSignees.length > 1 ? "s" : ""}`,
      detail: `Sur les 3 derniers mois, pour ${pluriel(salaries, "salarié")}. À faire signer depuis « Fiches salariés ».`,
    });
  }

  // Pénibilité
  const aEvaluer = risques.filter((l) => l.penibilite && l.seuilPenibilite === "a-evaluer");
  if (aEvaluer.length) {
    alertes.push({
      id: "penibilite-a-evaluer", gravite: "info", categorie: "Pénibilité", lien: "/penibilite",
      titre: `${pluriel(aEvaluer.length, "exposition")} à la pénibilité à évaluer`,
      detail: liste(aEvaluer.map((l) => `${l.unite} : ${l.activite}`)),
    });
  }

  const ordre = { critique: 0, importante: 1, info: 2 };
  return alertes.sort((a, b) => ordre[a.gravite] - ordre[b.gravite]);
}
