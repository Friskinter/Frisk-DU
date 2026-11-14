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

test.describe("import de la fiche de l'entreprise", () => {
  // Fiche interne en Word ou en texte : ici un fichier texte, sans numéro (le répertoire n'est pas interrogé).
  const ficheInterne = [
    "Fiche entreprise",
    "Raison sociale : Atelier Durand",
    "Adresse du siège social",
    "12 rue des Forges",
    "42000 Saint-Étienne",
    "Code NAF 2562B",
    "Nombre de salariés : 14",
    "Gérant : Claire Durand",
  ].join("\n");

  test("les informations du document sont relues puis remplissent la fiche", async ({ page }) => {
    await ouvrir(page, "/reglages");
    await page.getByLabel("Choisir le document…").setInputFiles({ name: "fiche-atelier.txt", mimeType: "text/plain", buffer: Buffer.from(ficheInterne) });
    await expect(page.getByText("Informations trouvées dans", { exact: false })).toBeVisible();
    await expect(page.getByLabel("Adresse", { exact: true }).first()).toHaveValue("12 rue des Forges 42000 Saint-Étienne");
    await verifierAccessibilite(page);

    // On corrige une valeur et on en écarte une autre avant de remplir.
    await page.getByLabel("Responsable du document", { exact: true }).first().fill("Claire Durand, gérante");
    await page.getByLabel("Utiliser : Effectif").uncheck();
    await page.getByRole("button", { name: "Remplir la fiche avec ces informations" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Fiche remplie avec les informations de votre document" })).toBeVisible();

    await expect(page.getByLabel("Raison sociale")).toHaveValue("Atelier Durand");
    await expect(page.getByLabel(/Activité/)).toHaveValue(/25\.62B/);
    await expect(page.getByLabel(/Responsable/)).toHaveValue("Claire Durand, gérante");
    await expect(page.getByLabel("Effectif")).not.toHaveValue("14");
  });

  test("document sans texte lisible : message clair", async ({ page }) => {
    await ouvrir(page, "/reglages");
    await page.getByLabel("Choisir le document…").setInputFiles({ name: "scan.txt", mimeType: "text/plain", buffer: Buffer.from("   \n  ") });
    await expect(page.getByRole("alert").filter({ hasText: "pas de texte lisible" })).toBeVisible();
  });
});
