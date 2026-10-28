"use client";

import { createElement, type ReactElement } from "react";
import { dateDuJour } from "@/lib/calculs";
import type { Donnees } from "@/lib/types";
import type { LigneHistorique } from "./document-unique";

// Sans accents ni caractères interdits : certains navigateurs ignorent sinon le nom proposé.
function nomDeFichier(nom: string) {
  return nom
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
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

// Sans version : document de travail à la date du jour. Avec version : la version figée, telle qu'enregistrée.
export async function telechargerDocumentUnique(
  donnees: Pick<Donnees, "entreprise" | "fiche" | "duerp"> & { actions?: Donnees["actions"] },
  version?: { numero: number; date: string; historique: LigneHistorique[] },
) {
  const { DocumentUnique } = await import("./document-unique");
  const date = version?.date ?? dateDuJour();
  await enregistrerPdf(
    createElement(DocumentUnique, {
      donnees,
      aujourdhui: date,
      logo: logo(),
      numero: version?.numero,
      historique: version?.historique,
    }),
    version
      ? `Document unique - ${donnees.entreprise} - version ${version.numero} du ${date}.pdf`
      : `Document unique - ${donnees.entreprise} - ${date}.pdf`,
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

export async function telechargerRegistreBenins(donnees: Donnees) {
  const { RegistreBenins } = await import("./registre-benins");
  const aujourdhui = dateDuJour();
  await enregistrerPdf(
    createElement(RegistreBenins, { donnees, aujourdhui, logo: logo() }),
    `Registre des accidents benins - ${donnees.entreprise} - ${aujourdhui}.pdf`,
  );
}

export async function telechargerEtatFormations(donnees: Donnees) {
  const { EtatFormations } = await import("./etat-formations");
  const aujourdhui = dateDuJour();
  await enregistrerPdf(
    createElement(EtatFormations, { donnees, aujourdhui, logo: logo() }),
    `Formations et habilitations - ${donnees.entreprise} - ${aujourdhui}.pdf`,
  );
}

export async function telechargerRegistreSecurite(donnees: Donnees) {
  const { RegistreSecurite } = await import("./registre-securite");
  const aujourdhui = dateDuJour();
  await enregistrerPdf(
    createElement(RegistreSecurite, { donnees, aujourdhui, logo: logo() }),
    `Registre de securite - ${donnees.entreprise} - ${aujourdhui}.pdf`,
  );
}
