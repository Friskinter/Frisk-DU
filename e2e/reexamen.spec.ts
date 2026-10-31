import { dateDuJour } from "../lib/calculs";
import { donneesDemo } from "../lib/demo";
import { CLE_DONNEES_TEST } from "../lib/mode-test";
import { expect, ouvrir, test, verifierAccessibilite } from "./outils";

// Données fixes : la démonstration est recréée (avec de nouveaux identifiants) à chaque chargement.
const donnees = JSON.stringify(donneesDemo(dateDuJour()));
test.beforeEach(async ({ page }) => {
  await page.addInitScript(([cle, valeur]) => ((window as unknown as Record<string, string>)[cle] = valeur), [CLE_DONNEES_TEST, donnees]);
});

test("un changement dans une unité de travail fait réexaminer ses risques", async ({ page }) => {
  await ouvrir(page, "/duerp?unite=Quai%20de%20r%C3%A9ception");
  await expect(page.getByLabel("Filtrer par unité")).toHaveValue("Quai de réception");

  await page.getByRole("button", { name: "Signaler un changement dans « Quai de réception »" }).click();
  await page.getByLabel(/Qu'est-ce qui a changé/).fill("Nouveau quai niveleur");
  await page.getByRole("button", { name: "Marquer ses risques à réexaminer" }).click();

  const bandeau = page.getByRole("status").filter({ hasText: "Risques à réexaminer après un changement" });
  await expect(bandeau).toContainText("Quai de réception");
  await expect(bandeau).toContainText("nouveau quai niveleur");
  const boutons = page.getByRole("button", { name: "✓ Réexaminé" });
  const nombre = await boutons.count();
  expect(nombre).toBeGreaterThan(1);
  await verifierAccessibilite(page);

  // Le tableau de bord le signale et ramène sur l'unité.
  await page.getByRole("link", { name: /Tableau de bord/ }).first().click();
  const alerte = page.getByRole("link", { name: /à réexaminer après un changement dans une unité de travail/ });
  await expect(alerte).toBeVisible();
  await alerte.click();
  await expect(page).toHaveURL(/\/duerp\?unite=Quai/);

  // Confirmer un risque inchangé, revoir la cotation d'un autre : la demande est levée.
  await page.getByRole("button", { name: "✓ Réexaminé" }).first().click();
  await expect(page.getByRole("button", { name: "✓ Réexaminé" })).toHaveCount(nombre - 1);
  const ligne = page.locator("tr", { has: page.getByRole("button", { name: "✓ Réexaminé" }) }).first();
  await ligne.getByLabel("Gravité").selectOption("4");
  await expect(page.getByRole("button", { name: "✓ Réexaminé" })).toHaveCount(nombre - 2);
});

test.describe("lecture seule", () => {
  test.use({ role: "lecteur" });
  test("un lecteur ne peut pas signaler de changement", async ({ page }) => {
    await ouvrir(page, "/duerp?unite=Bureaux");
    await expect(page.getByLabel("Filtrer par unité")).toHaveValue("Bureaux");
    await expect(page.getByRole("button", { name: /Signaler un changement/ })).toHaveCount(0);
  });
});
