import AxeBuilder from "@axe-core/playwright";
import { expect, test as base, type Page } from "@playwright/test";
import { CLE_ROLE_TEST } from "../lib/mode-test";

export const JETON_TEST = "a".repeat(64);

// Pages de l'espace client, parcourues par les contrôles d'accessibilité et d'affichage mobile.
export const pages = [
  { chemin: "/", titre: "Tableau de bord" },
  { chemin: "/duerp", titre: "Document unique (DUERP)" },
  { chemin: "/actions", titre: "Plan d'actions" },
  { chemin: "/accidents", titre: "Accidents et presque-accidents" },
  { chemin: "/formations", titre: "Formations et habilitations" },
  { chemin: "/verifications", titre: "Vérifications périodiques" },
  { chemin: "/produits", titre: "Produits chimiques" },
  { chemin: "/entreprises-exterieures", titre: "Entreprises extérieures" },
  { chemin: "/epi", titre: null },
  { chemin: "/penibilite", titre: null },
  { chemin: "/bilans", titre: null },
  { chemin: "/reglages", titre: null },
  { chemin: "/compte", titre: "Mon compte" },
  { chemin: "/import", titre: null },
  { chemin: "/legal/mentions", titre: "Mentions légales" },
  { chemin: "/legal/confidentialite", titre: "Politique de confidentialité" },
  { chemin: "/connexion", titre: "Connexion" },
  { chemin: `/signaler/${JETON_TEST}`, titre: "Signaler un accident ou un danger" },
];

// Aucune requête vers Supabase : le mode test fonctionne hors ligne, et un test ne doit jamais
// toucher la vraie base.
export const test = base.extend<{ role: string }>({
  role: ["responsable", { option: true }],
  page: async ({ page, role }, utiliser) => {
    await page.route(/supabase\.co/, (r) => r.abort());
    // Le serveur de signalement a besoin de la clé secrète Supabase : on simule ses réponses.
    await page.route("**/api/signalement**", (r) =>
      r.request().method() === "GET"
        ? r.fulfill({ json: { entreprise: "Logistique Démo SAS", unites: ["Quai de réception", "Zone de stockage"] } })
        : r.fulfill({ json: { ok: true } }),
    );
    await page.addInitScript(([cle, valeur]) => localStorage.setItem(cle, valeur), [CLE_ROLE_TEST, role]);
    const erreurs: string[] = [];
    page.on("pageerror", (e) => erreurs.push(e.message));
    await utiliser(page);
    expect(erreurs, "erreurs JavaScript dans la page").toEqual([]);
  },
});

export { expect };

export async function ouvrir(page: Page, chemin: string) {
  await page.goto(chemin);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
}

export async function verifierAccessibilite(page: Page) {
  const resultat = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const resume = resultat.violations.map((v) => `${v.id} (${v.nodes.length}) : ${v.nodes[0].target.join(" ")}`);
  expect(resume, "problèmes d'accessibilité").toEqual([]);
}
