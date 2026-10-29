import { expect, ouvrir, test, verifierAccessibilite } from "./outils";

test("ajouter un risque au document unique", async ({ page }) => {
  await ouvrir(page, "/duerp");
  await expect(page.getByText("11 lignes sur 11")).toBeVisible();
  await page.getByRole("button", { name: "+ Ajouter un risque" }).click();
  await expect(page.getByText("12 lignes sur 12")).toBeVisible();

  const danger = page.getByRole("combobox", { name: "Danger" }).first();
  await danger.fill("Chute de plain-pied");
  await expect(page.getByText("✓ Enregistré").first()).toBeVisible();

  // La cotation recalcule la criticité de la ligne.
  const ligne = page.locator("tr", { has: page.getByRole("combobox", { name: "Danger" }).and(page.locator('[value="Chute de plain-pied"]')) });
  await ligne.getByRole("combobox", { name: "Gravité" }).selectOption("4");
  await ligne.getByRole("combobox", { name: "Fréquence" }).selectOption("4");
  await expect(ligne.getByText("16 · Critique")).toBeVisible();
});

test("télécharger le document unique en PDF", async ({ page }) => {
  await ouvrir(page, "/duerp");
  const telechargement = page.waitForEvent("download");
  await page.getByRole("button", { name: /Document unique \(PDF\)/ }).click();
  const fichier = await telechargement;
  expect(fichier.suggestedFilename()).toMatch(/^Document unique - .+\.pdf$/);
  const chemin = await fichier.path();
  const { size } = await import("node:fs/promises").then((fs) => fs.stat(chemin));
  expect(size).toBeGreaterThan(10_000);
});

test("déclarer un accident du travail", async ({ page }) => {
  await ouvrir(page, "/accidents");
  await page.getByRole("button", { name: "+ Accident" }).click();
  await expect(page.getByRole("heading", { name: "2. Déclaration" })).toBeVisible();
  await page.getByPlaceholder("Quai 2, allée C…").fill("Quai 3");
  await expect(page.getByRole("button", { name: /Accident du travail .*Quai 3/ })).toBeVisible();
  await verifierAccessibilite(page);
});

test("enregistrer une formation", async ({ page }) => {
  await ouvrir(page, "/formations");
  await page.getByRole("button", { name: "+ Formation" }).click();
  await verifierAccessibilite(page);
});

test("préparer et signer un plan de prévention", async ({ page }) => {
  await ouvrir(page, "/entreprises-exterieures");
  await page.getByRole("button", { name: "+ Intervention" }).click();
  await page.getByLabel("Raison sociale").fill("Toitures Lyonnaises");
  await page.getByLabel("Nature des travaux").fill("Réfection de la toiture de l'atelier");
  await page.getByLabel(/chute de hauteur de plus de 3 mètres/).check();
  await expect(page.getByText(/Plan de prévention écrit obligatoire : 1 travail dangereux/)).toBeVisible();
  await expect(page.getByText("Risque 3")).toBeVisible();
  await verifierAccessibilite(page);

  // Signature au doigt ou à la souris.
  const pave = page.getByLabel("Zone de signature").first();
  await pave.scrollIntoViewIfNeeded();
  const zone = (await pave.boundingBox())!;
  await page.mouse.move(zone.x + 20, zone.y + 40);
  await page.mouse.down();
  await page.mouse.move(zone.x + 120, zone.y + 80, { steps: 5 });
  await page.mouse.move(zone.x + 200, zone.y + 30, { steps: 5 });
  await page.mouse.up();
  await page.getByRole("button", { name: "Valider la signature" }).first().click();
  await expect(page.getByText(/^Signé le /).first()).toBeVisible();

  const telechargement = page.waitForEvent("download");
  await page.getByRole("button", { name: /Plan de prévention \(PDF\)/ }).click();
  expect((await telechargement).suggestedFilename()).toMatch(/^Plan de prevention - Toitures Lyonnaises - .+\.pdf$/);
});

test("établir le protocole de sécurité d'un transporteur", async ({ page }) => {
  await ouvrir(page, "/entreprises-exterieures");
  await page.getByRole("tab", { name: /Protocoles de sécurité/ }).click();
  await expect(page.getByRole("button", { name: /Transports Rhône Express/ })).toBeVisible();
  await page.getByRole("button", { name: "+ Protocole" }).click();
  // Les informations de l'entreprise d'accueil sont reprises du dernier protocole.
  await expect(page.getByLabel("Lieu de livraison ou de prise en charge")).toHaveValue("Quais 1 à 3 du bâtiment de réception");
  await page.getByLabel("Raison sociale du transporteur").fill("Messagerie Express");
  await page.getByLabel(/Transport de matières dangereuses/).check();
  await expect(page.getByText(/les précautions liées aux matières dangereuses/)).toBeVisible();
  await verifierAccessibilite(page);

  const telechargement = page.waitForEvent("download");
  await page.getByRole("button", { name: /Protocole de sécurité \(PDF\)/ }).click();
  expect((await telechargement).suggestedFilename()).toMatch(/^Protocole de securite - Messagerie Express - .+\.pdf$/);
});

test("une alerte ouvre directement le protocole concerné", async ({ page }) => {
  await ouvrir(page, "/");
  await page.getByRole("link", { name: /protocole de sécurité à renouveler/ }).click();
  await expect(page.getByRole("tab", { name: /Protocoles de sécurité/ })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("button", { name: "Renouveler pour 12 mois" })).toBeVisible();
});

test.describe("compte en lecture seule", () => {
  test.use({ role: "lecteur" });

  test("le document unique est consultable mais pas modifiable", async ({ page }) => {
    await ouvrir(page, "/duerp");
    await expect(page.getByRole("combobox", { name: "Danger" }).first()).toBeDisabled();
    await expect(page.getByRole("button", { name: "+ Ajouter un risque" })).toBeDisabled();
    // Le PDF reste téléchargeable.
    await expect(page.getByRole("button", { name: /Document unique \(PDF\)/ })).toBeEnabled();
  });
});
