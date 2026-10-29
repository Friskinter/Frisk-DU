import { expect, ouvrir, pages, test } from "./outils";

// Sur téléphone, la page ne doit jamais défiler en largeur (les tableaux défilent dans leur cadre).
for (const { chemin } of pages) {
  test(`affichage téléphone de ${chemin}`, async ({ page }) => {
    await ouvrir(page, chemin);
    const debord = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(debord).toBeLessThanOrEqual(1);
  });
}
