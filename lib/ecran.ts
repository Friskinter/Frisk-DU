"use client";

import { useSyncExternalStore } from "react";

// Écran assez large pour un tableau (768 px, le point « md » de Tailwind). Au pré-rendu et au
// premier affichage, on suppose un ordinateur ; sur téléphone, la vue se corrige aussitôt.
const requete = "(min-width: 768px)";

function sabonner(rappel: () => void) {
  const media = window.matchMedia(requete);
  media.addEventListener("change", rappel);
  return () => media.removeEventListener("change", rappel);
}

export function useEcranLarge() {
  return useSyncExternalStore(
    sabonner,
    () => window.matchMedia(requete).matches,
    () => true,
  );
}
