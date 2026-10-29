import { expect, ouvrir, test, verifierAccessibilite } from "./outils";

test("ajouter un risque au document unique", async ({ page }) => {
  await ouvrir(page, "/duerp");
  await expect(page.getByText("11 lignes sur 11")).toBeVisible();
  await page.getByRole("button", { name: "+ Ajouter un risque" }).click();
  await expect(page.getByText("12 lignes sur 12")).toBeVisible();

  const danger = page.getByRole("combobox", { name: "Danger" }).first();
  await danger.fill("Chute de plain-pied");
  await expect(page.getByText("✓ Enregistré").first()).toBeVisible();

  // La cotation recalcule la criticité de la ligne.
  const ligne = page.locator("tr", { has: page.getByRole("combobox", { name: "Danger" }).and(page.locator('[value="Chute de plain-pied"]')) });
  await ligne.getByRole("combobox", { name: "Gravité" }).selectOption("4");
  await ligne.getByRole("combobox", { name: "Fréquence" }).selectOption("4");
  await expect(ligne.getByText("16 · Critique")).toBeVisible();
});

test("télécharger le document unique en PDF", async ({ page }) => {
  await ouvrir(page, "/duerp");
  const telechargement = page.waitForEvent("download");
  await page.getByRole("button", { name: /Document unique \(PDF\)/ }).click();
  const fichier = await telechargement;
  expect(fichier.suggestedFilename()).toMatch(/^Document unique - .+\.pdf$/);
  const chemin = await fichier.path();
  const { size } = await import("node:fs/promises").then((fs) => fs.stat(chemin));
  expect(size).toBeGreaterThan(10_000);
});

test("déclarer un accident du travail", async ({ page }) => {
  await ouvrir(page, "/accidents");
  await page.getByRole("button", { name: "+ Accident" }).click();
  await expect(page.getByRole("heading", { name: "2. Déclaration" })).toBeVisible();
  await page.getByPlaceholder("Quai 2, allée C…").fill("Quai 3");
  await expect(page.getByRole("button", { name: /Accident du travail .*Quai 3/ })).toBeVisible();
  await verifierAccessibilite(page);
});

test("enregistrer une formation", async ({ page }) => {
  await ouvrir(page, "/formations");
  await page.getByRole("button", { name: "+ Formation" }).click();
  await verifierAccessibilite(page);
});

test.describe("compte en lecture seule", () => {
  test.use({ role: "lecteur" });

  test("le document unique est consultable mais pas modifiable", async ({ page }) => {
    await ouvrir(page, "/duerp");
    await expect(page.getByRole("combobox", { name: "Danger" }).first()).toBeDisabled();
    await expect(page.getByRole("button", { name: "+ Ajouter un risque" })).toBeDisabled();
    // Le PDF reste téléchargeable.
    await expect(page.getByRole("button", { name: /Document unique \(PDF\)/ })).toBeEnabled();
  });
});
