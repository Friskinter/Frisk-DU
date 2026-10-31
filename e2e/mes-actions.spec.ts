import { donneesVides } from "../lib/demo";
import { CLE_DONNEES_TEST } from "../lib/mode-test";
import { expect, ouvrir, test, verifierAccessibilite } from "./outils";

test("une action confiée à un utilisateur apparaît dans sa page « Mes actions »", async ({ page }) => {
  // Le compte de test est test@frisk.fr : on lui confie la première action du plan.
  await ouvrir(page, "/actions");
  const premiere = page.getByRole("row").filter({ has: page.getByLabel("Confier l'action à un utilisateur") }).first();
  const intitule = await premiere.getByRole("textbox").first().inputValue();
  await premiere.getByLabel("Confier l'action à un utilisateur").selectOption("test@frisk.fr");

  await page.getByRole("link", { name: /Mes actions/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Mes actions" })).toBeVisible();
  await expect(page.getByText(intitule, { exact: true }).first()).toBeVisible();
  // Un responsable voit aussi les formations à organiser.
  await expect(page.getByRole("heading", { name: /Formations à organiser/ })).toBeVisible();
  await verifierAccessibilite(page);

  // Le lien ouvre l'action dans le plan d'actions.
  await page.getByText(intitule, { exact: true }).first().click();
  await expect(page).toHaveURL(/\/actions\?action=/);
});

test.describe("nouvelle entreprise", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(([cle, valeur]) => ((window as unknown as Record<string, string>)[cle] = valeur), [CLE_DONNEES_TEST, JSON.stringify(donneesVides())]);
  });
  test("rien de confié : la page explique comment confier une action", async ({ page }) => {
    await ouvrir(page, "/mes-actions");
    await expect(page.getByText("Aucune action ne vous est confiée pour l'instant.", { exact: false })).toBeVisible();
  });
});
