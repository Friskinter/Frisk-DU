import { ouvrir, pages, test, verifierAccessibilite } from "./outils";

// Contrastes, étiquettes des champs, noms des boutons… selon les règles WCAG 2.1 AA.
for (const { chemin } of pages) {
  test(`accessibilité de ${chemin}`, async ({ page }) => {
    await ouvrir(page, chemin);
    await verifierAccessibilite(page);
  });
}
