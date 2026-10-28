// Mise en forme lisible des entrées du journal des modifications.

import { formaterDate } from "./calculs";
import { libelleFormation, typesFormation } from "./formations";
import {
  declarations,
  efficacites,
  facteursAnalyse,
  facteursPenibilite,
  grilleFrequence,
  grilleGravite,
  grilleMaitrise,
  niveauxSoins,
  principesPrevention,
  seuilsPenibilite,
  statutsAction,
  typesEvenement,
} from "./referentiel";
import type { Donnees } from "./types";

export type EntreeJournal = {
  id: number;
  created_at: string;
  auteur: string;
  collection: string;
  element_id: string;
  action: "ajout" | "modification" | "suppression";
  avant: Record<string, unknown> | unknown[] | string | null;
  apres: Record<string, unknown> | unknown[] | string | null;
};

export const zones: Record<string, string> = {
  duerp: "DUERP",
  actions: "Plan d'actions",
  evenements: "Accidents",
  formations: "Formations",
  exigences: "Formations exigées",
  salaries: "Salariés",
  articles: "Catalogue EPI",
  mouvements: "Mouvements d'EPI",
  signatures: "Signatures",
  entreprise: "Réglages",
};

const champsDuerp: Record<string, string> = {
  unite: "Unité de travail",
  activite: "Activité",
  danger: "Danger",
  risque: "Risque",
  effectif: "Effectif",
  gravite: "Gravité",
  frequence: "Fréquence",
  mesures: "Mesures existantes",
  maitrise: "Maîtrise",
  penibilite: "Pénibilité",
  seuilPenibilite: "Seuil de pénibilité",
  action: "Action",
  responsable: "Responsable",
  echeance: "Échéance",
  statut: "Statut",
};

const champsActions: Record<string, string> = {
  intitule: "Intitulé",
  principe: "Type de mesure",
  cout: "Coût estimé",
  ressources: "Ressources",
  indicateur: "Indicateur",
  realiseeLe: "Réalisée le",
  efficacite: "Efficacité",
  commentaire: "Constat d'efficacité",
  risqueId: "Risque",
  evenementId: "Événement à l'origine",
};

const champsEvenements: Record<string, string> = {
  type: "Type d'événement",
  heure: "Heure",
  lieu: "Lieu",
  salarieId: "Personne concernée",
  victime: "Personne extérieure",
  temoins: "Témoins",
  description: "Circonstances",
  lesions: "Lésions",
  soins: "Conséquences",
  joursArret: "Jours d'arrêt",
  secouriste: "Premiers soins donnés par",
  declaration: "Déclaration",
  declareeLe: "Déclarée le",
  gravitePotentielle: "Gravité potentielle",
  pourquoi: "5 pourquoi",
  facteurs: "Faits (individu, tâche, matériel, milieu)",
  enseignements: "Cause principale et enseignements",
  analyseeLe: "Analysé le",
  analysePar: "Analysé par",
  reevalueLe: "Cotation revue le",
};

const champsFormations: Record<string, string> = {
  obtenueLe: "Obtenue le",
  expireLe: "Expire le",
  organisme: "Organisme",
  attestation: "Attestation",
  actionId: "Action du plan",
};

const champsAutres: Record<string, string> = {
  nom: "Nom",
  service: "Service",
  poste: "Poste",
  tailles: "Tailles",
  categorie: "Catégorie",
  prix: "Prix",
  delai: "Délai de livraison",
  lot: "Conditionnement",
  tampons: "Stocks tampons",
  date: "Date",
  quantite: "Quantité",
  taille: "Taille",
  motif: "Motif",
  signatureId: "Signature",
};

const clesRacine: Record<string, string> = {
  entreprise: "Raison sociale",
  fiche: "Fiche entreprise",
  services: "Services",
  unites: "Unités de travail",
  preferences: "Préférences",
};

export function libelleChamp(champ: string) {
  return champsDuerp[champ] ?? champsActions[champ] ?? champsEvenements[champ] ?? champsFormations[champ] ?? champsAutres[champ] ?? champ;
}

export function valeurLisible(champ: string, valeur: unknown): string {
  if (valeur === null || valeur === undefined || valeur === "") return "(vide)";
  switch (champ) {
    case "gravite":
      return `${valeur} – ${grilleGravite.find((g) => g.valeur === valeur)?.libelle ?? ""}`;
    case "frequence":
      return `${valeur} – ${grilleFrequence.find((f) => f.valeur === valeur)?.libelle ?? ""}`;
    case "maitrise":
      return grilleMaitrise.find((m) => m.valeur === valeur)?.libelle ?? String(valeur);
    case "statut":
      return statutsAction.find((s) => s.valeur === valeur)?.libelle ?? String(valeur);
    case "penibilite":
      return facteursPenibilite.find((f) => f.code === valeur)?.libelle ?? String(valeur);
    case "seuilPenibilite":
      return seuilsPenibilite.find((s) => s.valeur === valeur)?.libelle ?? String(valeur);
    case "principe":
      return principesPrevention.find((p) => p.valeur === valeur)?.libelle ?? String(valeur);
    case "efficacite":
      return efficacites.find((e) => e.valeur === valeur)?.libelle ?? String(valeur);
    case "type":
      return (
        typesEvenement.find((t) => t.valeur === valeur)?.libelle ??
        typesFormation.find((t) => t.code === valeur)?.libelle ??
        String(valeur)
      );
    case "attestation":
      return (valeur as { nom?: string }).nom ?? "fichier joint";
    case "actionId":
      return "liée";
    case "soins":
      return niveauxSoins.find((n) => n.valeur === valeur)?.libelle ?? String(valeur);
    case "declaration":
      return declarations.find((x) => x.valeur === valeur)?.libelle ?? String(valeur);
    case "gravitePotentielle":
      return valeur === 0 ? "(non évaluée)" : `${valeur} – ${grilleGravite.find((g) => g.valeur === valeur)?.libelle ?? ""}`;
    case "facteurs":
      return (
        facteursAnalyse
          .filter((f) => (valeur as Record<string, string>)[f.cle])
          .map((f) => `${f.libelle} : ${(valeur as Record<string, string>)[f.cle]}`)
          .join(" · ") || "(vide)"
      );
    case "pourquoi":
      return (valeur as string[]).filter(Boolean).map((p, i) => `${i + 1}. ${p}`).join(" ") || "(vide)";
    case "salarieId":
      return valeur === "externe" ? "personne extérieure à l'entreprise" : "salarié de l'entreprise";
    case "cout":
      return `${valeur} € HT`;
    case "echeance":
    case "realiseeLe":
    case "obtenueLe":
    case "expireLe":
    case "declareeLe":
    case "analyseeLe":
    case "reevalueLe":
    case "date":
      return formaterDate(String(valeur));
    case "signatureId":
      return "signée";
  }
  if (Array.isArray(valeur)) return valeur.join(", ") || "(vide)";
  if (typeof valeur === "object") {
    return Object.entries(valeur as Record<string, unknown>)
      .filter(([, v]) => v !== "" && v !== null && v !== undefined)
      .map(([k, v]) => `${libelleChamp(k)} : ${typeof v === "object" ? JSON.stringify(v) : v}`)
      .join(" · ") || "(vide)";
  }
  return String(valeur);
}

// Nom de l'élément concerné, d'après les données actuelles ou, s'il a été supprimé, d'après le journal.
export function libelleElement(e: EntreeJournal, donnees: Donnees): string {
  const source = ((e.apres && typeof e.apres === "object" && !Array.isArray(e.apres) ? e.apres : null) ??
    (e.avant && typeof e.avant === "object" && !Array.isArray(e.avant) ? e.avant : null) ??
    {}) as Record<string, unknown>;
  const article = (id: unknown) => donnees.articles.find((a) => a.id === id)?.nom ?? "article";
  const salarie = (id: unknown) => donnees.salaries.find((s) => s.id === id)?.nom ?? "";

  switch (e.collection) {
    case "duerp": {
      const l = { ...source, ...(donnees.duerp.find((x) => x.id === e.element_id) ?? {}) } as Record<string, unknown>;
      return [l.danger || l.activite || "Ligne", l.unite].filter(Boolean).join(" — ");
    }
    case "actions": {
      const a = { ...source, ...(donnees.actions?.find((x) => x.id === e.element_id) ?? {}) } as Record<string, unknown>;
      return String(a.intitule || "Action sans intitulé");
    }
    case "evenements": {
      const ev = { ...source, ...(donnees.evenements?.find((x) => x.id === e.element_id) ?? {}) } as Record<string, unknown>;
      const type = typesEvenement.find((t) => t.valeur === ev.type)?.libelle ?? "Événement";
      return [type, ev.date ? `du ${formaterDate(String(ev.date))}` : "", ev.lieu ? `(${ev.lieu})` : ""].filter(Boolean).join(" ");
    }
    case "formations": {
      const f = { ...source, ...(donnees.formations?.find((x) => x.id === e.element_id) ?? {}) } as Record<string, unknown>;
      return [libelleFormation({ type: String(f.type ?? "autre"), intitule: String(f.intitule ?? "") }), salarie(f.salarieId)].filter(Boolean).join(" — ");
    }
    case "exigences": {
      const x = { ...source, ...(donnees.exigences?.find((y) => y.id === e.element_id) ?? {}) } as Record<string, unknown>;
      return `${x.poste ?? "Poste"} : ${libelleFormation({ type: String(x.type ?? "autre"), intitule: "" })}`;
    }
    case "salaries":
      return String(donnees.salaries.find((s) => s.id === e.element_id)?.nom ?? source.nom ?? "Salarié");
    case "articles":
      return String(donnees.articles.find((a) => a.id === e.element_id)?.nom ?? source.nom ?? "Article");
    case "mouvements": {
      const m = { ...source, ...(donnees.mouvements.find((x) => x.id === e.element_id) ?? {}) } as Record<string, unknown>;
      const qui = m.salarieId ? ` à ${salarie(m.salarieId)}` : "";
      return `${m.type === "entree" ? "Réception" : "Remise"} : ${m.quantite ?? "?"} × ${article(m.articleId)} (${m.taille ?? ""})${qui}`;
    }
    case "signatures":
      return `Signature de ${salarie(source.salarieId) || "salarié"}`;
    case "entreprise":
      return clesRacine[e.element_id] ?? e.element_id;
  }
  return e.element_id;
}

// Détail des changements : « Champ : avant → après ».
export function detailsChangement(e: EntreeJournal): { champ: string; avant: string; apres: string }[] {
  if (e.collection === "entreprise") {
    return [{ champ: clesRacine[e.element_id] ?? e.element_id, avant: valeurLisible("", e.avant), apres: valeurLisible("", e.apres) }];
  }
  if (e.action !== "modification" || !e.avant || typeof e.avant !== "object" || Array.isArray(e.avant)) return [];
  const avant = e.avant as Record<string, unknown>;
  const apres = (e.apres ?? {}) as Record<string, unknown>;
  return Object.keys({ ...avant, ...apres })
    .filter((c) => c !== "id")
    .map((c) => ({ champ: libelleChamp(c), avant: valeurLisible(c, avant[c]), apres: valeurLisible(c, apres[c]) }));
}
