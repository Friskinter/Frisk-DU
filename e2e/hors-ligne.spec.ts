import { CLE_HORS_LIGNE_TEST } from "../lib/mode-test";
import { expect, ouvrir, test, verifierAccessibilite } from "./outils";

const CLE_FILE = "frisk-en-attente:00000000-0000-0000-0000-000000000000:test@frisk.fr";

test("une visite saisie sans réseau est gardée sur l'appareil, même après un rechargement", async ({ page }) => {
  await ouvrir(page, "/visites");
  // Réseau coupé (simulé) : les envois échouent.
  await page.evaluate((cle) => localStorage.setItem(cle, "1"), CLE_HORS_LIGNE_TEST);

  await page.getByLabel("Nouvelle visite avec la grille").selectOption({ label: "Incendie et évacuation" });
  await page.getByRole("button", { name: "Commencer la visite" }).click();
  await page.getByLabel("Lieu ou unité de travail").fill("Quai n° 7, visite sans réseau");
  await page.getByRole("group", { name: /Les extincteurs sont présents/ }).getByRole("button", { name: /Conforme/ }).first().click();
  await page.getByLabel("Synthèse de la visite").fill("Saisie faite au fond de l'entrepôt");

  const bandeau = page.getByRole("status").filter({ hasText: "Hors ligne" });
  await expect(bandeau).toContainText("Hors ligne : vos saisies sont enregistrées sur cet appareil.");
  await expect(page.getByText("⚠ Hors ligne : enregistré sur cet appareil")).toBeVisible();
  await verifierAccessibilite(page);
  // Toujours une seule modification en attente par champ, même saisi lettre par lettre.
  const file = await page.evaluate((cle) => JSON.parse(localStorage.getItem(cle) ?? "[]") as unknown[], CLE_FILE);
  expect(file.length).toBeLessThan(10);

  // La page est rechargée (ou fermée puis rouverte) avant le retour du réseau : rien n'est perdu,
  // et le navigateur ne demande pas de confirmation pour quitter la page.
  await page.reload();
  await expect(page.getByText("Quai n° 7, visite sans réseau").first()).toBeVisible();
  await expect(bandeau).toBeVisible();

  // Retour du réseau : tout part aussitôt, la file de l'appareil est vidée.
  await page.evaluate((cle) => {
    localStorage.removeItem(cle);
    window.dispatchEvent(new Event("online"));
  }, CLE_HORS_LIGNE_TEST);
  await expect(page.getByText("✓ Enregistré")).toBeVisible();
  await expect(bandeau).toHaveCount(0);
  expect(await page.evaluate((cle) => localStorage.getItem(cle), CLE_FILE)).toBeNull();
});

test("vraie coupure du réseau : on continue à travailler et à changer de page", async ({ page, context }) => {
  await ouvrir(page, "/visites");
  // Les pages du menu sont préchargées dès que la page est ouverte avec du réseau.
  await page.waitForLoadState("networkidle");
  await context.setOffline(true);
  await page.getByLabel("Nouvelle visite avec la grille").selectOption({ label: "Visite sécurité générale" });
  await page.getByRole("button", { name: "Commencer la visite" }).click();
  await page.getByLabel("Lieu ou unité de travail").fill("Zone de stockage");
  await expect(page.getByText("⚠ Hors ligne : enregistré sur cet appareil")).toBeVisible();

  // Les pages du menu s'ouvrent encore, avec les données déjà chargées.
  await page.getByRole("link", { name: /Plan d'actions/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Plan d'actions" })).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "Hors ligne" })).toBeVisible();

  await context.setOffline(false);
  await expect(page.getByText("✓ Enregistré")).toBeVisible();
});
