import { renderToBuffer } from "@react-pdf/renderer";
import { describe, expect, it } from "vitest";
import { donneesDemo } from "@/lib/demo";
import { DocumentUnique } from "@/lib/pdf/document-unique";
import { FicheEpi } from "@/lib/pdf/fiche-epi";
import { EtatFormations } from "@/lib/pdf/etat-formations";
import { RegistreBenins } from "@/lib/pdf/registre-benins";

const logo = `${process.cwd()}/public/logo-frisk.png`;
const d = donneesDemo("2026-10-28");

// Les PDF commencent par « %PDF » ; on vérifie qu'ils se génèrent sans erreur.
describe("PDF", () => {
  it("document unique de travail", async () => {
    const pdf = await renderToBuffer(<DocumentUnique donnees={d} aujourdhui="2026-10-28" logo={logo} />);
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
  }, 30_000);

  it("version figée avec historique", async () => {
    const pdf = await renderToBuffer(
      <DocumentUnique
        donnees={d}
        aujourdhui="2026-10-28"
        logo={logo}
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
    const pdf = await renderToBuffer(<DocumentUnique donnees={vide} aujourdhui="2026-10-28" logo={logo} />);
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
  }, 30_000);

  it("fiche EPI d'un salarié", async () => {
    const pdf = await renderToBuffer(
      <FicheEpi donnees={d} salarieId={d.salaries[0].id} aujourdhui="2026-10-28" logo={logo} />,
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
    const pdf = await renderToBuffer(<DocumentUnique donnees={ancienne} aujourdhui="2025-01-10" logo={logo} numero={1} />);
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
  }, 30_000);

  it("registre des accidents bénins", async () => {
    expect(d.evenements.some((e) => e.declaration === "registre")).toBe(true);
    const pdf = await renderToBuffer(<RegistreBenins donnees={d} aujourdhui="2026-10-28" logo={logo} />);
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
  }, 30_000);

  it("état des formations et habilitations", async () => {
    const pdf = await renderToBuffer(<EtatFormations donnees={d} aujourdhui="2026-10-28" logo={logo} />);
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
  }, 30_000);
});
