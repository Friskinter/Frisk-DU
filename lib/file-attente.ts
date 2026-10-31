// Modifications pas encore envoyées, gardées sur l'appareil : une saisie faite sans réseau (visite dans
// un entrepôt, sur un chantier) survit à la fermeture ou au rechargement de la page, et part au retour
// du réseau. Une file par entreprise et par utilisateur : sur un appareil partagé, personne n'envoie
// les saisies d'un autre sous son nom.

import type { Operation } from "./operations";

type Stockage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const cle = (entrepriseId: string, email: string) => `frisk-en-attente:${entrepriseId}:${email.toLowerCase()}`;

function stockageNavigateur(): Stockage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null; // stockage bloqué par le navigateur
  }
}

export function lireFile(entrepriseId: string, email: string, stockage = stockageNavigateur()): Operation[] {
  try {
    const ops = JSON.parse(stockage?.getItem(cle(entrepriseId, email)) ?? "[]");
    return Array.isArray(ops) ? ops : [];
  } catch {
    return [];
  }
}

// false : la file n'a pas pu être gardée (stockage plein ou bloqué), elle n'existe qu'en mémoire.
export function memoriserFile(entrepriseId: string, email: string, ops: Operation[], stockage = stockageNavigateur()): boolean {
  if (!stockage) return false;
  try {
    if (ops.length) stockage.setItem(cle(entrepriseId, email), JSON.stringify(ops));
    else stockage.removeItem(cle(entrepriseId, email));
    return true;
  } catch {
    return false;
  }
}

// Une saisie lettre par lettre produit une modification par frappe : on fusionne les modifications
// successives d'un même élément pour garder une file courte.
export function ajouterAFile(file: Operation[], ops: Operation[]): Operation[] {
  const resultat = [...file];
  for (const op of ops) {
    const derniere = resultat[resultat.length - 1];
    if (op.type === "modification" && derniere?.type === "modification" && derniere.collection === op.collection && derniere.id === op.id) {
      resultat[resultat.length - 1] = { ...derniere, champs: { ...derniere.champs, ...op.champs } };
    } else {
      resultat.push(op);
    }
  }
  return resultat;
}
