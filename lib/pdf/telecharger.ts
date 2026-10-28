"use client";

import { createElement } from "react";
import { dateDuJour } from "@/lib/calculs";
import type { Donnees } from "@/lib/types";

// Sans accents ni caractères interdits : certains navigateurs ignorent sinon le nom proposé.
function nomDeFichier(nom: string) {
  return nom
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\\/:*?"<>|]/g, "-");
}

// Génère le document unique dans le navigateur ; la bibliothèque PDF n'est chargée qu'à la demande.
export async function telechargerDocumentUnique(donnees: Donnees) {
  const [{ pdf }, { DocumentUnique }] = await Promise.all([
    import("@react-pdf/renderer"),
    import("./document-unique"),
  ]);
  const aujourdhui = dateDuJour();
  const document = createElement(DocumentUnique, {
    donnees,
    aujourdhui,
    logo: `${window.location.origin}/logo-frisk.png`,
  });
  // DocumentUnique renvoie un <Document> : le type attendu par pdf() est plus étroit que celui de createElement.
  const blob = await pdf(document as Parameters<typeof pdf>[0]).toBlob();
  const url = URL.createObjectURL(blob);
  const lien = window.document.createElement("a");
  lien.href = url;
  lien.download = nomDeFichier(`Document unique - ${donnees.entreprise} - ${aujourdhui}.pdf`);
  // Le lien doit être dans la page pour que certains navigateurs respectent le nom du fichier.
  window.document.body.appendChild(lien);
  lien.click();
  lien.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
