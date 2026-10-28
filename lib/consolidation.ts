// Vue d'ensemble d'un groupe : indicateurs de chaque établissement et totaux.

import { actionEnRetard } from "./actions";
import { calculerAlertes } from "./alertes";
import { niveauDe, risqueResiduel } from "./calculs";
import { normaliser } from "./donnees";
import { calculerIndicateurs, heuresTravaillees } from "./evenements";
import { etatFormation, formationsEnVigueur, formationsManquantes } from "./formations";
import { estCmr, etatFds } from "./produits";
import type { Donnees, LigneDuerp } from "./types";
import { etatEquipement, observationsOuvertes } from "./verifications";

export type IndicateursSite = {
  risques: number;
  prioritaires: number; // résiduel important ou critique
  critiques: number;
  actions: number;
  actionsFaites: number;
  actionsRetard: number;
  accidentsArret: number; // 12 derniers mois
  joursArret: number;
  heures: number | null;
  presqueAccidents: number;
  formationsManquantes: number;
  formationsExpirees: number;
  verificationsRetard: number; // en retard ou jamais vérifiées
  observations: number;
  cmr: number;
  fdsManquantes: number;
  alertesUrgentes: number;
  alertes: number;
  derniereVersion: string | null; // date de la dernière version figée du DUERP
};

export function indicateursSite(contenu: Donnees, aujourdhui: string, derniereVersion: string | null | undefined): IndicateursSite {
  const d = normaliser(contenu);
  const niveau = (l: LigneDuerp) => niveauDe(risqueResiduel(l)).code;
  const accidents = calculerIndicateurs(d, aujourdhui);
  const salaries = new Set(d.salaries.map((s) => s.id));
  const enVigueur = formationsEnVigueur(d.formations).filter((f) => salaries.has(f.salarieId));
  const alertes = calculerAlertes(d, aujourdhui, derniereVersion);
  const produits = d.produits.filter((p) => p.actif);
  return {
    risques: d.duerp.length,
    prioritaires: d.duerp.filter((l) => niveau(l) === "important" || niveau(l) === "critique").length,
    critiques: d.duerp.filter((l) => niveau(l) === "critique").length,
    actions: d.actions.length,
    actionsFaites: d.actions.filter((a) => a.statut === "fait").length,
    actionsRetard: d.actions.filter((a) => actionEnRetard(a, aujourdhui)).length,
    accidentsArret: accidents.accidentsAvecArret,
    joursArret: accidents.joursArret,
    heures: heuresTravaillees(d)?.heures ?? null,
    presqueAccidents: accidents.presqueAccidents,
    formationsManquantes: formationsManquantes(d, aujourdhui).length,
    formationsExpirees: enVigueur.filter((f) => etatFormation(f, aujourdhui) === "expiree").length,
    verificationsRetard: d.equipements.filter((e) => ["en-retard", "jamais"].includes(etatEquipement(d.verifications, e, aujourdhui))).length,
    observations: observationsOuvertes(d.equipements, d.verifications, d.actions).length,
    cmr: produits.filter(estCmr).length,
    fdsManquantes: produits.filter((p) => etatFds(p, aujourdhui) === "manquante").length,
    alertesUrgentes: alertes.filter((a) => a.gravite === "critique").length,
    alertes: alertes.length,
    derniereVersion: derniereVersion ?? null,
  };
}

export type Totaux = Omit<IndicateursSite, "heures" | "derniereVersion"> & {
  heures: number;
  sitesSansHeures: number;
  tauxFrequence: number | null;
  tauxGravite: number | null;
};

// Sommes du groupe ; les taux sont calculés sur les sites dont les heures sont connues.
export function totaliser(sites: IndicateursSite[]): Totaux {
  const somme = (cle: keyof Omit<IndicateursSite, "heures" | "derniereVersion">) => sites.reduce((t, s) => t + s[cle], 0);
  const avecHeures = sites.filter((s) => s.heures);
  const heures = avecHeures.reduce((t, s) => t + (s.heures ?? 0), 0);
  return {
    risques: somme("risques"),
    prioritaires: somme("prioritaires"),
    critiques: somme("critiques"),
    actions: somme("actions"),
    actionsFaites: somme("actionsFaites"),
    actionsRetard: somme("actionsRetard"),
    accidentsArret: somme("accidentsArret"),
    joursArret: somme("joursArret"),
    presqueAccidents: somme("presqueAccidents"),
    formationsManquantes: somme("formationsManquantes"),
    formationsExpirees: somme("formationsExpirees"),
    verificationsRetard: somme("verificationsRetard"),
    observations: somme("observations"),
    cmr: somme("cmr"),
    fdsManquantes: somme("fdsManquantes"),
    alertesUrgentes: somme("alertesUrgentes"),
    alertes: somme("alertes"),
    heures,
    sitesSansHeures: sites.length - avecHeures.length,
    tauxFrequence: heures ? (avecHeures.reduce((t, s) => t + s.accidentsArret, 0) * 1_000_000) / heures : null,
    tauxGravite: heures ? (avecHeures.reduce((t, s) => t + s.joursArret, 0) * 1000) / heures : null,
  };
}

// Risques les plus élevés de tous les établissements.
export function risquesPrioritaires(sites: { id: string; nom: string; contenu: Donnees }[], nombre = 10) {
  return sites
    .flatMap((s) => s.contenu.duerp.map((ligne) => ({ site: s, ligne, score: risqueResiduel(ligne) })))
    .filter((r) => r.score >= 8)
    .sort((a, b) => b.score - a.score)
    .slice(0, nombre);
}
