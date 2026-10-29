// Rapport annuel santé, sécurité et conditions de travail, à présenter au CSE.
// Entreprises d'au moins 50 salariés : rapport annuel écrit et programme annuel de prévention
// (art. L2312-27 du Code du travail) ; en dessous, c'est un bilan utile à partager avec l'équipe.
// Tout est calculé à partir des données de l'espace, pour l'année civile choisie.

import { actionEnRetard, estPapripact } from "./actions";
import { niveauDe, risqueResiduel } from "./calculs";
import { estAccident, estAccidentAvecArret, heuresTravaillees } from "./evenements";
import { etatFormation, formationsEnVigueur, formationsManquantes, libelleFormation } from "./formations";
import { estCmr, etatFds } from "./produits";
import { niveauxCriticite, principesPrevention, typesEvenement } from "./referentiel";
import type { Action, Donnees, Evenement } from "./types";
import { bilanVisite, nonConformitesOuvertes } from "./visites";
import { observationLevee, observationsOuvertes } from "./verifications";

const dansAnnee = (date: string | undefined, annee: number) => !!date && date.startsWith(`${annee}-`);

// Années pour lesquelles l'espace contient des données datées, la plus récente d'abord.
export function anneesDisponibles(d: Donnees, aujourdhui: string): number[] {
  const dates = [
    ...d.evenements.map((e) => e.date),
    ...d.actions.flatMap((a) => [a.realiseeLe, a.echeance]),
    ...d.formations.map((f) => f.obtenueLe),
    ...d.verifications.map((v) => v.date),
    ...(d.visites ?? []).map((v) => v.date),
    ...(d.causeries ?? []).map((c) => c.date),
    ...(d.accueils ?? []).map((a) => a.accueilLe),
    aujourdhui,
  ];
  const annees = new Set(dates.filter((x) => /^\d{4}-/.test(x ?? "")).map((x) => Number(x!.slice(0, 4))));
  return [...annees].filter((a) => a <= Number(aujourdhui.slice(0, 4))).sort((a, b) => b - a);
}

function bilanAccidents(d: Donnees, annee: number) {
  const evenements = d.evenements.filter((e) => dansAnnee(e.date, annee));
  const avecArret = evenements.filter(estAccidentAvecArret);
  const joursArret = avecArret.reduce((t, e) => t + (e.joursArret || 0), 0);
  const heures = heuresTravaillees(d);
  return {
    evenements,
    accidentsTravail: evenements.filter((e) => e.type === "accident-travail").length,
    avecArret: avecArret.length,
    sansArret: evenements.filter((e) => e.type === "accident-travail" && e.soins !== "arret").length,
    trajet: evenements.filter((e) => e.type === "accident-trajet").length,
    joursArret,
    presqueAccidents: evenements.filter((e) => !estAccident(e)).length,
    signalesTerrain: evenements.filter((e) => e.signalement).length,
    analyses: evenements.filter((e) => e.analyseeLe).length,
    tauxFrequence: heures ? (avecArret.length * 1_000_000) / heures.heures : null,
    tauxGravite: heures ? (joursArret * 1000) / heures.heures : null,
    heuresEstimees: heures?.estimation ?? false,
  };
}

const libelleType = (e: Evenement) => typesEvenement.find((t) => t.valeur === e.type)?.libelle ?? "";

export function calculerRapport(d: Donnees, annee: number, aujourdhui: string) {
  const fin = `${annee}-12-31`;
  // Pour l'année en cours, la situation est celle du jour ; pour une année passée, celle du 31 décembre.
  const reference = fin < aujourdhui ? fin : aujourdhui;
  const accidents = bilanAccidents(d, annee);
  const precedent = bilanAccidents(d, annee - 1);

  const realisees = d.actions.filter((a) => a.statut === "fait" && dansAnnee(a.realiseeLe, annee));
  const enCours = d.actions.filter((a) => a.statut !== "fait");
  const parPrincipe = principesPrevention
    .map((p) => ({ libelle: p.libelle, nombre: realisees.filter((a) => a.principe === p.valeur).length }))
    .filter((p) => p.nombre > 0);
  const programme = enCours
    .filter((a) => !a.echeance || a.echeance <= `${annee + 1}-12-31`)
    .sort((a, b) => (a.echeance || "9999").localeCompare(b.echeance || "9999"));

  const formations = d.formations.filter((f) => dansAnnee(f.obtenueLe, annee));
  const parFormation = [...new Set(formations.map((f) => libelleFormation(f)))]
    .map((libelle) => ({ libelle, nombre: formations.filter((f) => libelleFormation(f) === libelle).length }))
    .sort((a, b) => b.nombre - a.nombre);
  const enVigueur = formationsEnVigueur(d.formations).filter((f) => d.salaries.some((s) => s.id === f.salarieId));

  const verifications = d.verifications.filter((v) => dansAnnee(v.date, annee));
  const observations = verifications.flatMap((v) => v.observations.filter((o) => o.texte.trim()));

  const visites = (d.visites ?? []).filter((v) => dansAnnee(v.date, annee));
  const taux = visites.map((v) => bilanVisite(v).taux).filter((t): t is number => t !== null);
  const causeries = (d.causeries ?? []).filter((c) => dansAnnee(c.date, annee));
  const accueils = (d.accueils ?? []).filter((a) => dansAnnee(a.accueilLe, annee));

  const interventions = (d.interventions ?? []).filter((i) => i.debut && i.debut <= fin && (!i.fin || i.fin >= `${annee}-01-01`));
  const protocoles = (d.protocoles ?? []).filter((p) => p.debut && p.debut <= fin && (!p.fin || p.fin >= `${annee}-01-01`));

  const produits = d.produits.filter((p) => p.actif);
  const remises = d.mouvements.filter((m) => m.type === "sortie" && dansAnnee(m.date, annee));
  const prix = new Map(d.articles.map((a) => [a.id, a.prix]));

  return {
    annee,
    reference,
    papripact: estPapripact(d),
    entreprise: { nom: d.entreprise, effectif: d.fiche?.effectif ?? "", salaries: d.salaries.length, heures: heuresTravaillees(d) },
    accidents: {
      ...accidents,
      precedent: { avecArret: precedent.avecArret, joursArret: precedent.joursArret, presqueAccidents: precedent.presqueAccidents, tauxFrequence: precedent.tauxFrequence },
      liste: accidents.evenements
        .filter(estAccident)
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((e) => ({ date: e.date, type: libelleType(e), lieu: e.unite || e.lieu, circonstances: e.description, joursArret: e.soins === "arret" ? e.joursArret : 0 })),
    },
    duerp: {
      risques: d.duerp.length,
      parNiveau: niveauxCriticite.map((n) => ({ ...n, nombre: d.duerp.filter((l) => niveauDe(risqueResiduel(l)).code === n.code).length })),
    },
    actions: {
      realisees: realisees.length,
      budgetRealise: realisees.reduce((t, a) => t + (a.cout ?? 0), 0),
      parPrincipe,
      enCours: enCours.length,
      enRetard: enCours.filter((a) => actionEnRetard(a, reference)).length,
      programme,
      budgetProgramme: programme.reduce((t, a) => t + (a.cout ?? 0), 0),
    },
    formations: {
      sessions: formations.length,
      salariesFormes: new Set(formations.map((f) => f.salarieId)).size,
      parFormation,
      manquantes: formationsManquantes(d, reference).length,
      expirees: enVigueur.filter((f) => etatFormation(f, reference) === "expiree").length,
    },
    verifications: {
      realisees: verifications.length,
      nonConformes: verifications.filter((v) => v.resultat === "non-conforme").length,
      observations: observations.length,
      observationsLevees: observations.filter((o) => observationLevee(o, d.actions)).length,
      observationsOuvertes: observationsOuvertes(d.equipements, d.verifications, d.actions).length,
    },
    terrain: {
      visites: visites.length,
      conformiteMoyenne: taux.length ? Math.round(taux.reduce((t, x) => t + x, 0) / taux.length) : null,
      nonConformites: visites.reduce((t, v) => t + bilanVisite(v).nonConformes, 0),
      nonConformitesOuvertes: nonConformitesOuvertes(visites, d.actions).length,
      causeries: causeries.length,
      participations: causeries.reduce((t, c) => t + c.participants.length, 0),
      themes: causeries.map((c) => c.theme).filter(Boolean),
      accueils: accueils.length,
      accueilsRenforces: accueils.filter((a) => a.posteARisque && (a.contrat === "cdd" || a.contrat === "interim")).length,
    },
    exterieures: { plans: interventions.length, protocoles: protocoles.length },
    chimie: {
      produits: produits.length,
      cmr: produits.filter(estCmr).length,
      fdsManquantes: produits.filter((p) => etatFds(p, reference) === "manquante").length,
    },
    epi: {
      remises: remises.reduce((t, m) => t + m.quantite, 0),
      cout: remises.reduce((t, m) => t + m.quantite * (prix.get(m.articleId) ?? 0), 0),
    },
  };
}

export type Rapport = ReturnType<typeof calculerRapport>;

// Évolution par rapport à l'année précédente, en toutes lettres.
export function evolution(actuel: number, precedent: number) {
  if (actuel === precedent) return "stable";
  return actuel > precedent ? `+${actuel - precedent}` : `${actuel - precedent}`;
}

export function actionLibelle(a: Action, d: Pick<Donnees, "duerp">) {
  const risque = d.duerp.find((l) => l.id === a.risqueId);
  return { intitule: a.intitule || "Action sans intitulé", risque: risque ? [risque.unite, risque.danger || risque.activite].filter(Boolean).join(" · ") : "" };
}
