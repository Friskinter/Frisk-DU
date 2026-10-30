import { dateDuJour } from "../lib/calculs";
import { donneesDemo } from "../lib/demo";
import { CLE_DONNEES_TEST } from "../lib/mode-test";
import { expect, ouvrir, test } from "./outils";

// Données de démonstration figées pour tout le test : les identifiants restent les mêmes d'une page à
// l'autre (sinon chaque chargement les recrée).
const d = donneesDemo(dateDuJour());
const donnees = JSON.stringify(d);

test.beforeEach(async ({ page }) => {
  await page.addInitScript(([cle, valeur]) => ((window as unknown as Record<string, string>)[cle] = valeur), [CLE_DONNEES_TEST, donnees]);
});

test("une adresse ?action=, ?equipement=, ?produit= ou ?article= met l'élément en évidence", async ({ page }) => {
  const action = d.actions[0].id;
  await ouvrir(page, `/actions?action=${action}`);
  await expect(page.locator(`#cible-${action}`)).toHaveClass(/outline-bronze/);

  // Vérifications et produits : la fiche de l'élément visé est déjà ouverte.
  const equipement = d.equipements[0].id;
  await ouvrir(page, `/verifications?equipement=${equipement}`);
  await expect(page.locator(`#cible-${equipement}`)).toHaveClass(/outline-bronze/);
  await expect(page.locator(`#cible-${equipement} [aria-expanded="true"]`)).toBeVisible();

  const produit = d.produits.find((p) => p.actif)!.id;
  await ouvrir(page, `/produits?produit=${produit}`);
  await expect(page.locator(`#cible-${produit} [aria-expanded="true"]`)).toBeVisible();

  // EPI : ligne de stock de l'article visé, ou onglet demandé.
  const article = d.articles[0].id;
  await ouvrir(page, `/epi?article=${article}`);
  await expect(page.locator(`#cible-${article}`)).toHaveClass(/outline-bronze/);
  await ouvrir(page, "/epi?onglet=fiches");
  await expect(page.getByRole("tab", { name: "Fiches salariés" })).toHaveAttribute("aria-selected", "true");
});

test("une adresse ?formation= ouvre le registre sur la ligne visée", async ({ page }) => {
  const formation = d.formations[0].id;
  await ouvrir(page, `/formations?formation=${formation}`);
  await expect(page.getByRole("button", { name: "Registre des formations" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(`#cible-${formation}`)).toHaveClass(/outline-bronze/);
});
