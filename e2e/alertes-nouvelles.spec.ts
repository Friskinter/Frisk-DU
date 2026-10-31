import { dateDuJour } from "../lib/calculs";
import { donneesDemo } from "../lib/demo";
import { CLE_ALERTES_VUES_TEST, CLE_DONNEES_TEST } from "../lib/mode-test";
import { expect, ouvrir, test, verifierAccessibilite } from "./outils";

// Données fixes : la démonstration est recréée (avec de nouveaux identifiants) à chaque chargement.
const donnees = JSON.stringify(donneesDemo(dateDuJour()));
test.beforeEach(async ({ page }) => {
  await page.addInitScript(([cle, valeur]) => ((window as unknown as Record<string, string>)[cle] = valeur), [CLE_DONNEES_TEST, donnees]);
});

test("première visite : aucune alerte marquée « Nouveau »", async ({ page }) => {
  await ouvrir(page, "/");
  await expect(page.getByRole("heading", { name: /À traiter/ })).toBeVisible();
  await expect(page.getByText("Nouveau", { exact: true })).toHaveCount(0);
});

test("les alertes apparues depuis la dernière visite sont marquées, puis ne le sont plus", async ({ page }) => {
  // Dernière visite : tableau de bord sans alerte.
  await page.addInitScript(([cle]) => {
    if (!sessionStorage.getItem("deja")) {
      localStorage.setItem(cle, JSON.stringify(["__visite__"]));
      sessionStorage.setItem("deja", "1");
    }
  }, [CLE_ALERTES_VUES_TEST]);
  await ouvrir(page, "/");
  const entete = page.getByRole("heading", { name: /À traiter/ });
  await expect(entete).toContainText("depuis votre dernière visite");
  const nombre = await page.getByText("Nouveau", { exact: true }).count();
  expect(nombre).toBeGreaterThan(0);
  await verifierAccessibilite(page);

  // Visite suivante : tout a été vu.
  await page.reload();
  await expect(page.getByRole("heading", { name: /À traiter/ })).toBeVisible();
  await expect(page.getByText("Nouveau", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: /À traiter/ })).not.toContainText("depuis votre dernière visite");
});
