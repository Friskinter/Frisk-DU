import { readFileSync } from "node:fs";
import { renderToBuffer } from "@react-pdf/renderer";
import { describe, expect, it } from "vitest";
import { donneesDemo } from "@/lib/demo";
import { DocumentUnique } from "@/lib/pdf/document-unique";
import { FicheEpi } from "@/lib/pdf/fiche-epi";
import { EtatFormations } from "@/lib/pdf/etat-formations";
import { RegistreBenins } from "@/lib/pdf/registre-benins";
import { InventaireProduits, NoticesDePoste } from "@/lib/pdf/produits";
import { PlanPrevention } from "@/lib/pdf/plan-prevention";
import { ProtocoleSecurite } from "@/lib/pdf/protocole-securite";
import { RapportVisite } from "@/lib/pdf/rapport-visite";
import { RegistreSecurite } from "@/lib/pdf/registre-securite";
import { marqueDocuments } from "@/lib/identite";

const marque = marqueDocuments(undefined, `${process.cwd()}/public/logo-frisk.png`);
const d = donneesDemo("2026-10-28");

// Les PDF commencent par « %PDF » ; on vérifie qu'ils se génèrent sans erreur.
describe("PDF", () => {
  it("document unique de travail", async () => {
    const pdf = await renderToBuffer(<DocumentUnique donnees={d} aujourdhui="2026-10-28" marque={marque} />);
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
  }, 30_000);

  it("version figée avec historique", async () => {
    const pdf = await renderToBuffer(
      <DocumentUnique
        donnees={d}
        aujourdhui="2026-10-28"
        marque={marque}
        numero={2}
        historique={[
          { numero: 1, date: "2025-10-01", motif: "Première version", auteur: "A" },
          { numero: 2, date: "2026-10-28", motif: "Mise à jour annuelle", auteur: "A" },
        ]}
      />,
    );
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
  }, 30_000);

  it("document unique vide", async () => {
    const vide = { ...d, duerp: [], fiche: undefined };
    const pdf = await renderToBuffer(<DocumentUnique donnees={vide} aujourdhui="2026-10-28" marque={marque} />);
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
  }, 30_000);

  it("fiche EPI d'un salarié", async () => {
    const pdf = await renderToBuffer(
      <FicheEpi donnees={d} salarieId={d.salaries[0].id} aujourdhui="2026-10-28" marque={marque} />,
    );
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
  }, 30_000);
});

describe("PDF des versions figées", () => {
  it("relit une version à l'ancien format (une action par ligne)", async () => {
    const ancienne = {
      entreprise: "Ancienne SARL",
      duerp: [{ ...d.duerp[0], action: "Garde-corps", responsable: "Direction", echeance: "2025-06-01", statut: "fait" as const }],
    };
    const pdf = await renderToBuffer(<DocumentUnique donnees={ancienne} aujourdhui="2025-01-10" marque={marque} numero={1} />);
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
  }, 30_000);

  it("registre des accidents bénins", async () => {
    expect(d.evenements.some((e) => e.declaration === "registre")).toBe(true);
    const pdf = await renderToBuffer(<RegistreBenins donnees={d} aujourdhui="2026-10-28" marque={marque} />);
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
  }, 30_000);

  it("état des formations et habilitations", async () => {
    const pdf = await renderToBuffer(<EtatFormations donnees={d} aujourdhui="2026-10-28" marque={marque} />);
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
  }, 30_000);

  it("registre de sécurité (vérifications périodiques)", async () => {
    const pdf = await renderToBuffer(<RegistreSecurite donnees={d} aujourdhui="2026-10-28" marque={marque} />);
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
  }, 30_000);

  it("inventaire des produits chimiques et notices de poste", async () => {
    for (const Composant of [InventaireProduits, NoticesDePoste]) {
      const pdf = await renderToBuffer(<Composant donnees={d} aujourdhui="2026-10-28" marque={marque} />);
      expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
    }
  }, 30_000);

  it("plans de prévention : signé avec suivi, et à préparer", async () => {
    for (const intervention of d.interventions) {
      const pdf = await renderToBuffer(<PlanPrevention donnees={d} intervention={intervention} aujourdhui="2026-10-28" marque={marque} />);
      expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
    }
  }, 30_000);

  it("protocoles de sécurité : signé, et à compléter avec matières dangereuses", async () => {
    for (const protocole of d.protocoles) {
      const pdf = await renderToBuffer(<ProtocoleSecurite donnees={d} protocole={protocole} aujourdhui="2026-10-28" marque={marque} />);
      expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
    }
  }, 30_000);

  it("rapport de visite", async () => {
    const pdf = await renderToBuffer(<RapportVisite donnees={d} visite={d.visites[0]} aujourdhui="2026-10-28" marque={marque} />);
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
  }, 30_000);

  it("documents aux couleurs de l'entreprise (logo large et couleur)", async () => {
    const logoClient = `data:image/png;base64,${readFileSync(`${process.cwd()}/tests/fixtures/logo-client.png`).toString("base64")}`;
    const client = marqueDocuments({ logo: logoClient, couleur: "#1f5fa8" }, `${process.cwd()}/public/logo-frisk.png`);
    expect(client.logo).toBe(logoClient);
    const pdfs = [
      await renderToBuffer(<DocumentUnique donnees={d} aujourdhui="2026-10-28" marque={client} />),
      await renderToBuffer(<PlanPrevention donnees={d} intervention={d.interventions[0]} aujourdhui="2026-10-28" marque={client} />),
    ];
    for (const pdf of pdfs) expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
  }, 30_000);
});
