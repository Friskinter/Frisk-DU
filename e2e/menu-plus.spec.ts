import { expect, ouvrir, test, verifierAccessibilite } from "./outils";

test("DUERP : l'essentiel en tête de page, le reste dans « Plus »", async ({ page }) => {
  await ouvrir(page, "/duerp");
  for (const visible of ["+ Ajouter un risque", "🗄 Versions"]) await expect(page.getByRole("button", { name: visible })).toBeVisible();
  await expect(page.getByRole("button", { name: "Exporter (Excel)" })).toBeHidden();

  await page.getByText("Plus ▾").click();
  // Le menu s'ouvre entièrement dans l'écran.
  await expect(page.getByRole("button", { name: "📚 Bibliothèque de risques" })).toBeInViewport({ ratio: 1 });
  await expect(page.getByRole("link", { name: "Importer (Excel)" })).toBeVisible();
  await verifierAccessibilite(page);
  // Un choix referme le menu.
  await page.getByRole("button", { name: "? Guide de cotation" }).click();
  await expect(page.getByRole("button", { name: "Exporter (Excel)" })).toBeHidden();
  await expect(page.getByText("Plus ▾")).toBeVisible();
});

test.describe("sur téléphone", () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test("les chiffres clés tiennent sur deux colonnes", async ({ page }) => {
    await ouvrir(page, "/actions");
    const [premier, second] = await Promise.all([
      page.getByText("Actions réalisées", { exact: true }).boundingBox(),
      page.getByText("En retard", { exact: true }).first().boundingBox(),
    ]);
    expect(Math.abs(premier!.y - second!.y)).toBeLessThan(5);
  });
});
