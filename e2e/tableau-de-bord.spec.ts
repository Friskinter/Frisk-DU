import { expect, ouvrir, test, verifierAccessibilite } from "./outils";

test("le tableau de bord montre indicateurs, priorités datées et prochaines échéances filtrables", async ({ page }) => {
  await ouvrir(page, "/");

  for (const libelle of ["Risques évalués", "Actions en cours", "Actions en retard", "Échéances à 30 jours", "Formations à renouveler", "Vérifications à faire"]) {
    await expect(page.getByText(libelle, { exact: true })).toBeVisible();
  }

  // Priorités : dates et règles de classement expliquées.
  await expect(page.getByText(/En retard depuis le \d{2}\/\d{2}\/\d{4}/).first()).toBeVisible();
  await page.getByText("Comment sont classées les priorités ?").click();
  await expect(page.getByText(/ne constituent pas une évaluation de conformité/)).toBeVisible();

  // Prochaines échéances : filtre « En retard », puis ouverture d'un élément.
  const echeances = page.locator("section", { has: page.getByRole("heading", { name: "Prochaines échéances" }) });
  await expect(echeances.getByRole("listitem").first()).toBeVisible();
  await echeances.getByLabel("Période").selectOption("retard");
  const lignes = echeances.getByRole("listitem");
  await expect(lignes.first()).toBeVisible();
  for (const texte of await lignes.allInnerTexts()) expect(texte).toContain("En retard");

  await echeances.getByLabel("Type d'échéance").selectOption("action");
  await lignes.first().getByRole("link").click();
  await expect(page).toHaveURL(/\/actions\?risque=/);

  await ouvrir(page, "/");
  await verifierAccessibilite(page);
});
