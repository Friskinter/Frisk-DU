import { expect, ouvrir, test } from "./outils";

test("préparer le rapport annuel : synthèse de l'employeur et PDF", async ({ page }) => {
  await ouvrir(page, "/rapport");
  await expect(page.getByText(/Année en cours : les chiffres sont arrêtés au/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Accidents et presque-accidents" })).toBeVisible();
  const synthese = page.getByLabel(/Synthèse de l'employeur pour/);
  await synthese.fill("Année marquée par le signalement terrain et les visites mensuelles.");
  await expect(page.getByText("✓ Enregistré").first()).toBeVisible();

  const telechargement = page.waitForEvent("download");
  await page.getByRole("button", { name: /Rapport annuel \d{4} \(PDF\)/ }).click();
  expect((await telechargement).suggestedFilename()).toMatch(/^Rapport annuel SST \d{4} - Logistique Demo SAS\.pdf$/);
});

test.describe("lecture seule", () => {
  test.use({ role: "lecteur" });
  test("synthèse non modifiable, PDF disponible", async ({ page }) => {
    await ouvrir(page, "/rapport");
    await expect(page.getByLabel(/Synthèse de l'employeur pour/)).toBeDisabled();
    await expect(page.getByRole("button", { name: /Rapport annuel \d{4} \(PDF\)/ })).toBeEnabled();
  });
});
