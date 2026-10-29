import { CLE_ABONNEMENT_TEST } from "../lib/mode-test";
import { expect, ouvrir, test, verifierAccessibilite } from "./outils";

const dans = (jours: number) => new Date(Date.now() + jours * 86_400_000).toISOString();
const abonnement = (page: import("@playwright/test").Page, statut: string, essaiFin: string | null) =>
  page.addInitScript(([cle, valeur]) => localStorage.setItem(cle, valeur), [CLE_ABONNEMENT_TEST, JSON.stringify({ statut, essaiFin })]);

test("un visiteur s'inscrit pour un essai gratuit", async ({ page }) => {
  await page.goto("/connexion");
  await page.getByRole("link", { name: "Essai gratuit de 7 jours" }).click();
  await expect(page.getByRole("heading", { name: "Essai gratuit" })).toBeVisible();
  await page.getByLabel("Nom de l'entreprise").fill("Menuiserie Dupont");
  await page.getByLabel("Effectif").selectOption("11 à 49 salariés");
  await page.getByLabel("E-mail professionnel").fill("contact@menuiserie-dupont.fr");
  await page.getByLabel("Mot de passe (10 caractères au moins)").fill("Chantier-2026!");
  const bouton = page.getByRole("button", { name: "Commencer mon essai gratuit" });
  await expect(bouton).toBeDisabled();
  await page.getByRole("checkbox").check();
  await bouton.click();
  await expect(page.getByRole("heading", { name: "Vérifiez votre boîte mail" })).toBeVisible();
  await expect(page.getByText("contact@menuiserie-dupont.fr")).toBeVisible();
});

test.describe("essai gratuit en cours", () => {
  test.beforeEach(async ({ page }) => abonnement(page, "essai", dans(4.5)));

  test("le document unique est ouvert, les autres modules sont en aperçu", async ({ page }) => {
    await ouvrir(page, "/duerp");
    await expect(page.getByRole("status").filter({ hasText: "Essai gratuit" })).toContainText("il reste 5 jours");
    await expect(page.getByRole("link", { name: "Choisir mon abonnement" })).toBeVisible();

    await page.getByRole("complementary").getByRole("link", { name: /Accidents/ }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Accidents et signalement par QR code" })).toBeVisible();
    await expect(page.getByRole("img", { name: /Aperçu/ })).toBeVisible();
    await expect(page.getByRole("link", { name: "Débloquer avec l'abonnement" })).toBeVisible();
    await verifierAccessibilite(page);
  });

  test("pas de version officielle du DUERP pendant l'essai", async ({ page }) => {
    await ouvrir(page, "/duerp");
    await page.getByRole("button", { name: /Versions/ }).click();
    await expect(page.getByText(/se fige avec l'abonnement/)).toBeVisible();
    await expect(page.getByRole("button", { name: /Figer/ })).toHaveCount(0);
  });

  test("identité visuelle réservée aux abonnés", async ({ page }) => {
    await ouvrir(page, "/reglages");
    await expect(page.getByText(/Avec l'abonnement, votre logo/)).toBeVisible();
    await expect(page.getByLabel("Site web de l'entreprise")).toHaveCount(0);
  });

  test("le responsable choisit son offre et part payer chez Stripe", async ({ page }) => {
    let demande: Record<string, unknown> = {};
    await page.route("**/api/abonnement/paiement", async (r) => {
      demande = r.request().postDataJSON();
      await r.fulfill({ json: { url: "/abonnement?paiement=ok" } });
    });
    await ouvrir(page, "/abonnement");
    await expect(page.getByText(/Essai gratuit : 5 jours restants/)).toBeVisible();
    // Effectif de la démonstration : 14 salariés.
    const pe = page.getByRole("button", { name: /11 à 49 salariés/ });
    await expect(pe).toHaveAttribute("aria-pressed", "true");
    await expect(pe).toContainText("590 €");
    await page.getByRole("button", { name: "Mensuel" }).click();
    await expect(pe).toContainText("59 €");
    await page.getByRole("button", { name: /1 à 10 salariés/ }).click();
    await verifierAccessibilite(page);

    const payer = page.getByRole("button", { name: "Payer en ligne" });
    await expect(payer).toBeDisabled();
    await page.getByLabel(/conditions générales de vente/).check();
    await payer.click();
    await expect(page.getByText("Merci !")).toBeVisible();
    expect(demande).toEqual({ entrepriseId: "00000000-0000-0000-0000-000000000000", offre: "tpe", periodicite: "mois", cgv: true });
  });
});

test("essai terminé : lecture seule, données consultables", async ({ page }) => {
  await abonnement(page, "essai", dans(-1));
  await ouvrir(page, "/duerp");
  await expect(page.getByText("Votre essai gratuit est terminé.")).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Danger" }).first()).toBeDisabled();
  await expect(page.getByRole("button", { name: "+ Ajouter un risque" })).toBeDisabled();
  await expect(page.getByRole("button", { name: /Document unique \(PDF\)/ })).toBeEnabled();
  await ouvrir(page, "/reglages");
  await expect(page.getByRole("button", { name: "Télécharger une sauvegarde" })).toBeEnabled();
});

test("paiement refusé : le responsable est invité à mettre à jour son moyen de paiement", async ({ page }) => {
  await abonnement(page, "impaye", null);
  await ouvrir(page, "/");
  await expect(page.getByText("Le dernier paiement n'a pas abouti.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Mettre à jour le paiement" })).toBeVisible();
});

test("abonné : aucun bandeau d'essai, tous les modules ouverts", async ({ page }) => {
  await ouvrir(page, "/accidents");
  await expect(page.getByRole("heading", { level: 1, name: "Accidents et presque-accidents" })).toBeVisible();
  await expect(page.getByText(/Essai gratuit/)).toHaveCount(0);
});
