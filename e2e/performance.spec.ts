import { dateDuJour } from "../lib/calculs";
import { CLE_DONNEES_TEST } from "../lib/mode-test";
import { expect, ouvrir, pages, test } from "./outils";
import { donneesVolumineuses } from "./volume";

// Gros client : 500 risques, 200 salariés, 8 000 mouvements d'EPI, 60 causeries signées (900 signatures),
// 120 visites, 150 accueils… Chaque page doit s'afficher
// et réagir à la saisie sans attente perceptible.
const donnees = JSON.stringify(donneesVolumineuses(dateDuJour()));

// Une mesure à la fois : des pages lourdes ouvertes en parallèle fausseraient les durées.
test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(([cle, valeur]) => ((window as unknown as Record<string, string>)[cle] = valeur), [CLE_DONNEES_TEST, donnees]);
});

for (const { chemin } of pages.filter((p) => !p.chemin.startsWith("/legal") && !p.chemin.startsWith("/signaler") && p.chemin !== "/connexion")) {
  test(`affichage rapide de ${chemin}`, async ({ page }) => {
    const debut = Date.now();
    await page.goto(chemin);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 15_000 });
    const duree = Date.now() - debut;
    test.info().annotations.push({ type: "durée", description: `${duree} ms` });
    console.log(`${chemin} : ${duree} ms`);
    expect(duree).toBeLessThan(5000);
  });
}

test("saisie fluide dans un DUERP de 500 risques", async ({ page }) => {
  await ouvrir(page, "/duerp");
  await expect(page.getByText("500 lignes sur 500")).toBeVisible();
  const champ = page.getByRole("combobox", { name: "Danger" }).first();
  await champ.click();
  await champ.press("End");
  // Durée médiane entre une frappe et l'affichage du caractère (la médiane écarte une frappe
  // ralentie par une autre tâche de la machine).
  const duree = await page.evaluate(async () => {
    const champ = document.activeElement as HTMLInputElement;
    const durees: number[] = [];
    for (let i = 0; i < 11; i++) {
      const avant = champ.value;
      const debut = performance.now();
      document.execCommand("insertText", false, "x");
      await new Promise<void>((fin) => {
        const verifier = () => (champ.value !== avant && document.activeElement === champ ? fin() : requestAnimationFrame(verifier));
        verifier();
      });
      await new Promise((fin) => requestAnimationFrame(() => setTimeout(fin)));
      durees.push(performance.now() - debut);
    }
    return durees.sort((a, b) => a - b)[5];
  });
  console.log(`saisie DUERP : ${Math.round(duree)} ms par caractère`);
  expect(duree).toBeLessThan(150);
});
