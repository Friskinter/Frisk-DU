import { expect, ouvrir, test, verifierAccessibilite } from "./outils";

test("la fiche d'un salarié réunit tout ce qui le concerne", async ({ page }) => {
  await ouvrir(page, "/salaries");
  await page.getByRole("searchbox", { name: "Rechercher un salarié" }).fill("Leroy");
  await page.getByRole("link", { name: /Leroy M\./ }).click();

  await expect(page).toHaveURL(/\/salaries\?salarie=/);
  await expect(page.getByRole("heading", { level: 1, name: "Leroy M." })).toBeVisible();
  for (const section of [/Formations et habilitations/, /EPI remis/, /Accueil sécurité et causeries/, /Expositions/, /Accidents et presque-accidents/]) {
    await expect(page.getByRole("heading", { name: section })).toBeVisible();
  }
  // Accueilli et signé, présent à la causerie sur la circulation, affecté à la zone de stockage.
  await expect(page.getByText("Fait, le", { exact: false })).toBeVisible();
  await expect(page.getByRole("link", { name: /Circulation : piétons et chariots/ })).toBeVisible();
  await expect(page.getByText("Zone de stockage", { exact: true })).toBeVisible();
  await verifierAccessibilite(page);

  // Le PDF se télécharge.
  const telechargement = page.waitForEvent("download");
  await page.getByRole("button", { name: "Télécharger la fiche (PDF)" }).click();
  expect((await telechargement).suggestedFilename()).toMatch(/^Fiche salarie - Leroy M\. - .+\.pdf$/);

  // Une modification de l'identité se retrouve dans la liste.
  await page.getByLabel("Poste").fill("Cariste confirmé");
  await page.getByRole("link", { name: "← Tous les salariés" }).click();
  await expect(page.getByRole("link", { name: /Leroy M\..*Cariste confirmé/ })).toBeVisible();
});

test("ajouter un salarié ouvre sa fiche ; les réglages ne gardent que l'entreprise", async ({ page }) => {
  await ouvrir(page, "/salaries");
  await page.getByRole("button", { name: "+ Ajouter un salarié" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Nouveau salarié" })).toBeVisible();
  await page.getByLabel("Nom").fill("Camille R.");
  await expect(page.getByRole("heading", { level: 1, name: "Camille R." })).toBeVisible();

  await page.getByRole("link", { name: /Réglages/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Réglages" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /^Salariés \(/ })).toHaveCount(0);
});

test.describe("lecture seule", () => {
  test.use({ role: "lecteur" });
  test("un lecteur consulte la fiche, sans pouvoir la modifier", async ({ page }) => {
    await ouvrir(page, "/salaries");
    await expect(page.getByRole("button", { name: "+ Ajouter un salarié" })).toHaveCount(0);
    await page.getByRole("link", { name: /Leroy M\./ }).click();
    await expect(page.getByLabel("Nom")).toBeDisabled();
  });
});
