import { expect, JETON_TEST, ouvrir, test, verifierAccessibilite } from "./outils";

// Image PNG d'un pixel, comme une photo prise par le téléphone.
const PIXEL = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

test("un salarié signale un presque-accident avec une photo", async ({ page }) => {
  let envoi = "";
  await page.route("**/api/signalement", async (r) => {
    envoi = r.request().postDataBuffer()?.toString("latin1") ?? "";
    await r.fulfill({ json: { ok: true } });
  });
  await ouvrir(page, `/signaler/${JETON_TEST}`);
  await expect(page.getByRole("banner").getByText("Logistique Démo SAS")).toBeVisible();

  await page.getByRole("radio", { name: /Un presque-accident/ }).check();
  await page.getByLabel("Où ?").selectOption("Zone de stockage");
  await page.getByLabel("Endroit précis").fill("Allée B");
  await page.getByLabel("Que s'est-il passé ?").fill("Une palette a basculé du rack, personne en dessous.");
  await page.locator('input[type="file"]').setInputFiles({ name: "photo.png", mimeType: "image/png", buffer: PIXEL });
  await expect(page.getByRole("img", { name: "Photo 1" })).toBeVisible();
  await verifierAccessibilite(page);

  await page.getByRole("button", { name: "Envoyer le signalement" }).click();
  await expect(page.getByRole("heading", { name: "Merci, c'est envoyé" })).toBeVisible();
  expect(envoi).toContain(JETON_TEST);
  expect(envoi).toContain("presque-accident");
  expect(envoi).toContain("Zone de stockage");
  expect(envoi).toContain('name="photos"');
});

test("le formulaire signale un accident : questions sur la blessure", async ({ page }) => {
  await ouvrir(page, `/signaler/${JETON_TEST}`);
  await expect(page.getByLabel("Quelle blessure ?")).toHaveCount(0);
  await page.getByRole("radio", { name: /Un accident/ }).check();
  await expect(page.getByLabel("Quelle blessure ?")).toBeVisible();
  await expect(page.getByRole("link", { name: "112" })).toHaveAttribute("href", "tel:112");
});

test("lien désactivé ou erroné : message clair", async ({ page }) => {
  await page.route("**/api/signalement**", (r) => r.fulfill({ status: 404, json: { erreur: "Ce lien de signalement n'est plus valable." } }));
  await ouvrir(page, `/signaler/${JETON_TEST}`);
  await expect(page.getByRole("heading", { name: "Lien indisponible" })).toBeVisible();
});

test("le responsable affiche le QR code et télécharge l'affiche", async ({ page }) => {
  await ouvrir(page, "/accidents");
  await page.getByRole("button", { name: "📱 Signalement par les salariés" }).click();
  await expect(page.getByRole("img", { name: "QR code du lien de signalement" })).toBeVisible();
  await expect(page.getByText(`/signaler/${"0".repeat(64)}`)).toBeVisible();
  await verifierAccessibilite(page);

  const telechargement = page.waitForEvent("download");
  await page.getByRole("button", { name: /Affiche à imprimer/ }).click();
  expect((await telechargement).suggestedFilename()).toBe("Affiche signalement - Logistique Demo SAS.pdf");
});

test("le signalement reçu apparaît au registre, à compléter", async ({ page }) => {
  await ouvrir(page, "/accidents");
  await page.getByRole("button", { name: /Un luminaire pend/ }).click();
  await expect(page.getByText(/Signalé depuis le terrain par/)).toBeVisible();
  await expect(page.getByText("Karim, préparateur")).toBeVisible();
  await verifierAccessibilite(page);
});
