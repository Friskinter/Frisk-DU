import { readFileSync } from "node:fs";
import { dateDuJour } from "../lib/calculs";
import { donneesDemo } from "../lib/demo";
import { CLE_DONNEES_TEST } from "../lib/mode-test";
import { expect, JETON_TEST, ouvrir, test, verifierAccessibilite } from "./outils";

const LOGO = readFileSync(`${__dirname}/../tests/fixtures/logo-client.png`);
const LOGO_URL = `data:image/png;base64,${LOGO.toString("base64")}`;
const bronze = (page: import("@playwright/test").Page) =>
  page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--color-bronze").trim());

test("le responsable dépose son logo : l'espace passe à ses couleurs", async ({ page }) => {
  await ouvrir(page, "/reglages");
  const carte = page.locator("section", { has: page.getByRole("heading", { name: "Identité visuelle" }) });
  const avant = await bronze(page);

  await carte.getByLabel("Ou déposez votre logo (PNG, JPEG ou SVG)").setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: LOGO });
  await expect(carte.getByRole("status")).toHaveText(/Logo prêt/);
  // La couleur est tirée du logo (le bleu du rond).
  await expect(carte.getByLabel("Couleur principale")).toHaveValue(/^#[0-9a-f]{6}$/);
  await carte.getByLabel("Couleur principale").fill("#e30613");
  await carte.getByRole("button", { name: "Enregistrer l'identité visuelle" }).click();
  await expect(carte.getByRole("status")).toHaveText("Identité visuelle enregistrée.");

  const menu = page.getByRole("complementary");
  await expect(menu.locator('img[src^="data:image/png"]')).toBeVisible();
  await expect(menu.getByText("Réalisé avec Frisk Plateforme")).toBeVisible();
  expect(await bronze(page)).not.toBe(avant);
  await verifierAccessibilite(page);

  page.once("dialog", (d) => d.accept());
  await carte.getByRole("button", { name: "Revenir à l'apparence Frisk" }).click();
  await expect(menu.locator('img[src^="data:image/png"]')).toHaveCount(0);
  expect(await bronze(page)).toBe(avant);
});

test("le logo et la couleur sont retrouvés sur le site de l'entreprise", async ({ page }) => {
  let demande = "";
  await page.route("**/api/identite", async (r) => {
    demande = r.request().postData() ?? "";
    await r.fulfill({ json: { logos: [LOGO_URL], couleur: "#002b5c", site: "https://www.acme-btp.fr/" } });
  });
  await ouvrir(page, "/reglages");
  const carte = page.locator("section", { has: page.getByRole("heading", { name: "Identité visuelle" }) });
  await carte.getByLabel("Site web de l'entreprise").fill("www.acme-btp.fr");
  await carte.getByRole("button", { name: "Rechercher" }).click();
  await expect(carte.getByRole("status")).toHaveText(/Logo trouvé/);
  expect(JSON.parse(demande)).toEqual({ site: "www.acme-btp.fr" });
  await expect(carte.getByLabel("Couleur principale")).toHaveValue("#002b5c");
  await expect(carte.getByRole("group", { name: "Aperçu" }).locator('img[src^="data:image/png"]').first()).toBeVisible();
  await carte.getByRole("button", { name: "Enregistrer l'identité visuelle" }).click();
  await expect(page.getByRole("complementary").locator('img[src^="data:image/png"]')).toBeVisible();
});

test("site introuvable : message clair et dépôt du logo proposé", async ({ page }) => {
  await page.route("**/api/identite", (r) => r.fulfill({ status: 422, json: { erreur: "Impossible de lire ce site. Vérifiez l'adresse, ou déposez directement votre logo." } }));
  await ouvrir(page, "/reglages");
  const carte = page.locator("section", { has: page.getByRole("heading", { name: "Identité visuelle" }) });
  await carte.getByLabel("Site web de l'entreprise").fill("www.inconnu-xyz.fr");
  await carte.getByRole("button", { name: "Rechercher" }).click();
  await expect(carte.getByRole("status")).toHaveText(/Impossible de lire ce site/);
});

test.describe("couleur très claire ou très foncée", () => {
  for (const couleur of ["#ffeb3b", "#002b5c"]) {
    test(`${couleur} : pages lisibles`, async ({ page }) => {
      const donnees = JSON.stringify({ ...donneesDemo(dateDuJour()), identite: { logo: LOGO_URL, couleur } });
      await page.addInitScript(([cle, valeur]) => ((window as unknown as Record<string, string>)[cle] = valeur), [CLE_DONNEES_TEST, donnees]);
      for (const chemin of ["/", "/duerp", "/actions", "/reglages"]) {
        await ouvrir(page, chemin);
        await verifierAccessibilite(page);
      }
    });
  }
});

test("le formulaire de signalement est aux couleurs de l'entreprise", async ({ page }) => {
  await page.route("**/api/signalement**", (r) =>
    r.fulfill({ json: { entreprise: "ACME BTP", unites: ["Chantier"], identite: { logo: LOGO_URL, couleur: "#002b5c" } } }),
  );
  await ouvrir(page, `/signaler/${JETON_TEST}`);
  await expect(page.getByRole("banner").locator('img[src^="data:image/png"]')).toBeVisible();
  await expect(page.getByRole("banner").getByText("ACME BTP")).toBeVisible();
  await expect(page.getByText("Réalisé avec Frisk Plateforme")).toBeVisible();
  await verifierAccessibilite(page);
});

test.describe("contributeur", () => {
  test.use({ role: "contributeur" });
  test("ne peut pas changer l'identité visuelle", async ({ page }) => {
    await ouvrir(page, "/reglages");
    await expect(page.locator("section", { has: page.getByRole("heading", { name: "Identité visuelle" }) }).getByRole("button", { name: "Rechercher" })).toBeDisabled();
  });
});
