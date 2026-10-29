import type { Page } from "@playwright/test";
import { expect, ouvrir, test, verifierAccessibilite } from "./outils";

async function signer(page: Page) {
  const pave = page.getByLabel("Zone de signature").first();
  await pave.scrollIntoViewIfNeeded();
  const zone = (await pave.boundingBox())!;
  await page.mouse.move(zone.x + 20, zone.y + 40);
  await page.mouse.down();
  await page.mouse.move(zone.x + 120, zone.y + 80, { steps: 5 });
  await page.mouse.move(zone.x + 200, zone.y + 30, { steps: 5 });
  await page.mouse.up();
}

test("accueillir un intérimaire : points abordés, risques du poste, signature, fiche PDF", async ({ page }) => {
  await ouvrir(page, "/accueil");
  await page.getByLabel("Nouvel arrivant").selectOption({ label: "Intérimaire, stagiaire… (hors liste)" });
  await page.getByRole("button", { name: "+ Accueil" }).click();
  await page.getByLabel(/Nom et, le cas échéant/).fill("Julie R. (agence Travail Temporaire)");
  await page.getByLabel("Contrat").selectOption("interim");
  await page.getByLabel("Unité de travail").selectOption("Quai de réception");
  await expect(page.getByText("Chute de hauteur").first()).toBeVisible();
  await page.getByLabel(/Poste présentant des risques particuliers/).check();
  await expect(page.getByText(/formation renforcée à la sécurité obligatoire/)).toBeVisible();
  await page.getByRole("button", { name: "Tout cocher" }).click();
  await expect(page.getByText("Points abordés (12/12)")).toBeVisible();
  await verifierAccessibilite(page);

  await signer(page);
  await page.getByRole("button", { name: "Valider la signature" }).click();
  await expect(page.getByText(/^Signé le /)).toBeVisible();
  await expect(page.getByRole("button", { name: /Julie R\..*Fait/ })).toBeVisible();

  const telechargement = page.waitForEvent("download");
  await page.getByRole("button", { name: /Fiche d'accueil \(PDF\)/ }).click();
  expect((await telechargement).suggestedFilename()).toBe("Accueil securite - Julie R. (agence Travail Temporaire).pdf");
});

test("animer une causerie : participants d'un service, émargement, feuille PDF", async ({ page }) => {
  await ouvrir(page, "/accueil");
  await page.getByRole("tab", { name: "Causeries sécurité" }).click();
  await page.getByLabel("Nouvelle causerie sur le thème").selectOption("Port des EPI");
  await page.getByRole("button", { name: "+ Causerie" }).click();
  await expect(page.getByLabel("Messages clés")).toHaveValue(/Les EPI du poste sont obligatoires/);
  await page.getByRole("button", { name: "Tout le service" }).nth(1).click();
  await expect(page.getByText("Participants et émargement (3)")).toBeVisible();
  await verifierAccessibilite(page);

  await page.getByRole("button", { name: "Faire signer" }).first().click();
  await signer(page);
  await page.getByRole("button", { name: /Valider la signature de/ }).click();
  await expect(page.getByRole("img", { name: /Signature de/ })).toHaveCount(1);
  await expect(page.getByRole("button", { name: /Port des EPI.*1\/3 signé/ })).toBeVisible();

  const telechargement = page.waitForEvent("download");
  await page.getByRole("button", { name: /Feuille d'émargement \(PDF\)/ }).click();
  expect((await telechargement).suggestedFilename()).toMatch(/^Causerie - Port des EPI - \d{4}-\d{2}-\d{2}\.pdf$/);
});

test("l'alerte d'accueil manquant ouvre la fiche de l'intérimaire", async ({ page }) => {
  await ouvrir(page, "/");
  await page.getByRole("link", { name: /nouvel arrivant sans accueil sécurité/ }).click();
  await expect(page.getByLabel(/Nom et, le cas échéant/)).toHaveValue("Thomas B. (agence Intérim Plus)");
});
