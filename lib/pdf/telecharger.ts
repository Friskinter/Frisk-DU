"use client";

import { createElement, type ReactElement } from "react";
import { dateDuJour } from "@/lib/calculs";
import type { Donnees } from "@/lib/types";

// Sans accents ni caractères interdits : certains navigateurs ignorent sinon le nom proposé.
function nomDeFichier(nom: string) {
  return nom
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[\\/:*?"<>|]/g, "-");
}

// Génère le PDF dans le navigateur et le propose au téléchargement.
// La bibliothèque PDF n'est chargée qu'à la demande.
async function enregistrerPdf(document: ReactElement, nom: string) {
  const { pdf } = await import("@react-pdf/renderer");
  // Nos composants renvoient un <Document> : le type attendu par pdf() est plus étroit que celui de createElement.
  const blob = await pdf(document as Parameters<typeof pdf>[0]).toBlob();
  const url = URL.createObjectURL(blob);
  const lien = window.document.createElement("a");
  lien.href = url;
  lien.download = nomDeFichier(nom);
  // Le lien doit être dans la page pour que certains navigateurs respectent le nom du fichier.
  window.document.body.appendChild(lien);
  lien.click();
  lien.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

const logo = () => `${window.location.origin}/logo-frisk.png`;

export async function telechargerDocumentUnique(donnees: Donnees) {
  const { DocumentUnique } = await import("./document-unique");
  const aujourdhui = dateDuJour();
  await enregistrerPdf(
    createElement(DocumentUnique, { donnees, aujourdhui, logo: logo() }),
    `Document unique - ${donnees.entreprise} - ${aujourdhui}.pdf`,
  );
}

export async function telechargerFicheEpi(donnees: Donnees, salarieId: string) {
  const { FicheEpi } = await import("./fiche-epi");
  const aujourdhui = dateDuJour();
  const nom = donnees.salaries.find((s) => s.id === salarieId)?.nom ?? "salarie";
  await enregistrerPdf(
    createElement(FicheEpi, { donnees, salarieId, aujourdhui, logo: logo() }),
    `Fiche EPI - ${nom} - ${aujourdhui}.pdf`,
  );
}
