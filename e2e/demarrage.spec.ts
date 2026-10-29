import { donneesVides } from "../lib/demo";
import { CLE_DONNEES_TEST } from "../lib/mode-test";
import { expect, ouvrir, test, verifierAccessibilite } from "./outils";

const nouvelleEntreprise = JSON.stringify({ ...donneesVides(), entreprise: "Menuiserie Nouvelle" });

test.describe("nouvelle entreprise", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(([cle, valeur]) => ((window as unknown as Record<string, string>)[cle] = valeur), [CLE_DONNEES_TEST, nouvelleEntreprise]);
  });

  test("l'assistant guide pas à pas et se coche au fil de la saisie", async ({ page }) => {
    await ouvrir(page, "/");
    const assistant = page.getByRole("region", { name: "Bien démarrer avec Frisk Plateforme" });
    await expect(assistant).toBeVisible();
    // En mode test, le lien de signalement compte comme activé ; les versions ne sont pas connues.
    await expect(assistant.getByText("1 étape sur 6.")).toBeVisible();
    await verifierAccessibilite(page);

    await assistant.getByRole("link", { name: "Remplir la fiche →" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Salariés & réglages" })).toBeVisible();
    await page.getByLabel("Adresse").fill("3 rue des Artisans, 69007 Lyon");
    await page.getByLabel("Effectif").fill("6 salariés");
    await page.getByLabel(/Responsable/).fill("Paul Morel, gérant");
    await page.getByRole("link", { name: /Tableau de bord/ }).click();
    await expect(assistant.getByText("2 étapes sur 6.")).toBeVisible();
    await expect(assistant.getByText("Compléter la fiche de l'entreprise (fait)")).toBeAttached();
  });

  test("masquer l'assistant, puis le réafficher depuis les réglages", async ({ page }) => {
    await ouvrir(page, "/");
    await page.getByRole("button", { name: "Masquer l'assistant" }).click();
    await expect(page.getByRole("region", { name: "Bien démarrer avec Frisk Plateforme" })).toHaveCount(0);
    await page.getByRole("link", { name: /Salariés & réglages/ }).click();
    await page.getByRole("button", { name: "Réafficher l'assistant" }).click();
    await page.getByRole("link", { name: /Tableau de bord/ }).click();
    await expect(page.getByRole("region", { name: "Bien démarrer avec Frisk Plateforme" })).toBeVisible();
  });
});

test("entreprise déjà en place : pas d'assistant", async ({ page }) => {
  await ouvrir(page, "/");
  await expect(page.getByRole("region", { name: "Bien démarrer avec Frisk Plateforme" })).toHaveCount(0);
});

test.describe("lecture seule", () => {
  test.use({ role: "lecteur" });
  test("pas d'assistant pour un lecteur", async ({ page }) => {
    await page.addInitScript(([cle, valeur]) => ((window as unknown as Record<string, string>)[cle] = valeur), [CLE_DONNEES_TEST, nouvelleEntreprise]);
    await ouvrir(page, "/");
    await expect(page.getByRole("region", { name: "Bien démarrer avec Frisk Plateforme" })).toHaveCount(0);
  });
});
