import { describe, expect, it, vi } from "vitest";
import { lireFiche, numeroValide } from "@/lib/lecture-fiche";

vi.mock("server-only", () => ({}));
const { formatDocument, texteDuDocument } = await import("@/lib/lecture-document");

// Extrait Kbis tel que le texte en sort d'un PDF (rubriques et valeurs sur la même ligne ou la suivante).
const KBIS = `Greffe du Tribunal de Commerce de Lyon
EXTRAIT D'IMMATRICULATION PRINCIPALE AU REGISTRE DU COMMERCE ET DES SOCIÉTÉS
IDENTIFICATION DE LA PERSONNE MORALE
Immatriculation au RCS, numéro  732 829 320 R.C.S. Lyon
Dénomination ou raison sociale  TRANSPORTS MOREL
Forme juridique  Société par actions simplifiée
Adresse du siège
3 rue des Artisans
69007 Lyon
GESTION, DIRECTION, ADMINISTRATION, CONTRÔLE, ASSOCIÉS OU MEMBRES
Président
Nom, prénoms  MOREL Paul
RENSEIGNEMENTS RELATIFS À L'ACTIVITÉ ET À L'ÉTABLISSEMENT PRINCIPAL
Activité(s) exercée(s)  Transports routiers de fret de proximité`;

// Avis de situation au répertoire SIRENE (INSEE).
const AVIS_INSEE = `Avis de situation au répertoire Sirene
Identifiant SIRET du siège : 732 829 320 00074
Dénomination : TRANSPORTS MOREL
Adresse : 3 RUE DES ARTISANS 69007 LYON
Activité principale exercée (APE) : 49.41B
Tranche d'effectif salarié : 10 à 19 salariés`;

describe("lecture d'une fiche d'entreprise", () => {
  it("vérifie la clé des numéros SIREN et SIRET", () => {
    expect(numeroValide("732829320")).toBe(true);
    expect(numeroValide("73282932000074")).toBe(true);
    expect(numeroValide("732829321")).toBe(false);
  });

  it("lit un extrait Kbis", () => {
    const { champs, siren, siret } = lireFiche(KBIS);
    expect(siren).toBe("732829320");
    expect(siret).toBeUndefined();
    expect(champs).toEqual({
      raisonSociale: "TRANSPORTS MOREL",
      adresse: "3 rue des Artisans 69007 Lyon",
      responsable: "MOREL Paul",
      activite: "Transports routiers de fret de proximité",
    });
  });

  it("lit un avis de situation de l'INSEE", () => {
    const { champs, siret } = lireFiche(AVIS_INSEE);
    expect(siret).toBe("73282932000074");
    expect(champs).toMatchObject({
      raisonSociale: "TRANSPORTS MOREL",
      adresse: "3 RUE DES ARTISANS 69007 LYON",
      siret: "732 829 320 00074",
      activite: "Transports terrestres et transport par conduites (49.41B)",
      effectif: "10 à 19 salariés",
    });
  });

  it("lit une fiche interne en tableau, quelle que soit l'écriture des rubriques", () => {
    const { champs } = lireFiche("RAISON SOCIALE  Atelier Durand\nNombre de salariés : 14\nGérant - Claire Durand\nSIRET 732 829 320 00074\nCode NAF 2562B");
    expect(champs).toMatchObject({
      raisonSociale: "Atelier Durand",
      effectif: "14",
      responsable: "Claire Durand",
      siret: "732 829 320 00074",
      activite: "Fabrication de produits métalliques, à l'exception des machines et des équipements (25.62B)",
    });
  });

  it("ignore un document sans fiche d'entreprise", () => {
    expect(lireFiche("Compte rendu de la réunion du 12 mars\nPrésents : tous")).toEqual({ champs: {}, siret: undefined, siren: undefined });
  });

  it("lit le texte d'un document Word et d'un PDF", async () => {
    const { zipSync, strToU8 } = await import("fflate");
    const docx = zipSync({
      "word/document.xml": strToU8(`<w:document><w:body><w:p><w:r><w:t>Raison sociale : Atelier Durand</w:t></w:r></w:p><w:p><w:r><w:t>Effectif : 14 salariés</w:t></w:r></w:p></w:body></w:document>`),
    });
    expect(formatDocument("fiche.docx", "")).toBe("docx");
    expect(lireFiche(await texteDuDocument("docx", docx)).champs).toEqual({ raisonSociale: "Atelier Durand", effectif: "14 salariés" });

    const { Document, Page, Text, renderToBuffer } = await import("@react-pdf/renderer");
    const { createElement: h } = await import("react");
    const pdf = await renderToBuffer(
      h(Document, null, h(Page, null, ...AVIS_INSEE.split("\n").map((l, i) => h(Text, { key: i }, l)))),
    );
    expect(formatDocument("avis.pdf", "application/pdf")).toBe("pdf");
    const lecture = lireFiche(await texteDuDocument("pdf", new Uint8Array(pdf)));
    expect(lecture.siret).toBe("73282932000074");
    expect(lecture.champs.raisonSociale).toBe("TRANSPORTS MOREL");
    expect(lecture.champs.activite).toContain("49.41B");
  });
});
