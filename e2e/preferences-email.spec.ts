import { expect, ouvrir, test, verifierAccessibilite } from "./outils";

test("chacun choisit les e-mails qu'il reçoit dans Mon compte", async ({ page }) => {
  await ouvrir(page, "/compte");
  const carte = page.locator("section", { has: page.getByRole("heading", { name: "E-mails que je reçois" }) });
  const recapitulatif = carte.getByRole("checkbox", { name: /Récapitulatif du lundi/ });
  const immediats = carte.getByRole("checkbox", { name: /E-mails immédiats/ });
  await expect(recapitulatif).toBeChecked();
  await expect(immediats).toBeChecked();
  const enregistrer = carte.getByRole("button", { name: "Enregistrer mes préférences" });
  await expect(enregistrer).toBeDisabled();

  await recapitulatif.uncheck();
  await enregistrer.click();
  await expect(carte.getByRole("status")).toHaveText("Préférences enregistrées.");
  await expect(enregistrer).toBeDisabled();
  await verifierAccessibilite(page);
});

test.describe("lecteur", () => {
  test.use({ role: "lecteur" });
  test("règle aussi ses propres e-mails", async ({ page }) => {
    await ouvrir(page, "/compte");
    await page.getByRole("checkbox", { name: /E-mails immédiats/ }).uncheck();
    await page.getByRole("button", { name: "Enregistrer mes préférences" }).click();
    await expect(page.getByText("Préférences enregistrées.")).toBeVisible();
  });
});
