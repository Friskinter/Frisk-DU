import { donneesVides } from "../lib/demo";
import { CLE_ABONNEMENT_TEST, CLE_DONNEES_TEST } from "../lib/mode-test";
import { expect, ouvrir, test, verifierAccessibilite } from "./outils";

const nouvelleEntreprise = JSON.stringify({ ...donneesVides(), entreprise: "Boulangerie Martin", fiche: { siret: "", adresse: "", activite: "", effectif: "4 salariés", responsable: "Paul Martin, gérant" } });

test.describe("DUERP express", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(([cle, valeur]) => ((window as unknown as Record<string, string>)[cle] = valeur), [CLE_DONNEES_TEST, nouvelleEntreprise]);
  });

  test("un nouveau client prépare son DUERP et son plan d'actions en quelques clics", async ({ page }) => {
    await ouvrir(page, "/duerp");
    await page.getByRole("link", { name: "⚡ Démarrer le DUERP express" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "DUERP express" })).toBeVisible();
    await verifierAccessibilite(page);

    await page.getByRole("button", { name: /Boulangerie et pâtisserie/ }).click();
    // Unités : pas de vente dans ce fournil de production, 3 boulangers au fournil.
    await page.getByRole("checkbox", { name: "Vente" }).uncheck();
    await page.getByRole("spinbutton").first().fill("3");
    await page.getByRole("button", { name: "Continuer →" }).click();

    // Risques : la farine est déjà en partie maîtrisée.
    await expect(page.getByText("Pesée et pétrissage de la farine")).toBeVisible();
    await expect(page.getByText("Vente au comptoir debout")).toHaveCount(0);
    await page.getByRole("checkbox", { name: "Pétrins à couvercle" }).check();
    await page.getByRole("checkbox", { name: /Chambre froide et surgélateur/ }).uncheck();
    await verifierAccessibilite(page);
    await page.getByRole("button", { name: "Continuer →" }).click();

    // Plan d'actions proposé, avec le responsable de la fiche entreprise.
    await expect(page.getByLabel("Responsable des actions")).toHaveValue("Paul Martin, gérant");
    await expect(page.getByText("Pétrins à couvercle")).toHaveCount(0);
    await expect(page.getByText("Masque FFP2 pour les tâches poussiéreuses")).toBeVisible();
    await verifierAccessibilite(page);
    await page.getByRole("button", { name: "Ajouter à mon document unique" }).click();

    await expect(page.getByRole("status")).toContainText("risque(s)");
    await page.getByRole("link", { name: "Ouvrir mon DUERP" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Document unique (DUERP)" })).toBeVisible();
    await expect(page.getByText("Votre document unique est vide")).toHaveCount(0);
  });

  test("fonctionne pendant l'essai gratuit", async ({ page }) => {
    await page.addInitScript(([cle, valeur]) => localStorage.setItem(cle, valeur), [
      CLE_ABONNEMENT_TEST,
      JSON.stringify({ statut: "essai", essaiFin: new Date(Date.now() + 5 * 86_400_000).toISOString() }),
    ]);
    await ouvrir(page, "/duerp-express");
    await page.getByRole("button", { name: /Garage automobile/ }).click();
    await page.getByRole("button", { name: "Continuer →" }).click();
    await page.getByRole("button", { name: "Continuer →" }).click();
    await page.getByRole("button", { name: "Ajouter à mon document unique" }).click();
    await expect(page.getByRole("status").filter({ hasText: "ajouté" })).toBeVisible();
    await expect(page.getByText("Modification refusée")).toHaveCount(0);
  });
});

test.describe("lecteur", () => {
  test.use({ role: "lecteur" });
  test("ne peut pas lancer le DUERP express", async ({ page }) => {
    await page.goto("/duerp-express");
    await expect(page.getByText("Seul un responsable de l'entreprise peut préparer le document unique.")).toBeVisible();
  });
});
