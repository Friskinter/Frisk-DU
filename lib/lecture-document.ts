import "server-only";
import { strFromU8, unzipSync } from "fflate";

// Texte d'un document déposé par le client (sa fiche d'entreprise) : PDF, Word (.docx), Excel (.xlsx)
// ou texte. Une ligne par ligne du document (ou par ligne du tableau, cellules séparées par deux espaces).

export const TAILLE_MAX_DOCUMENT = 4 * 1024 * 1024; // l'hébergeur refuse les envois de plus de 4,5 Mo

export class DocumentIlisible extends Error {}

export type FormatDocument = "pdf" | "docx" | "xlsx" | "texte";

export function formatDocument(nom: string, type: string): FormatDocument | null {
  const extension = nom.toLowerCase().split(".").pop() ?? "";
  if (extension === "pdf" || type === "application/pdf") return "pdf";
  if (extension === "docx") return "docx";
  if (extension === "xlsx") return "xlsx";
  if (["txt", "csv"].includes(extension) || type.startsWith("text/")) return "texte";
  return null;
}

async function textePdf(octets: Uint8Array) {
  const { extractTextItems, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(octets);
  const { items } = await extractTextItems(pdf);
  // Les morceaux de texte de chaque page, regroupés en lignes selon leur hauteur sur la page.
  const lignes: string[] = [];
  for (const page of items) {
    const parHauteur = new Map<number, { x: number; texte: string }[]>();
    for (const item of page) {
      if (!item.str.trim()) continue;
      const y = Math.round(item.y / 3);
      parHauteur.set(y, [...(parHauteur.get(y) ?? []), { x: item.x, texte: item.str }]);
    }
    for (const y of [...parHauteur.keys()].sort((a, b) => b - a)) {
      lignes.push(
        parHauteur
          .get(y)!
          .sort((a, b) => a.x - b.x)
          .map((m) => m.texte.trim())
          .join("  "),
      );
    }
  }
  return lignes.join("\n");
}

function texteDocx(octets: Uint8Array) {
  const xml = unzipSync(octets, { filter: (f) => f.name === "word/document.xml" })["word/document.xml"];
  if (!xml) throw new DocumentIlisible("Ce fichier Word est illisible.");
  return strFromU8(xml)
    .replace(/<w:tab\/>/g, "  ")
    .replace(/<\/w:tc>/g, "  ") // cellules d'un tableau
    .replace(/<\/w:p>|<w:br\/>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

async function texteXlsx(octets: Uint8Array) {
  const { default: lireClasseur } = await import("read-excel-file/universal");
  const feuilles = await lireClasseur(octets.slice().buffer);
  return feuilles
    .flatMap((f) => f.data)
    .map((ligne) => ligne.filter((c) => c !== null && c !== "").map(String).join("  "))
    .join("\n");
}

export async function texteDuDocument(format: FormatDocument, octets: Uint8Array): Promise<string> {
  try {
    if (format === "pdf") return await textePdf(octets);
    if (format === "docx") return texteDocx(octets);
    if (format === "xlsx") return await texteXlsx(octets);
    return new TextDecoder("utf-8").decode(octets);
  } catch (e) {
    if (e instanceof DocumentIlisible) throw e;
    throw new DocumentIlisible("Ce document n'a pas pu être lu. Vérifiez qu'il s'ouvre bien sur votre ordinateur.");
  }
}
