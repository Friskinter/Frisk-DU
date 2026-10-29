import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Cgu from "@/app/legal/cgu/page";
import Confidentialite from "@/app/legal/confidentialite/page";
import MentionsLegales from "@/app/legal/mentions/page";
import AccordTraitement from "@/app/legal/traitement/page";
import { champsManquants, documentsLegaux, editeur, sousTraitants, VERSION_CONDITIONS } from "@/lib/legal";

const pages = { MentionsLegales, Cgu, Confidentialite, AccordTraitement };

describe("documents légaux", () => {
  it("chaque document s'affiche et signale les informations à compléter", () => {
    for (const [nom, Page] of Object.entries(pages)) {
      const html = renderToStaticMarkup(<Page />);
      expect(html, nom).toContain("<h1");
      if (!editeur.raisonSociale) expect(html, nom).toContain("à compléter");
    }
  });

  it("les sous-traitants figurent dans la politique et dans l'accord de traitement", () => {
    for (const Page of [Confidentialite, AccordTraitement]) {
      const html = renderToStaticMarkup(<Page />);
      for (const s of sousTraitants) expect(html).toContain(s.nom);
    }
  });

  it("rappels essentiels : responsabilité de l'employeur, données de santé, notification des violations", () => {
    expect(renderToStaticMarkup(<Cgu />)).toContain("ne se substitue pas à l&#x27;évaluation des risques");
    expect(renderToStaticMarkup(<Confidentialite />)).toContain("article 9.2.b");
    expect(renderToStaticMarkup(<AccordTraitement />)).toContain("48 heures");
  });

  it("liste des informations manquantes et liens", () => {
    expect(champsManquants().length).toBeGreaterThan(0);
    expect(documentsLegaux.map((d) => d.href)).toEqual(["/legal/mentions", "/legal/cgu", "/legal/cgv", "/legal/confidentialite", "/legal/traitement"]);
    expect(VERSION_CONDITIONS).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
