import { expect, ouvrir, test, verifierAccessibilite } from "./outils";

test("Ctrl+K ouvre la recherche ; Entrée ouvre directement l'élément", async ({ page }) => {
  await ouvrir(page, "/duerp");
  await page.keyboard.press("Control+k");
  const fenetre = page.getByRole("dialog", { name: "Rechercher dans Frisk Plateforme" });
  await expect(fenetre).toBeVisible();
  const champ = fenetre.getByRole("combobox");
  await expect(champ).toBeFocused();
  // La fenêtre passe au-dessus de l'en-tête fixe du tableau (elle n'est pas enfermée dans le menu).
  const auDessus = await page.evaluate(() => {
    const entete = document.querySelector("thead")!.getBoundingClientRect();
    const element = document.elementFromPoint(entete.left + entete.width / 2, entete.top + entete.height / 2);
    return !!element?.closest("[role=dialog]") || !element?.closest("thead");
  });
  expect(auDessus).toBe(true);

  // Sans accent ni majuscule : le salarié est trouvé.
  await champ.fill("leroy");
  await expect(fenetre.getByRole("option").first()).toContainText("Leroy M.");
  await verifierAccessibilite(page);
  await page.keyboard.press("Enter");
  await expect(fenetre).toHaveCount(0);
  await expect(page).toHaveURL(/\/salaries\?salarie=/);
  await expect(page.getByRole("heading", { level: 1, name: "Leroy M." })).toBeVisible();
});

test("depuis le menu : un produit, choisi avec les flèches", async ({ page }) => {
  await ouvrir(page, "/");
  await page.getByRole("button", { name: /Rechercher…/ }).click();
  const fenetre = page.getByRole("dialog");
  await fenetre.getByRole("combobox").fill("degraissant");
  const options = fenetre.getByRole("option");
  await expect(options.first()).toContainText("Dégraissant");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowUp");
  await expect(options.first()).toHaveAttribute("aria-selected", "true");
  await options.first().click();
  await expect(page).toHaveURL(/\/produits\?produit=/);
});

test("aucun résultat, puis Échap ferme la recherche", async ({ page }) => {
  await ouvrir(page, "/");
  await page.keyboard.press("Control+k");
  const fenetre = page.getByRole("dialog");
  await fenetre.getByRole("combobox").fill("zzzz introuvable");
  await expect(fenetre.getByText("Aucun résultat", { exact: false })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(fenetre).toHaveCount(0);
});
