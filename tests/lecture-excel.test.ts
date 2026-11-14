import { expect, it, vi } from "vitest";
import { strToU8, zipSync } from "fflate";
vi.mock("server-only", () => ({}));
const { texteDuDocument } = await import("@/lib/lecture-document");
const { lireFiche } = await import("@/lib/lecture-fiche");
// Fiche interne en classeur Excel : rubriques en colonne A, valeurs en colonne B.
it("lit une fiche d'entreprise en classeur Excel", async () => {
  const c = (r: number, col: string, v: string) => `<c r="${col}${r}" t="inlineStr"><is><t>${v}</t></is></c>`;
  const lignes = [["Raison sociale", "Atelier Durand"], ["Nombre de salariés", "14"], ["Gérant", "Claire Durand"]];
  const sheet = `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${lignes.map((l, i) => `<row r="${i + 1}">${c(i + 1, "A", l[0])}${c(i + 1, "B", l[1])}</row>`).join("")}</sheetData></worksheet>`;
  const xlsx = zipSync({
    "[Content_Types].xml": strToU8(`<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`),
    "_rels/.rels": strToU8(`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`),
    "xl/workbook.xml": strToU8(`<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Fiche" sheetId="1" r:id="rId1"/></sheets></workbook>`),
    "xl/_rels/workbook.xml.rels": strToU8(`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`),
    "xl/worksheets/sheet1.xml": strToU8(sheet),
  });
  const texte = await texteDuDocument("xlsx", xlsx);
  expect(lireFiche(texte).champs).toEqual({ raisonSociale: "Atelier Durand", effectif: "14", responsable: "Claire Durand" });
});
