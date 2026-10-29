// Informations légales de Frisk, reprises dans les mentions légales, les CGU, la politique de
// confidentialité et l'accord de traitement des données. Les champs vides s'affichent en rouge
// « à compléter » sur les pages publiques : à remplir avant la mise en ligne.

export const editeur = {
  nomCommercial: "Frisk",
  raisonSociale: "", // ex. « Frisk SAS »
  formeJuridique: "", // ex. « Société par actions simplifiée »
  capital: "", // ex. « 1 000 € »
  siege: "", // adresse du siège social
  rcs: "", // ex. « RCS Lyon 123 456 789 » (ou SIREN pour une entreprise individuelle)
  tva: "", // numéro de TVA intracommunautaire
  telephone: "",
  email: "", // adresse de contact, aussi utilisée pour les demandes RGPD
  directeurPublication: "", // nom du représentant légal
  ville: "", // ville du siège, pour la juridiction compétente
};

// Région d'hébergement de la base Supabase : Supabase > Project Settings > General > Region.
export const regionDonnees = ""; // ex. « Union européenne (Francfort, Allemagne) »

export type SousTraitant = { nom: string; role: string; adresse: string; localisation: string; garanties: string };

export const sousTraitants: SousTraitant[] = [
  {
    nom: "Supabase Inc.",
    role: "Base de données, authentification et stockage des fichiers",
    adresse: "970 Toa Payoh North #07-04, Singapore 318992",
    localisation: regionDonnees || "région choisie à la création du projet (à préciser)",
    garanties: "Accord de traitement (DPA) et clauses contractuelles types de la Commission européenne",
  },
  {
    nom: "Vercel Inc.",
    role: "Hébergement de l'application web",
    adresse: "440 N Barranca Ave #4133, Covina, CA 91723, États-Unis",
    localisation: "Réseau mondial ; fonctions exécutées dans la région configurée",
    garanties: "Accord de traitement (DPA), Data Privacy Framework UE–États-Unis et clauses contractuelles types",
  },
  {
    nom: "Stripe Payments Europe Ltd.",
    role: "Paiement en ligne des abonnements et facturation",
    adresse: "1 Grand Canal Street Lower, Grand Canal Dock, Dublin, D02 H210, Irlande",
    localisation: "Union européenne (Irlande), avec transferts encadrés",
    garanties: "Accord de traitement (DPA) et clauses contractuelles types ; seuls le nom de l'entreprise, l'adresse e-mail et les informations de facturation sont transmis",
  },
  {
    nom: "Resend Inc.",
    role: "Envoi des e-mails de récapitulatif des alertes",
    adresse: "États-Unis",
    localisation: "États-Unis",
    garanties: "Accord de traitement (DPA) et clauses contractuelles types ; seuls l'adresse e-mail et le contenu de l'alerte sont transmis",
  },
];

// Version des conditions : la changer impose une nouvelle acceptation à chaque utilisateur.
export const VERSION_CONDITIONS = "2026-10-29";
export const DATE_CONDITIONS = "29 octobre 2026";

export const documentsLegaux = [
  { href: "/legal/mentions", titre: "Mentions légales", court: "Mentions légales" },
  { href: "/legal/cgu", titre: "Conditions générales d'utilisation", court: "CGU" },
  { href: "/legal/cgv", titre: "Conditions générales de vente", court: "CGV" },
  { href: "/legal/confidentialite", titre: "Politique de confidentialité", court: "Confidentialité" },
  { href: "/legal/traitement", titre: "Accord de traitement des données", court: "Traitement des données" },
];

export function champsManquants() {
  const libelles: Record<keyof typeof editeur, string> = {
    nomCommercial: "nom commercial",
    raisonSociale: "raison sociale",
    formeJuridique: "forme juridique",
    capital: "capital social",
    siege: "adresse du siège",
    rcs: "immatriculation (RCS ou SIREN)",
    tva: "numéro de TVA",
    telephone: "téléphone",
    email: "e-mail de contact",
    directeurPublication: "directeur de la publication",
    ville: "ville du siège",
  };
  const manquants = (Object.keys(editeur) as (keyof typeof editeur)[]).filter((k) => !editeur[k]).map((k) => libelles[k]);
  if (!regionDonnees) manquants.push("région d'hébergement des données");
  return manquants;
}
