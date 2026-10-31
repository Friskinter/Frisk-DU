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
  await expect(page).toHaveURL(/\/actions\?action=/);
  // L'action visée est mise en évidence dans le plan d'actions.
  const actionId = new URL(page.url()).searchParams.get("action")!;
  await expect(page.locator(`#cible-${actionId}`)).toHaveClass(/outline-bronze/);

  await ouvrir(page, "/");
  await verifierAccessibilite(page);
});

test("l'essentiel d'abord : chiffres clés, urgences, puis le reste sur demande", async ({ page }) => {
  await ouvrir(page, "/");
  const indicateur = page.getByText("Risques évalués", { exact: true });
  const aTraiter = page.getByRole("heading", { name: /À traiter \(\d+\)/ });
  // Les chiffres clés passent avant la liste des points à traiter.
  const [hautIndicateur, hautListe] = await Promise.all([indicateur.boundingBox(), aTraiter.boundingBox()]);
  expect(hautIndicateur!.y).toBeLessThan(hautListe!.y);

  const total = Number((await aTraiter.innerText()).match(/\((\d+)\)/)![1]);
  await expect(aTraiter).toContainText(/dont \d+ urgents?/);
  const liste = page.locator("section", { has: aTraiter }).getByRole("listitem");
  const visibles = await liste.count();
  expect(visibles).toBeLessThan(total);

  // Tout afficher, puis revenir à l'essentiel.
  await page.getByRole("button", { name: `Voir les ${total - visibles} autres points à traiter` }).click();
  await expect(liste).toHaveCount(total);
  await page.getByRole("button", { name: "Afficher seulement l'essentiel" }).click();
  await expect(liste).toHaveCount(visibles);

  // Filtrer par module : tous les points de ce module, et seulement eux.
  await page.getByLabel("Filtrer les points à traiter par module").selectOption("Vérifications");
  for (const texte of await liste.allInnerTexts()) expect(texte).toContain("Vérifications");
  await verifierAccessibilite(page);
});
