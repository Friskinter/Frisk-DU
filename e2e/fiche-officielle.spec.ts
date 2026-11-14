import { expect, ouvrir, test, verifierAccessibilite } from "./outils";

const fiche = {
  raisonSociale: "TRANSPORTS MOREL",
  siren: "812345678",
  siret: "812 345 678 00021",
  adresse: "3 RUE DES ARTISANS 69007 LYON",
  activite: "Transports terrestres et transport par conduites (49.41A)",
  effectif: "10 à 19 salariés (INSEE, 2023)",
  responsable: "Paul Morel, Gérant",
  ville: "LYON",
};

test("la fiche de l'entreprise se remplit avec sa fiche officielle", async ({ page }) => {
  // Le répertoire de l'État n'est pas appelé pendant les tests : sa réponse est simulée.
  await page.route("**/api/entreprise", (r) => r.fulfill({ json: { entreprises: [fiche] } }));
  await ouvrir(page, "/reglages");
  await page.getByLabel(/Remplir avec la fiche officielle/).fill("812 345 678 00021");
  await page.getByRole("button", { name: "Trouver la fiche" }).click();
  await expect(page.getByText("TRANSPORTS MOREL")).toBeVisible();
  await verifierAccessibilite(page);

  await page.getByRole("button", { name: "Remplir avec la fiche de TRANSPORTS MOREL" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Fiche remplie" })).toBeVisible();
  await expect(page.getByLabel("Raison sociale")).toHaveValue("TRANSPORTS MOREL");
  await expect(page.getByLabel("SIRET", { exact: true })).toHaveValue("812 345 678 00021");
  await expect(page.getByLabel("Adresse")).toHaveValue("3 RUE DES ARTISANS 69007 LYON");
  await expect(page.getByLabel(/Activité/)).toHaveValue(/49\.41A/);
  await expect(page.getByLabel("Effectif")).toHaveValue("10 à 19 salariés (INSEE, 2023)");
  await expect(page.getByLabel(/Responsable/)).toHaveValue("Paul Morel, Gérant");
});

test("aucun résultat, ou répertoire indisponible : message clair", async ({ page }) => {
  let reponses = [
    { json: { entreprises: [] } },
    { status: 502, json: { erreur: "Le répertoire des entreprises ne répond pas. Réessayez dans un instant, ou remplissez la fiche à la main." } },
  ];
  await page.route("**/api/entreprise", (r) => {
    const [premiere, ...suite] = reponses;
    reponses = suite;
    return r.fulfill(premiere);
  });
  await ouvrir(page, "/reglages");
  await page.getByLabel(/Remplir avec la fiche officielle/).fill("Entreprise introuvable");
  await page.getByRole("button", { name: "Trouver la fiche" }).click();
  await expect(page.getByText("Aucune entreprise en activité ne correspond", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Trouver la fiche" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "ne répond pas" })).toBeVisible();
});
