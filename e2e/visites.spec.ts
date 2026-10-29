import { expect, ouvrir, test, verifierAccessibilite } from "./outils";

test("faire une visite, relever une non-conformité et la confier au plan d'actions", async ({ page }) => {
  await ouvrir(page, "/visites");
  await page.getByLabel("Nouvelle visite avec la grille").selectOption({ label: "Incendie et évacuation" });
  await page.getByRole("button", { name: "Commencer la visite" }).click();
  await page.getByLabel("Lieu ou unité de travail").fill("Atelier maintenance");

  const point = (question: RegExp) => page.getByRole("group", { name: question });
  await point(/Les extincteurs sont présents/).getByRole("button", { name: /Conforme/ }).first().click();
  await point(/plans d'évacuation/).getByRole("button", { name: /Non conforme/ }).click();
  await page.getByLabel(/Commentaire : Les plans d'évacuation/).fill("Plan absent à l'entrée de l'atelier");
  await expect(page.getByText("2 point(s) évalué(s) sur 10")).toBeVisible();
  await expect(page.getByText("Conformité : 50 %")).toBeVisible();
  await verifierAccessibilite(page);

  await page.getByRole("button", { name: "→ Créer une action dans le plan" }).click();
  await expect(page.getByRole("link", { name: /Action : Les plans d'évacuation .* Plan absent/ })).toBeVisible();

  const telechargement = page.waitForEvent("download");
  await page.getByRole("button", { name: /Rapport de visite \(PDF\)/ }).click();
  expect((await telechargement).suggestedFilename()).toMatch(/^Rapport de visite - Incendie et evacuation - \d{4}-\d{2}-\d{2}\.pdf$/);

  // L'action apparaît dans le plan, à rattacher à un risque du DUERP.
  await page.getByRole("link", { name: /Action : Les plans d'évacuation/ }).click();
  await expect(page.getByText("Actions non rattachées à un risque du DUERP")).toBeVisible();
  // Celle de la visite de démonstration (rattachée) et la nouvelle.
  await expect(page.getByRole("link", { name: /Non-conformité relevée lors de la visite/ })).toHaveCount(2);
  await page.getByLabel("Rattacher au risque du DUERP").selectOption({ index: 1 });
  await expect(page.getByText("Actions non rattachées à un risque du DUERP")).toHaveCount(0);
});

test("adapter une grille de la bibliothèque", async ({ page }) => {
  await ouvrir(page, "/visites");
  await page.getByRole("tab", { name: "Grilles de contrôle" }).click();
  await page.getByRole("button", { name: "Copier pour l'adapter" }).first().click();
  await expect(page.getByLabel("Nom de la grille")).toHaveValue("Visite sécurité générale (adaptée)");
  await page.getByRole("button", { name: "+ Point à contrôler" }).click();
  await page.getByLabel("Point 15 à contrôler").fill("Le défibrillateur est accessible et signalé");
  await verifierAccessibilite(page);
  await page.getByRole("button", { name: "Commencer une visite" }).first().click();
  await expect(page.getByRole("tab", { name: "Visites" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText("Le défibrillateur est accessible et signalé")).toBeVisible();
});

test("la visite de démonstration montre la non-conformité sans action", async ({ page }) => {
  await ouvrir(page, "/visites");
  await page.getByRole("button", { name: /Visite sécurité générale/ }).click();
  await expect(page.getByLabel(/Commentaire : La trousse de premiers secours/)).toHaveValue("Trousse de l'accueil quais incomplète (pansements, gants)");
  await expect(page.getByRole("button", { name: "→ Créer une action dans le plan" })).toBeVisible();
  await verifierAccessibilite(page);
});
