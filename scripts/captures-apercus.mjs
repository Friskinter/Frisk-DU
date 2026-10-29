// Captures des modules réservés aux abonnés, montrées pendant l'essai gratuit (public/apercus).
// À relancer après un changement visible de ces pages :
//   NEXT_PUBLIC_FRISK_E2E=1 npm run build && npx next start -p 3100   (dans un autre terminal)
//   node scripts/captures-apercus.mjs
import { chromium } from "playwright";

const modules = ["accidents", "formations", "verifications", "produits", "visites", "accueil", "entreprises-exterieures", "penibilite", "epi", "bilans", "rapport"];
const base = process.env.FRISK_URL ?? "http://localhost:3100";

const navigateur = await chromium.launch();
const page = await navigateur.newPage({ viewport: { width: 1100, height: 760 }, locale: "fr-FR", timezoneId: "Europe/Paris" });
await page.route(/supabase\.co/, (r) => r.abort());
for (const m of modules) {
  await page.goto(`${base}/${m}`);
  await page.getByRole("heading", { level: 1 }).waitFor();
  await page.waitForTimeout(500);
  // Le haut de la page seulement (au format de l'aperçu), sans le menu.
  const zone = await page.locator("main").boundingBox();
  await page.screenshot({ path: `public/apercus/${m}.jpg`, type: "jpeg", quality: 72, clip: { x: zone.x, y: zone.y, width: zone.width, height: Math.min(700, zone.height) } });
  console.log(m);
}
await navigateur.close();
