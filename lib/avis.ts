// Avis des clients sur Frisk DU, déposés depuis « Mon compte » et publiés sur le site vitrine
// après relecture par Frisk (migration 018). Les limites reprennent celles de la base.

export type StatutAvis = "en_attente" | "publie" | "refuse";

export type Avis = {
  note: number;
  texte: string;
  auteur: string; // nom affiché, ex. « Marie D. »
  fonction: string; // ex. « Gérante »
  entrepriseAffichee: string; // vide : l'entreprise n'est pas citée
};

export const AVIS_TEXTE_MIN = 20;
export const AVIS_TEXTE_MAX = 1000;

export const libellesStatutAvis: Record<StatutAvis, string> = {
  en_attente: "En cours de relecture par Frisk",
  publie: "Publié sur le site Frisk",
  refuse: "Non publié",
};

// Première erreur à corriger, ou null si l'avis peut être envoyé.
export function erreurAvis(avis: Avis): string | null {
  if (!Number.isInteger(avis.note) || avis.note < 1 || avis.note > 5) return "Choisissez une note de 1 à 5 étoiles.";
  const texte = avis.texte.trim();
  if (texte.length < AVIS_TEXTE_MIN) return `Votre avis doit faire au moins ${AVIS_TEXTE_MIN} caractères.`;
  if (texte.length > AVIS_TEXTE_MAX) return `Votre avis ne doit pas dépasser ${AVIS_TEXTE_MAX} caractères.`;
  const auteur = avis.auteur.trim();
  if (auteur.length < 2 || auteur.length > 80) return "Indiquez le nom à afficher (par exemple « Marie D. »).";
  if (avis.fonction.trim().length > 80) return "La fonction ne doit pas dépasser 80 caractères.";
  if (avis.entrepriseAffichee.trim().length > 120) return "Le nom de l'entreprise ne doit pas dépasser 120 caractères.";
  return null;
}

// Nom proposé par défaut : prénom et initiale du nom, tirés de l'adresse e-mail quand elle a la
// forme prenom.nom@… (« marie.dupont@x.fr » → « Marie D. »). Sinon, rien : l'utilisateur le saisit.
export function auteurPropose(email: string): string {
  const [prenom, nom] = email.split("@")[0].split(/[._-]/);
  if (!prenom || !nom || !/^[a-zà-ÿ]{2,}$/i.test(prenom) || !/^[a-zà-ÿ]/i.test(nom)) return "";
  return `${prenom[0].toUpperCase()}${prenom.slice(1).toLowerCase()} ${nom[0].toUpperCase()}.`;
}
