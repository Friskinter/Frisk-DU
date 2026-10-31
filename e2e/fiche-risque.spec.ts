import { expect, ouvrir, test, verifierAccessibilite } from "./outils";

test("tableau : l'essentiel d'abord, et la fiche du risque avec tous les champs", async ({ page }) => {
  await ouvrir(page, "/duerp");
  // Unité, danger, risque résiduel et actions sont les quatre premières colonnes.
  const entetes = await page.getByRole("columnheader").allInnerTexts();
  expect(entetes.slice(0, 4).map((t) => t.toLowerCase().replace("ⓘ", "").trim())).toEqual([
    "unité de travail",
    "danger",
    "risque résiduel",
    "actions de prévention",
  ]);

  await page.getByRole("link", { name: /^Ouvrir la fiche du risque/ }).first().click();
  const fiche = page.getByRole("dialog");
  await expect(fiche).toBeVisible();
  for (const champ of ["Unité de travail", "Danger", "Gravité", "Fréquence", "Mesures existantes", "Maîtrise", "Facteur"]) {
    await expect(fiche.getByLabel(champ, { exact: false }).first()).toBeVisible();
  }
  await verifierAccessibilite(page);

  // Une modification dans la fiche se retrouve dans le tableau.
  await fiche.getByLabel("Danger", { exact: true }).fill("Chute de hauteur depuis le quai");
  await expect(fiche.getByRole("heading", { name: "Chute de hauteur depuis le quai" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(fiche).toHaveCount(0);
  await expect(page.getByRole("combobox", { name: "Danger" }).first()).toHaveValue("Chute de hauteur depuis le quai");
});

test.describe("téléphone", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("une carte par risque ; un nouveau risque s'ouvre dans sa fiche", async ({ page }) => {
    await ouvrir(page, "/duerp");
    await expect(page.getByRole("table")).toHaveCount(0);
    const carte = page.getByRole("listitem").filter({ has: page.getByRole("button") }).first();
    await carte.getByRole("button").click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("button", { name: "Fermer la fiche" }).click();

    await page.getByRole("button", { name: /\+ Ajouter un risque/ }).first().click();
    const fiche = page.getByRole("dialog");
    await expect(fiche.getByRole("heading", { name: "Nouveau risque" })).toBeVisible();
    await fiche.getByLabel("Danger", { exact: true }).fill("Bruit de la presse");
    await page.getByRole("button", { name: "Fermer la fiche" }).click();
    await expect(page.getByRole("button", { name: /Bruit de la presse/ })).toBeVisible();
    // Rien ne dépasse de l'écran.
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  });
});

test.describe("lecture seule", () => {
  test.use({ role: "lecteur" });
  test("un lecteur ouvre la fiche, sans pouvoir la modifier", async ({ page }) => {
    await ouvrir(page, "/duerp");
    await page.getByRole("link", { name: /^Ouvrir la fiche du risque/ }).first().click();
    await expect(page.getByRole("dialog").getByLabel("Danger", { exact: true })).toBeDisabled();
  });
});
