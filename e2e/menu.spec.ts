import { expect, ouvrir, test } from "./outils";

test("le menu est regroupé et toutes ses entrées restent accessibles sur un écran de portable", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await ouvrir(page, "/");
  const menu = page.getByRole("navigation");
  for (const groupe of ["Piloter", "Évaluer", "Suivre", "Salariés"]) {
    await expect(menu.getByText(groupe, { exact: true })).toBeVisible();
  }
  // Les dernières entrées étaient coupées en bas de l'écran : le menu défile désormais.
  for (const entree of ["Réglages", "Abonnement"]) {
    const lien = menu.getByRole("link", { name: entree });
    await lien.scrollIntoViewIfNeeded();
    await expect(lien).toBeInViewport();
  }
  await menu.getByRole("link", { name: "Abonnement" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Abonnement" })).toBeVisible();
});
