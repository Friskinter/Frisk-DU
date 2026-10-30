"use client";

import { useSearchParams } from "next/navigation";
import { useEffect } from "react";

// Élément visé par l'adresse de la page (ex. /actions?action=…), depuis une alerte ou une échéance du
// tableau de bord : la page le met en évidence et le fait défiler jusqu'à l'écran une fois prête.
// L'élément porte l'identifiant HTML idCible(id). useSearchParams impose un Suspense autour de la page.
export function useCible(parametre: string, pret: boolean) {
  const id = useSearchParams().get(parametre) ?? "";
  useEffect(() => {
    if (!id || !pret) return;
    document.getElementById(idCible(id))?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [id, pret]);
  return id;
}

export const idCible = (id: string) => `cible-${id}`;

// Mise en évidence de l'élément visé.
export const classeCible = "bg-bronze/10 outline outline-2 -outline-offset-2 outline-bronze";
