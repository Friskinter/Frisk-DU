// « Mon parcours QHSE » : les étapes de la démarche de prévention, adaptées au profil de l'entreprise
// (questionnaire en cinq questions) et cochées d'elles-mêmes d'après les données, comme l'assistant
// de démarrage dont il reprend les étapes de base (lib/demarrage.ts).
// Règle : une réponse « non » n'écarte jamais un sujet ; il devient une piste à vérifier.

import { domaines } from "./bibliotheque";
import { actionEnRetard } from "./actions";
import { decalerJours } from "./calculs";
import { etapesDemarrage, RISQUES_MINIMUM } from "./demarrage";
import type { Donnees, ProfilEntreprise, ReponseProfil } from "./types";

export type EtatEtape = "fait" | "en-cours" | "a-faire";
export type GroupeEtape = "bases" | "suivi" | "duree";

export type EtapeParcours = {
  code: string;
  groupe: GroupeEtape;
  titre: string;
  aide: string;
  lien: string;
  bouton: string;
  etat: EtatEtape;
};

// Sujet que le profil rend moins probable : présenté à part, jamais retiré.
export type Piste = { code: string; titre: string; aide: string; lien: string };

export type Parcours = {
  etapes: EtapeParcours[];
  pistes: Piste[];
  faites: number;
  total: number;
  pourcentage: number; // avancement du parcours dans Frisk, pas une mesure de conformité
  prochaine?: EtapeParcours;
};

export const libellesGroupes: Record<GroupeEtape, string> = {
  bases: "Poser les bases",
  suivi: "Organiser le suivi",
  duree: "Dans la durée",
};

export const tranches: { valeur: NonNullable<ProfilEntreprise["tranche"]>; libelle: string }[] = [
  { valeur: "1-10", libelle: "1 à 10 salariés" },
  { valeur: "11-49", libelle: "11 à 49 salariés" },
  { valeur: "50-249", libelle: "50 à 249 salariés" },
  { valeur: "250+", libelle: "250 salariés et plus" },
];

export const questionsOuiNon: { cle: "exterieurs" | "chimiques" | "equipements"; question: string; precision: string }[] = [
  {
    cle: "exterieurs",
    question: "Accueillez-vous des intérimaires, des stagiaires ou des entreprises extérieures ?",
    precision: "Sous-traitants, prestataires de maintenance, transporteurs qui chargent ou déchargent chez vous…",
  },
  {
    cle: "chimiques",
    question: "Utilisez-vous des produits chimiques ?",
    precision: "Y compris les produits d'entretien, peintures, colles, huiles, carburants…",
  },
  {
    cle: "equipements",
    question: "Avez-vous des équipements ou installations à faire vérifier ?",
    precision: "Extincteurs, installation électrique, chariots, ponts roulants, compresseurs, rayonnages…",
  },
];

export const libellesReponses: Record<ReponseProfil, string> = { oui: "Oui", non: "Non", nsp: "Je ne sais pas" };

// Nombre de questions du profil restant sans réponse (secteur, effectif et les trois questions oui/non).
export function questionsSansReponse(p: ProfilEntreprise | undefined) {
  return [p?.secteur, p?.tranche, p?.exterieurs, p?.chimiques, p?.equipements].filter((r) => !r).length;
}

// Secteurs où les équipements de protection individuelle sont presque toujours nécessaires.
const SECTEURS_EPI = ["btp", "industrie", "bouche", "hotellerie-restauration", "transport-logistique", "sante-social", "automobile", "agriculture-environnement"];

export function calculerParcours(
  d: Donnees,
  contexte: { aujourdhui: string; versions?: number; lienActif?: boolean; derniereVersion?: string | null },
): Parcours {
  const p = d.fiche?.profil ?? {};
  const secteur = domaines.find((x) => x.id === p.secteur);
  const etat = (fait: boolean, commence = false): EtatEtape => (fait ? "fait" : commence ? "en-cours" : "a-faire");
  const etapes: EtapeParcours[] = [];
  const pistes: Piste[] = [];

  // Poser les bases : le profil, puis les étapes de l'assistant de démarrage.
  const sansReponse = questionsSansReponse(p);
  etapes.push({
    code: "profil",
    groupe: "bases",
    titre: "Décrire votre entreprise",
    aide: "Cinq questions pour adapter votre parcours : secteur, effectif, intervenants extérieurs, produits chimiques, équipements.",
    lien: "/parcours#profil",
    bouton: "Répondre",
    etat: etat(sansReponse === 0, sansReponse < 5),
  });
  for (const e of etapesDemarrage(d, contexte)) {
    const commence =
      (e.code === "risques" && d.duerp.length > 0) ||
      (e.code === "actions" && d.duerp.length >= RISQUES_MINIMUM && d.actions.length > 0);
    const aide =
      e.code === "risques" && secteur
        ? `${e.aide} Pour le secteur « ${secteur.nom} », le DUERP express propose les métiers correspondants.`
        : e.aide;
    etapes.push({ code: e.code, groupe: "bases", titre: e.titre, aide, lien: e.lien, bouton: e.bouton, etat: etat(e.faite, commence) });
  }

  // Organiser le suivi : selon le profil ; une réponse « non » fait passer le sujet en piste.
  etapes.push({
    code: "accueils",
    groupe: "suivi",
    titre: "Organiser l'accueil sécurité des nouveaux arrivants",
    aide:
      p.exterieurs === "oui"
        ? "Chaque nouvel arrivant, intérimaire ou stagiaire reçoit un accueil sécurité avant de prendre son poste, renforcé sur un poste à risques."
        : "Chaque nouvel arrivant reçoit un accueil sécurité avant de prendre son poste.",
    lien: "/accueil",
    bouton: "Préparer l'accueil",
    etat: etat((d.accueils ?? []).length > 0),
  });
  etapes.push({
    code: "formations",
    groupe: "suivi",
    titre: "Définir les formations exigées par poste",
    aide: "Habilitations, CACES, sauveteurs secouristes… Frisk vous prévient avant qu'elles n'expirent.",
    lien: "/formations",
    bouton: "Définir les formations",
    etat: etat((d.exigences ?? []).length > 0),
  });

  const sujet = (
    code: string,
    reponse: ReponseProfil | undefined,
    titre: string,
    aide: string,
    lien: string,
    bouton: string,
    fait: boolean,
    pourquoiVerifier: string,
  ) => {
    if (reponse === "non" && !fait) pistes.push({ code, titre, aide: pourquoiVerifier, lien });
    else etapes.push({ code, groupe: "suivi", titre, aide, lien, bouton, etat: etat(fait) });
  };
  sujet(
    "equipements",
    p.equipements,
    "Recenser les équipements à vérifier",
    "Chaque équipement a sa périodicité de vérification : Frisk vous rappelle les échéances.",
    "/verifications",
    "Ajouter les équipements",
    (d.equipements ?? []).length > 0,
    "Vous avez répondu non : à confirmer. Extincteurs et installation électrique sont à faire vérifier dans presque toutes les entreprises.",
  );
  sujet(
    "chimiques",
    p.chimiques,
    "Faire l'inventaire des produits chimiques",
    "Avec leurs fiches de données de sécurité, demandées au fournisseur (elles sont gratuites et obligatoires).",
    "/produits",
    "Faire l'inventaire",
    (d.produits ?? []).length > 0,
    "Vous avez répondu non : à confirmer. Les produits d'entretien, colles ou carburants sont aussi des produits chimiques.",
  );
  sujet(
    "exterieures",
    p.exterieurs,
    "Encadrer les interventions d'entreprises extérieures",
    "Plan de prévention pour les intervenants, protocole de sécurité pour les transporteurs.",
    "/entreprises-exterieures",
    "Préparer une intervention",
    (d.interventions ?? []).length + (d.protocoles ?? []).length > 0,
    "Vous avez répondu non : à garder en tête dès qu'un prestataire, un sous-traitant ou un transporteur intervient chez vous.",
  );
  const epiProbables = !secteur || SECTEURS_EPI.includes(secteur.id);
  const epiFait = d.articles.length > 0;
  if (epiProbables || epiFait) {
    etapes.push({
      code: "epi",
      groupe: "suivi",
      titre: "Créer le catalogue des équipements de protection",
      aide: "Les EPI remis à vos salariés, par taille, avec leur signature et le stock à commander.",
      lien: "/epi?onglet=catalogue",
      bouton: "Créer le catalogue",
      etat: etat(epiFait),
    });
  } else {
    pistes.push({
      code: "epi",
      titre: "Équipements de protection individuelle",
      aide: "Peu fréquents dans votre secteur, mais à prévoir si un poste en demande (gants, chaussures de sécurité, protections auditives…).",
      lien: "/epi?onglet=catalogue",
    });
  }

  // Dans la durée : une fois les bases posées.
  const basesFaites = etapes.filter((e) => e.groupe === "bases").every((e) => e.etat === "fait");
  if (basesFaites) {
    if (contexte.derniereVersion !== undefined) {
      const annuelle = p.tranche && p.tranche !== "1-10";
      etapes.push({
        code: "mise-a-jour",
        groupe: "duree",
        titre: "Mettre à jour le document unique chaque année",
        aide: annuelle
          ? "Obligatoire au moins une fois par an à partir de 11 salariés, et à chaque changement important (nouvel équipement, réorganisation, accident)."
          : "À chaque changement important (nouvel équipement, réorganisation, accident) ; une revue annuelle reste une bonne pratique.",
        lien: "/duerp",
        bouton: "Ouvrir le DUERP",
        etat: etat(!!contexte.derniereVersion && contexte.derniereVersion > decalerJours(contexte.aujourdhui, -365)),
      });
    }
    const enRetard = d.actions.some((a) => actionEnRetard(a, contexte.aujourdhui));
    etapes.push({
      code: "revue-actions",
      groupe: "duree",
      titre: "Tenir le plan d'actions à jour",
      aide: "Réaliser les actions à leur échéance et vérifier leur efficacité. Le tableau de bord signale les retards.",
      lien: "/actions",
      bouton: "Ouvrir le plan d'actions",
      etat: etat(d.actions.length > 0 && !enRetard, d.actions.length > 0),
    });
  }

  const faites = etapes.filter((e) => e.etat === "fait").length;
  return {
    etapes,
    pistes,
    faites,
    total: etapes.length,
    pourcentage: etapes.length ? Math.round((faites / etapes.length) * 100) : 0,
    prochaine: etapes.find((e) => e.etat !== "fait"),
  };
}
