import { dateDuJour } from "../lib/calculs";
import { donneesDemo, donneesVides } from "../lib/demo";
import { CLE_DONNEES_TEST } from "../lib/mode-test";
import type { Page } from "@playwright/test";
import { expect, ouvrir, test } from "./outils";

// Parcours complets, de bout en bout et à travers plusieurs modules, sans recharger la page : ce
// qui est saisi dans un module doit se retrouver dans les autres (parcours, tableau de bord,
// alertes). Chaque test charge ses propres données de départ.

const charger = (page: Page, donnees: unknown) =>
  page.addInitScript(([cle, valeur]) => ((window as unknown as Record<string, string>)[cle] = valeur), [CLE_DONNEES_TEST, JSON.stringify(donnees)]);
const menu = (page: Page, nom: string | RegExp) => page.getByRole("navigation").getByRole("link", { name: nom }).first().click();
const avancement = async (page: Page) => Number((await page.getByText(/^\d+ %$/).first().innerText()).replace(/\D/g, ""));

test("nouvelle entreprise : du questionnaire au plan d'actions, le parcours avance de lui-même", async ({ page }) => {
  await charger(page, {
    ...donneesVides(),
    entreprise: "Boulangerie Martin",
    fiche: { siret: "", adresse: "", activite: "", effectif: "4 salariés", responsable: "Paul Martin, gérant" },
  });

  // 1. Mon parcours : décrire l'entreprise.
  await ouvrir(page, "/parcours");
  const depart = await avancement(page);
  await page.getByLabel("Secteur d'activité").selectOption({ label: "Métiers de bouche" });
  await page.getByLabel("Effectif").selectOption({ label: "1 à 10 salariés" });
  for (const question of [/intérimaires/, /produits chimiques/, /équipements ou installations/]) {
    await page.getByRole("group", { name: question }).getByText("Oui", { exact: true }).click();
  }
  await expect(page.getByText("Votre parcours est adapté à ces réponses.", { exact: false })).toBeVisible();
  await expect.poll(() => avancement(page)).toBeGreaterThan(depart);
  const apresProfil = await avancement(page);

  // 2. DUERP express : risques et plan d'actions préremplis.
  await menu(page, "DUERP");
  await page.getByRole("link", { name: "⚡ Démarrer le DUERP express" }).click();
  await page.getByRole("button", { name: /Métiers de bouche/ }).click();
  await page.getByRole("checkbox", { name: /Boulangerie et pâtisserie/ }).check();
  await page.getByRole("button", { name: "Continuer →" }).click();
  await page.getByRole("button", { name: "Continuer →" }).click();
  await page.getByRole("button", { name: "Continuer →" }).click();
  await page.getByRole("button", { name: "Ajouter à mon document unique" }).click();
  await expect(page.getByRole("status")).toContainText("risque(s)");
  await page.getByRole("link", { name: "Ouvrir mon DUERP" }).click();
  await expect(page.getByText("Votre document unique est vide")).toHaveCount(0);

  // 3. Plan d'actions : les mesures proposées y sont, avec le responsable de la fiche.
  await menu(page, "Plan d'actions");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByLabel("Statut").first()).toBeVisible();

  // 4. Le parcours a encore avancé, sans rien cocher à la main.
  await menu(page, "Mon parcours");
  await expect.poll(() => avancement(page)).toBeGreaterThan(apresProfil);

  // 5. Le tableau de bord reprend le tout : plus d'assistant de démarrage vide, des risques évalués.
  await menu(page, "Tableau de bord");
  await expect(page.getByText("Risques évalués", { exact: true })).toBeVisible();
});

test("une alerte du tableau de bord se traite jusqu'au bout et disparaît", async ({ page }) => {
  await charger(page, donneesDemo(dateDuJour()));
  await ouvrir(page, "/");
  const alerte = page.getByRole("link", { name: /actions? de prévention en retard/ });
  await expect(alerte).toBeVisible();
  await alerte.click();
  await expect(page).toHaveURL(/\/actions/);

  // Réaliser chaque action en retard depuis le plan d'actions.
  const enRetard = page.locator("tr", { hasText: "⚠ En retard" });
  await expect(enRetard.first()).toBeVisible();
  while ((await enRetard.count()) > 0) {
    const avant = await enRetard.count();
    await enRetard.first().getByLabel("Statut").selectOption("fait");
    await expect(enRetard).toHaveCount(avant - 1);
  }

  // Retour au tableau de bord : l'alerte a disparu, l'indicateur est à zéro.
  await menu(page, "Tableau de bord");
  await expect(page.getByRole("heading", { name: /À traiter/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /actions? de prévention en retard/ })).toHaveCount(0);
});

test("un changement dans une unité, du signalement à la levée de l'alerte", async ({ page }) => {
  await charger(page, donneesDemo(dateDuJour()));
  await ouvrir(page, "/duerp?unite=Bureaux");
  await page.getByRole("button", { name: "Signaler un changement dans « Bureaux »" }).click();
  await page.getByLabel(/Qu'est-ce qui a changé/).fill("Réaménagement des locaux ou du poste");
  await page.getByRole("button", { name: "Marquer ses risques à réexaminer" }).click();

  // Le tableau de bord le signale (le journal, lu en base, n'existe pas en mode de test).
  await menu(page, "Tableau de bord");
  await expect(page.getByRole("link", { name: /à réexaminer après un changement/ })).toBeVisible();

  // Tous les risques de l'unité réexaminés : plus d'alerte.
  await menu(page, "DUERP");
  await page.getByLabel("Filtrer par unité").selectOption("Bureaux");
  const boutons = page.getByRole("button", { name: "✓ Réexaminé" });
  while ((await boutons.count()) > 0) {
    const avant = await boutons.count();
    await boutons.first().click();
    await expect(boutons).toHaveCount(avant - 1);
  }
  await expect(page.getByRole("status").filter({ hasText: "Risques à réexaminer après un changement" })).toHaveCount(0);
  await menu(page, "Tableau de bord");
  await expect(page.getByRole("heading", { name: /À traiter/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /à réexaminer après un changement/ })).toHaveCount(0);
});
