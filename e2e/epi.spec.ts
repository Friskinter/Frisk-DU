import { dateDuJour } from "../lib/calculs";
import { donneesDemo } from "../lib/demo";
import { CLE_DONNEES_TEST } from "../lib/mode-test";
import { expect, ouvrir, test, verifierAccessibilite } from "./outils";

// Nouvelle entreprise : ni article au catalogue, ni salarié.
const sansCatalogue = JSON.stringify({ ...donneesDemo(dateDuJour()), articles: [], mouvements: [], salaries: [] });

test.describe("catalogue d'EPI vide", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(([cle, valeur]) => ((window as unknown as Record<string, string>)[cle] = valeur), [CLE_DONNEES_TEST, sansCatalogue]);
  });

  test("la saisie explique quoi faire et mène au catalogue", async ({ page }) => {
    await ouvrir(page, "/epi");
    await page.getByRole("tab", { name: "Saisir une sortie / entrée" }).click();
    await expect(page.getByRole("heading", { name: "Votre catalogue d'équipements est vide" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Enregistrer" })).toHaveCount(0);
    await verifierAccessibilite(page);

    await page.getByRole("button", { name: "Ouvrir le catalogue d'articles" }).click();
    await expect(page.getByRole("tab", { name: "Catalogue d'articles" })).toHaveAttribute("aria-selected", "true");
  });

  test.describe("contributeur", () => {
    test.use({ role: "contributeur" });

    test("sans droit sur le catalogue, il est invité à demander à un responsable", async ({ page }) => {
      await ouvrir(page, "/epi");
      await page.getByRole("tab", { name: "Saisir une sortie / entrée" }).click();
      await expect(page.getByText("Demandez à un responsable de votre entreprise de les ajouter.")).toBeVisible();
      await expect(page.getByRole("button", { name: "Ouvrir le catalogue d'articles" })).toHaveCount(0);
    });
  });
});
