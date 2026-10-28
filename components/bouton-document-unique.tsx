"use client";

import { useState } from "react";
import { classeBoutonSecondaire } from "@/components/ui";
import { telechargerDocumentUnique } from "@/lib/pdf/telecharger";
import type { Donnees } from "@/lib/types";

export function BoutonDocumentUnique({ donnees, className = classeBoutonSecondaire }: { donnees: Donnees; className?: string }) {
  const [etat, setEtat] = useState<"pret" | "generation" | "erreur">("pret");

  const generer = async () => {
    setEtat("generation");
    try {
      await telechargerDocumentUnique(donnees);
      setEtat("pret");
    } catch {
      setEtat("erreur");
    }
  };

  return (
    <button type="button" className={`${className} disabled:opacity-60`} onClick={generer} disabled={etat === "generation"}>
      {etat === "generation" ? "Création du PDF…" : etat === "erreur" ? "⚠ Réessayer le PDF" : "⬇ Document unique (PDF)"}
    </button>
  );
}
