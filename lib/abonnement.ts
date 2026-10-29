// Abonnements : essai gratuit de 7 jours, tranches d'effectif, accès selon le statut.
// Mêmes règles que la base (migration 017 : acces_entreprise, collections_essai), qui les fait respecter.

import type { Operation } from "./operations";

export type StatutAbonnement = "essai" | "actif" | "impaye" | "termine";
// complet : tout Frisk DU ; essai : fonctions de base ; lecture : consultation et export seulement.
export type Acces = "complet" | "essai" | "lecture";
export type Periodicite = "mois" | "an";

export const DUREE_ESSAI_JOURS = 7;

// Tranches d'effectif proposées à l'abonnement. Les prix sont définis dans Stripe (clé de
// recherche frisk_du_<code>_<periodicite>) : on les change sans toucher au code.
export const offres = [
  { code: "tpe", libelle: "1 à 10 salariés", effectif: "1 à 10 salariés" },
  { code: "pe", libelle: "11 à 49 salariés", effectif: "11 à 49 salariés" },
  { code: "pme", libelle: "50 à 249 salariés", effectif: "50 à 249 salariés" },
] as const;
export type CodeOffre = (typeof offres)[number]["code"];

export const effectifsInscription = [...offres.map((o) => o.effectif), "250 salariés et plus"];

export function cleTarif(offre: CodeOffre, periodicite: Periodicite) {
  return `frisk_du_${offre}_${periodicite}`;
}

export function lireCleTarif(cle: string | null | undefined): { offre: CodeOffre; periodicite: Periodicite } | null {
  const m = /^frisk_du_([a-z]+)_(mois|an)$/.exec(cle ?? "");
  const offre = offres.find((o) => o.code === m?.[1]);
  return m && offre ? { offre: offre.code, periodicite: m[2] as Periodicite } : null;
}

export function offreValide(x: unknown): x is CodeOffre {
  return offres.some((o) => o.code === x);
}

// Tranche conseillée d'après l'effectif saisi (« 14 salariés », « 1 à 10 salariés »…).
export function offreConseillee(effectif: string | undefined): CodeOffre {
  const n = Number(/\d+/.exec(effectif ?? "")?.[0] ?? 0);
  const max = Number(/(\d+)\D*salari/.exec(effectif ?? "")?.[1] ?? n);
  const valeur = Math.max(n, max);
  return valeur > 49 ? "pme" : valeur > 10 ? "pe" : "tpe";
}

export function accesEntreprise(e: { abonnement: StatutAbonnement; essaiFin: string | null }, maintenant = new Date()): Acces {
  if (e.abonnement === "actif" || e.abonnement === "impaye") return "complet";
  if (e.abonnement === "essai" && e.essaiFin && new Date(e.essaiFin) > maintenant) return "essai";
  return "lecture";
}

export function joursRestants(essaiFin: string | null, maintenant = new Date()) {
  if (!essaiFin) return 0;
  return Math.max(0, Math.ceil((new Date(essaiFin).getTime() - maintenant.getTime()) / 86_400_000));
}

export const collectionsEssai = ["duerp", "actions", "salaries"] as const;

// Opérations permises pendant l'essai : document unique, plan d'actions, salariés, informations générales.
export function operationPermiseEssai(op: Operation) {
  if (op.type === "racine") return op.cle !== "identite";
  if (op.type === "signature") return false;
  return (collectionsEssai as readonly string[]).includes(op.collection);
}

// Statut d'un abonnement Stripe, traduit pour Frisk DU (null : rien à changer).
export function statutDepuisStripe(statut: string): StatutAbonnement | null {
  if (statut === "active" || statut === "trialing") return "actif";
  if (statut === "past_due" || statut === "unpaid") return "impaye";
  if (statut === "canceled" || statut === "incomplete_expired" || statut === "paused") return "termine";
  return null; // incomplete : paiement en cours de validation
}

// Modules réservés aux abonnés, présentés en aperçu pendant l'essai.
export const modulesAbonnes: { chemin: string; titre: string; accroche: string; points: string[]; capture: string }[] = [
  {
    chemin: "/accidents",
    titre: "Accidents et signalement par QR code",
    accroche: "Le registre des accidents, des presque-accidents et des situations dangereuses, alimenté directement par vos salariés.",
    points: ["Signalement en une minute depuis le téléphone, avec photo, sans compte", "Registre des accidents bénins (art. R4141-9)", "Analyse des causes et actions correctives reliées au DUERP", "Taux de fréquence et de gravité calculés"],
    capture: "/apercus/accidents.jpg",
  },
  {
    chemin: "/formations",
    titre: "Formations et habilitations",
    accroche: "Qui est formé à quoi, ce qui expire bientôt, et les attestations rangées au même endroit.",
    points: ["Formations exigées par poste (CACES, habilitation électrique, SST…)", "Alertes avant expiration", "Attestations en pièce jointe", "État des formations en PDF"],
    capture: "/apercus/formations.jpg",
  },
  {
    chemin: "/verifications",
    titre: "Vérifications périodiques",
    accroche: "Le registre de sécurité : équipements, rapports de contrôle et observations à lever.",
    points: ["Échéances calculées selon la réglementation", "Observations des organismes suivies jusqu'à leur levée", "Registre de sécurité en PDF"],
    capture: "/apercus/verifications.jpg",
  },
  {
    chemin: "/produits",
    titre: "Produits chimiques",
    accroche: "L'inventaire des produits, leurs fiches de données de sécurité et les notices de poste.",
    points: ["Pictogrammes et mentions de danger", "Repérage des produits CMR", "Fiches de données de sécurité à jour", "Notices de poste imprimables"],
    capture: "/apercus/produits.jpg",
  },
  {
    chemin: "/visites",
    titre: "Visites et audits",
    accroche: "Des grilles de visite prêtes à l'emploi, remplies sur le terrain, avec les non-conformités transformées en actions.",
    points: ["5 grilles modèles, personnalisables", "Taux de conformité", "Rapport de visite en PDF"],
    capture: "/apercus/visites.jpg",
  },
  {
    chemin: "/accueil",
    titre: "Accueil sécurité et causeries",
    accroche: "L'accueil des nouveaux arrivants et les quarts d'heure sécurité, avec émargement signé.",
    points: ["Livret d'accueil adapté au poste", "12 thèmes de causerie prêts à animer", "Signatures sur tablette ou téléphone"],
    capture: "/apercus/accueil.jpg",
  },
  {
    chemin: "/entreprises-exterieures",
    titre: "Entreprises extérieures",
    accroche: "Plans de prévention et protocoles de sécurité pour les intervenants et les transporteurs.",
    points: ["Plan de prévention écrit quand il est obligatoire (400 h ou travaux dangereux)", "Protocoles de chargement et déchargement", "Signatures des deux entreprises"],
    capture: "/apercus/entreprises-exterieures.jpg",
  },
  {
    chemin: "/penibilite",
    titre: "Pénibilité",
    accroche: "Les expositions aux facteurs de pénibilité, par salarié, au regard des seuils réglementaires.",
    points: ["Seuils du compte professionnel de prévention", "Salariés concernés repérés automatiquement"],
    capture: "/apercus/penibilite.jpg",
  },
  {
    chemin: "/epi",
    titre: "EPI et stocks",
    accroche: "Les équipements de protection remis à chaque salarié, signés, et le stock suivi.",
    points: ["Remises signées par le salarié", "Alertes de stock bas", "Fiche EPI par salarié en PDF"],
    capture: "/apercus/epi.jpg",
  },
  {
    chemin: "/bilans",
    titre: "Bilans",
    accroche: "Les consommations d'EPI et les coûts, par service et par période.",
    points: ["Graphiques par service et par article", "Export pour le budget"],
    capture: "/apercus/bilans.jpg",
  },
  {
    chemin: "/rapport",
    titre: "Rapport annuel",
    accroche: "Le bilan de l'année en santé et sécurité, calculé à partir de vos données, à présenter au CSE.",
    points: ["Accidents, actions, formations, vérifications", "Programme de prévention de l'année suivante", "Rapport complet en PDF"],
    capture: "/apercus/rapport.jpg",
  },
];

export function moduleAbonne(chemin: string) {
  return modulesAbonnes.find((m) => chemin === m.chemin || chemin.startsWith(`${m.chemin}/`));
}

// Abonnement Stripe, réduit à ce que Frisk DU enregistre (structure de l'API Stripe).
export type AbonnementStripe = {
  id: string;
  status: string;
  customer: string | { id: string };
  metadata?: Record<string, string> | null;
  current_period_end?: number;
  items: { data: { current_period_end?: number; price: { lookup_key: string | null } }[] };
};

// Colonnes de l'entreprise à mettre à jour d'après l'abonnement Stripe (null : rien à changer).
export function majDepuisStripe(sub: AbonnementStripe) {
  const abonnement = statutDepuisStripe(sub.status);
  if (!abonnement) return null;
  const article = sub.items.data[0];
  const tarif = lireCleTarif(article?.price.lookup_key);
  const fin = article?.current_period_end ?? sub.current_period_end;
  return {
    abonnement,
    offre: tarif?.offre ?? null,
    periodicite: tarif?.periodicite ?? null,
    abonnement_fin: fin ? new Date(fin * 1000).toISOString() : null,
    stripe_abonnement: sub.id,
    stripe_client: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
  };
}
