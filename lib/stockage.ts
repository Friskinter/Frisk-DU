"use client";

// Données conservées dans le navigateur (localStorage) en attendant un serveur avec comptes clients.

import { useSyncExternalStore } from "react";
import { dateDuJour } from "./calculs";
import { donneesDemo } from "./demo";
import type { Donnees } from "./types";

const CLE = "frisk-du-v1";

let etat: Donnees | null = null;
const abonnes = new Set<() => void>();

function lire(): Donnees {
  if (etat === null) {
    try {
      const brut = localStorage.getItem(CLE);
      etat = brut ? (JSON.parse(brut) as Donnees) : donneesDemo(dateDuJour());
    } catch {
      etat = donneesDemo(dateDuJour());
    }
  }
  return etat;
}

function sabonner(rappel: () => void) {
  abonnes.add(rappel);
  return () => abonnes.delete(rappel);
}

export function useDonnees(): Donnees | null {
  return useSyncExternalStore(sabonner, lire, () => null);
}

export function modifier(transformation: (d: Donnees) => Donnees) {
  etat = transformation(lire());
  try {
    localStorage.setItem(CLE, JSON.stringify(etat));
  } catch {
    // Stockage indisponible (navigation privée) : les données restent en mémoire.
  }
  abonnes.forEach((rappel) => rappel());
}

export function remplacer(donnees: Donnees) {
  modifier(() => donnees);
}
