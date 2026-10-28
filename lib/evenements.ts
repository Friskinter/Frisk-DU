// Accidents, presque-accidents et situations dangereuses : déclaration, analyse des causes,
// lien avec le risque du DUERP et indicateurs (taux de fréquence et de gravité).

import { decalerJours, nouvelId } from "./calculs";
import { grilleFrequence, grilleGravite } from "./referentiel";
import type { Action, Donnees, Evenement, LigneDuerp } from "./types";

// Durée annuelle légale du travail à temps plein, pour estimer les heures travaillées.
export const HEURES_PAR_SALARIE = 1607;

export function nouvelEvenement(champs: Partial<Evenement> = {}): Evenement {
  const type = champs.type ?? "accident-travail";
  return {
    id: nouvelId(),
    type,
    date: "",
    heure: "",
    lieu: "",
    unite: "",
    salarieId: "",
    victime: "",
    temoins: "",
    description: "",
    lesions: "",
    soins: estAccident({ type }) ? "premiers-soins" : "aucun",
    joursArret: 0,
    secouriste: "",
    declaration: estAccident({ type }) ? "a-faire" : "non-requise",
    declareeLe: "",
    gravitePotentielle: 0,
    pourquoi: [],
    facteurs: { individu: "", tache: "", materiel: "", milieu: "" },
    enseignements: "",
    analyseeLe: "",
    analysePar: "",
    risqueId: "",
    reevalueLe: "",
    ...champs,
  };
}

export function estAccident(e: Pick<Evenement, "type">) {
  return e.type === "accident-travail" || e.type === "accident-trajet";
}

// Accident du travail avec arrêt : base du taux de fréquence (les accidents de trajet n'y entrent pas).
export function estAccidentAvecArret(e: Evenement) {
  return e.type === "accident-travail" && e.soins === "arret";
}

// Sans arrêt ni soins médicaux, l'accident peut être inscrit au registre des accidents bénins
// au lieu d'être déclaré à la CPAM (articles L441-4 et R441-3 du Code de la sécurité sociale).
export function peutAllerAuRegistre(e: Pick<Evenement, "type" | "soins">) {
  return e.type === "accident-travail" && (e.soins === "aucun" || e.soins === "premiers-soins");
}

// Gravité constatée, sur l'échelle de la grille de cotation (0 : aucune lésion).
export function graviteConstatee(e: Evenement) {
  if (!estAccident(e)) return 0;
  switch (e.soins) {
    case "premiers-soins":
      return 1;
    case "soins-medicaux":
      return 2;
    case "arret":
      return e.joursArret >= 8 ? 3 : 2;
  }
  return 0;
}

// La déclaration est due dans les 48 heures, dimanches non compris (article R441-3).
// Les jours fériés ne sont pas décomptés ici : l'échéance indiquée est la plus prudente.
export function echeanceDeclaration(e: Pick<Evenement, "date">) {
  if (!e.date) return "";
  let date = e.date;
  let jours = 0;
  while (jours < 2) {
    date = decalerJours(date, 1);
    if (new Date(`${date}T12:00:00`).getDay() !== 0) jours++;
  }
  return date;
}

export function declarationEnRetard(e: Evenement, aujourdhui: string) {
  return e.declaration === "a-faire" && !!e.date && echeanceDeclaration(e) < aujourdhui;
}

export function analyseFaite(e: Evenement) {
  return !!e.analyseeLe;
}

export function actionsDeLEvenement(actions: Action[], e: Evenement) {
  return actions.filter((a) => a.evenementId === e.id);
}

export type Etapes = { declaration: boolean; analyse: boolean; risque: boolean; actions: boolean };

// Avancement du traitement d'un événement ; il est clos quand toutes les étapes sont faites.
export function etapes(e: Evenement, actions: Action[]): Etapes {
  const liees = actionsDeLEvenement(actions, e);
  return {
    declaration: e.declaration !== "a-faire",
    analyse: analyseFaite(e),
    risque: !!e.risqueId && !!e.reevalueLe,
    actions: liees.every((a) => a.statut === "fait"),
  };
}

export function estClos(e: Evenement, actions: Action[]) {
  return Object.values(etapes(e, actions)).every(Boolean);
}

// Événements des 12 derniers mois portant sur le même risque.
export function evenementsDuRisque(evenements: Evenement[], risqueId: string, aujourdhui: string) {
  const debut = decalerJours(aujourdhui, -365);
  return evenements.filter((e) => e.risqueId === risqueId && e.date >= debut && e.date <= aujourdhui);
}

// Ce que l'événement révèle sur la cotation du risque dans le DUERP (article R4121-2 : le document
// est mis à jour lorsqu'une information supplémentaire sur un risque est recueillie).
export function ecartsCotation(e: Evenement, risque: LigneDuerp, evenements: Evenement[], aujourdhui: string): string[] {
  const ecarts: string[] = [];
  const gravite = Math.max(graviteConstatee(e), e.gravitePotentielle);
  if (gravite > risque.gravite) {
    const libelle = (v: number) => grilleGravite.find((g) => g.valeur === v)?.libelle.toLowerCase() ?? "";
    ecarts.push(
      `Gravité cotée ${risque.gravite} (${libelle(risque.gravite)}) alors que l'événement montre une gravité ${gravite} (${libelle(gravite)}).`,
    );
  }
  const nombre = evenementsDuRisque(evenements, risque.id, aujourdhui).length;
  if (nombre >= 2 && risque.frequence <= 2) {
    const libelle = grilleFrequence.find((f) => f.valeur === risque.frequence)?.libelle.toLowerCase() ?? "";
    ecarts.push(`${nombre} événements en 12 mois sur ce risque, coté en fréquence « ${libelle} » : la fréquence est peut-être sous-estimée.`);
  }
  if (estAccident(e) && e.soins !== "aucun" && (risque.maitrise === "bonne" || risque.maitrise === "tres-bonne")) {
    ecarts.push("Maîtrise jugée bonne, mais l'accident montre que les mesures existantes n'ont pas suffi.");
  }
  return ecarts;
}

// Heures travaillées sur 12 mois : saisies dans la fiche entreprise, sinon estimées à partir de l'effectif.
export function heuresTravaillees(donnees: Pick<Donnees, "fiche">): { heures: number; estimation: boolean } | null {
  const saisies = parseInt((donnees.fiche?.heures ?? "").replace(/\s/g, ""), 10);
  if (Number.isFinite(saisies) && saisies > 0) return { heures: saisies, estimation: false };
  const effectif = parseInt((donnees.fiche?.effectif ?? "").replace(/\s/g, ""), 10);
  if (Number.isFinite(effectif) && effectif > 0) return { heures: effectif * HEURES_PAR_SALARIE, estimation: true };
  return null;
}

export type Indicateurs = {
  accidentsAvecArret: number;
  joursArret: number;
  tauxFrequence: number | null; // accidents avec arrêt par million d'heures travaillées
  tauxGravite: number | null; // jours d'arrêt pour mille heures travaillées
  heuresEstimees: boolean;
  presqueAccidents: number; // presque-accidents et situations dangereuses
  joursSansAccident: number | null; // depuis le dernier accident du travail avec arrêt
};

// Indicateurs sur les 12 derniers mois.
export function calculerIndicateurs(donnees: Pick<Donnees, "fiche" | "evenements">, aujourdhui: string): Indicateurs {
  const debut = decalerJours(aujourdhui, -365);
  const periode = donnees.evenements.filter((e) => e.date && e.date > debut && e.date <= aujourdhui);
  const avecArret = periode.filter(estAccidentAvecArret);
  const joursArret = avecArret.reduce((t, e) => t + (e.joursArret || 0), 0);
  const heures = heuresTravaillees(donnees);
  const dernier = donnees.evenements
    .filter((e) => estAccidentAvecArret(e) && e.date && e.date <= aujourdhui)
    .map((e) => e.date)
    .sort()
    .at(-1);
  return {
    accidentsAvecArret: avecArret.length,
    joursArret,
    tauxFrequence: heures ? (avecArret.length * 1_000_000) / heures.heures : null,
    tauxGravite: heures ? (joursArret * 1000) / heures.heures : null,
    heuresEstimees: heures?.estimation ?? false,
    presqueAccidents: periode.filter((e) => !estAccident(e)).length,
    joursSansAccident: dernier
      ? Math.round((new Date(`${aujourdhui}T12:00:00`).getTime() - new Date(`${dernier}T12:00:00`).getTime()) / 86_400_000)
      : null,
  };
}

// Personne concernée, telle qu'affichée (registre, liste).
export function nomVictime(e: Evenement, donnees: Pick<Donnees, "salaries">) {
  if (e.salarieId === "externe") return e.victime;
  return donnees.salaries.find((s) => s.id === e.salarieId)?.nom ?? "";
}
