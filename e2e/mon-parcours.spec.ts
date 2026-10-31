import { donneesVides } from "../lib/demo";
import { CLE_DONNEES_TEST } from "../lib/mode-test";
import { expect, ouvrir, test, verifierAccessibilite } from "./outils";

const nouvelleEntreprise = JSON.stringify({ ...donneesVides(), entreprise: "Menuiserie Nouvelle" });

test.describe("nouvelle entreprise", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(([cle, valeur]) => ((window as unknown as Record<string, string>)[cle] = valeur), [CLE_DONNEES_TEST, nouvelleEntreprise]);
  });

  test("le questionnaire adapte le parcours ; une réponse « non » devient une piste", async ({ page }) => {
    await ouvrir(page, "/parcours");
    await expect(page.getByText("Encore 5 questions pour adapter votre parcours.", { exact: false })).toBeVisible();
    await expect(page.getByText("pas une mesure de conformité", { exact: false })).toBeVisible();
    await verifierAccessibilite(page);

    await page.getByLabel("Secteur d'activité").selectOption({ label: "BTP" });
    await page.getByLabel("Effectif").selectOption({ label: "1 à 10 salariés" });
    const repondre = (question: RegExp, reponse: string) =>
      page.getByRole("group", { name: question }).getByText(reponse, { exact: true }).click();
    await repondre(/intérimaires/, "Oui");
    await repondre(/produits chimiques/, "Non");
    await repondre(/équipements ou installations/, "Je ne sais pas");

    await expect(page.getByText("Votre parcours est adapté à ces réponses.", { exact: false })).toBeVisible();
    // Produits chimiques : passés en piste à vérifier, pas retirés.
    const pistes = page.locator("section", { has: page.getByRole("heading", { name: "Autres pistes à vérifier" }) });
    await expect(pistes.getByText("Faire l'inventaire des produits chimiques")).toBeVisible();
    // BTP : le DUERP express est proposé pour le secteur, les EPI font partie du parcours.
    await expect(page.getByText("Pour le secteur « BTP »", { exact: false })).toBeVisible();
    await expect(page.getByText("Créer le catalogue des équipements de protection")).toBeVisible();
    await expect(page.getByText("Encadrer les interventions d'entreprises extérieures")).toBeVisible();

    // L'assistant du tableau de bord renvoie vers le parcours.
    await page.getByRole("link", { name: /Tableau de bord/ }).click();
    await expect(page.getByRole("link", { name: "Voir mon parcours QHSE complet →" })).toBeVisible();
  });
});

test("entreprise déjà en place : un rappel du parcours sur le tableau de bord", async ({ page }) => {
  await ouvrir(page, "/");
  const rappel = page.getByRole("link", { name: /Mon parcours QHSE : \d+ %/ });
  await expect(rappel).toBeVisible();
  // Une seule étape restante : elle est annoncée comme telle, pas comme « Prochaine étape ».
  await expect(rappel).toContainText("Il vous reste 1 étape : décrire votre entreprise");
  await rappel.click();
  await expect(page.getByText("Dernière étape", { exact: true })).toBeVisible();
});

test.describe("lecture seule", () => {
  test.use({ role: "lecteur" });
  test("un lecteur voit le parcours sans pouvoir modifier le profil", async ({ page }) => {
    await ouvrir(page, "/parcours");
    await expect(page.getByLabel("Secteur d'activité")).toBeDisabled();
  });
});
