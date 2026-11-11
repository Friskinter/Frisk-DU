import type { Locator, Page } from "@playwright/test";
import { ouvrir, test } from "./outils";

// Vidéo de présentation de Frisk Plateforme pour les nouveaux venus (2 min 45, sous-titrée, sans son),
// filmée sur les données de démonstration. Ce n'est pas un test : elle ne tourne qu'à la demande.
//   VIDEO_PRESENTATION=1 npx playwright test e2e/video-presentation.spec.ts --project=ordinateur
// La vidéo est dans test-results/…/video.webm. À refilmer quand les écrans changent.
test.skip(!process.env.VIDEO_PRESENTATION, "Vidéo de présentation : seulement à la demande (VIDEO_PRESENTATION=1).");
test.use({ viewport: { width: 1280, height: 720 }, video: { mode: "on", size: { width: 1280, height: 720 } } });
test.setTimeout(10 * 60_000);

const decor = () => {
  const w = window as unknown as Record<string, unknown>;
  const installer = () => {
    if (document.getElementById("video-curseur")) return;
    const style = document.createElement("style");
    style.textContent = `
      #video-curseur{position:fixed;z-index:2147483647;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;
        background:rgba(176,141,87,.55);border:2px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.35);pointer-events:none;transition:transform .15s}
      #video-curseur.clic{transform:scale(.6)}
      body:has(#video-carton) #video-curseur{opacity:0}
      #video-legende{position:fixed;z-index:2147483646;left:50%;bottom:28px;transform:translateX(-50%);max-width:980px;width:max-content;
        padding:14px 26px;border-radius:6px;background:rgba(12,11,10,.88);color:#fff;font:500 21px/1.4 system-ui,sans-serif;
        text-align:center;pointer-events:none;transition:opacity .35s;box-shadow:0 6px 24px rgba(0,0,0,.3)}
      #video-legende small{display:block;margin-bottom:2px;font-size:13px;letter-spacing:.18em;text-transform:uppercase;color:#d8bd8a}
      #video-carton{position:fixed;inset:0;z-index:2147483645;display:flex;flex-direction:column;align-items:center;justify-content:center;
        background:#0f0e0c;color:#f7f4ef;font-family:Georgia,serif;text-align:center;transition:opacity .6s}
      #video-carton h1{font-size:52px;letter-spacing:.12em;margin:0} #video-carton h1 span{color:#c9a96e}
      #video-carton p{font:400 24px/1.5 system-ui,sans-serif;color:#d9cfc1;margin:18px 0 0;max-width:820px}
      #video-repere{position:fixed;z-index:2147483644;border:3px solid #c9a96e;border-radius:6px;pointer-events:none;
        box-shadow:0 0 0 9999px rgba(12,11,10,.25);transition:all .3s}`;
    document.head.appendChild(style);
    const curseur = document.createElement("div");
    curseur.id = "video-curseur";
    document.body.appendChild(curseur);
    document.addEventListener("mousemove", (e) => {
      curseur.style.left = `${e.clientX}px`;
      curseur.style.top = `${e.clientY}px`;
    }, true);
    document.addEventListener("mousedown", () => curseur.classList.add("clic"), true);
    document.addEventListener("mouseup", () => curseur.classList.remove("clic"), true);
  };
  w.__videoInstaller = installer;
  document.addEventListener("DOMContentLoaded", installer);
};

async function legende(page: Page, titre: string, texte: string, duree = 4500) {
  await page.evaluate(([t, x]) => {
    (window as unknown as { __videoInstaller: () => void }).__videoInstaller();
    let el = document.getElementById("video-legende");
    if (!el) {
      el = document.createElement("div");
      el.id = "video-legende";
      document.body.appendChild(el);
    }
    el.innerHTML = `<small>${t}</small>${x}`;
    el.style.opacity = "1";
  }, [titre, texte]);
  await page.waitForTimeout(duree);
}

async function sansLegende(page: Page) {
  await page.evaluate(() => {
    const el = document.getElementById("video-legende");
    if (el) el.style.opacity = "0";
    document.getElementById("video-repere")?.remove();
  });
}

async function carton(page: Page, html: string, duree: number) {
  await page.evaluate((h) => {
    (window as unknown as { __videoInstaller: () => void }).__videoInstaller();
    const el = document.createElement("div");
    el.id = "video-carton";
    el.innerHTML = h;
    document.body.appendChild(el);
  }, html);
  await page.waitForTimeout(duree);
  await page.evaluate(() => {
    const el = document.getElementById("video-carton");
    if (el) el.style.opacity = "0";
  });
  await page.waitForTimeout(700);
  await page.evaluate(() => document.getElementById("video-carton")?.remove());
}

// Encadre un élément de la page pour attirer le regard.
async function reperer(page: Page, cible: Locator) {
  await cible.scrollIntoViewIfNeeded();
  const b = await cible.boundingBox();
  if (!b) return;
  await page.evaluate((r) => {
    let el = document.getElementById("video-repere");
    if (!el) {
      el = document.createElement("div");
      el.id = "video-repere";
      document.body.appendChild(el);
    }
    Object.assign(el.style, { left: `${r.x - 6}px`, top: `${r.y - 6}px`, width: `${r.width + 12}px`, height: `${r.height + 12}px` });
  }, b);
}

async function viser(page: Page, cible: Locator) {
  await cible.scrollIntoViewIfNeeded();
  const b = await cible.boundingBox();
  if (b) await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 25 });
  await page.waitForTimeout(350);
}

async function cliquer(page: Page, cible: Locator) {
  await viser(page, cible);
  await cible.click();
  await page.waitForTimeout(900);
}


const menu = (page: Page, nom: RegExp) => page.getByRole("navigation").getByRole("link", { name: nom });

test("vidéo de présentation", async ({ page }) => {
  await page.addInitScript(decor);
  await ouvrir(page, "/");
  await page.waitForLoadState("networkidle");
  await page.mouse.move(640, 360);

  await carton(
    page,
    `<h1>FRISK <span>PLATEFORME</span></h1><p>La prévention des risques professionnels, simplement.<br>Découvrez l'essentiel en quelques minutes.</p>`,
    5000,
  );

  // 1. Tableau de bord
  await legende(page, "Tableau de bord", "Chaque jour, commencez ici : Frisk Plateforme vous montre ce qui demande votre attention.", 5000);
  await reperer(page, page.locator("main").getByText(/urgen/i).first());
  await legende(page, "Tableau de bord", "Les urgences d'abord, puis les points à traiter. Chaque alerte ouvre directement l'élément concerné.", 5500);
  await sansLegende(page);
  await page.mouse.wheel(0, 500);
  await page.waitForTimeout(1200);
  await legende(page, "Tableau de bord", "Plus bas : les prochaines échéances (formations, vérifications, actions…) pour anticiper.", 5000);
  await page.mouse.wheel(0, -2000);
  await sansLegende(page);

  // 2. Le menu
  await reperer(page, page.getByRole("navigation"));
  await legende(page, "Le menu", "Le menu est rangé en quatre groupes : <b>Piloter</b>, <b>Évaluer</b>, <b>Suivre</b> et <b>Salariés</b>.", 5500);
  await sansLegende(page);

  // 3. Mon parcours
  await cliquer(page, menu(page, /Mon parcours/));
  await legende(page, "Mon parcours", "Vous démarrez ? « Mon parcours » vous guide étape par étape, selon le profil de votre entreprise.", 6000);
  await sansLegende(page);

  // 4. DUERP
  await cliquer(page, menu(page, /DUERP/));
  await legende(page, "Document unique (DUERP)", "Le document unique : un risque par ligne, rangé par unité de travail, avec sa cotation et ses actions.", 6000);
  await sansLegende(page);
  await cliquer(page, page.getByRole("link", { name: /^Ouvrir la fiche du risque/ }).first());
  await legende(page, "Fiche du risque", "La fiche du risque réunit tous les champs. Tout est enregistré automatiquement, sans bouton « Enregistrer ».", 6000);
  await sansLegende(page);
  await page.getByRole("dialog").locator("fieldset").hover();
  await page.mouse.wheel(0, 400);
  await page.waitForTimeout(1500);
  await cliquer(page, page.getByRole("button", { name: "Fermer la fiche" }));

  // 5. Plan d'actions
  await cliquer(page, menu(page, /Plan d'actions/));
  await legende(page, "Plan d'actions", "Chaque risque débouche sur des actions de prévention, avec une échéance et un responsable.", 5500);
  const confier = page.getByLabel("Confier l'action à un utilisateur").first();
  await reperer(page, confier);
  await legende(page, "Plan d'actions", "Confiez une action à un collègue : elle apparaît dans sa page « Mes actions » et dans son e-mail du lundi.", 6000);
  await sansLegende(page);

  // 6. Accidents et signalement
  await cliquer(page, menu(page, /Accidents/));
  await legende(page, "Accidents", "Le registre des accidents et presque-accidents : déclaration, analyse des causes, indicateurs.", 5500);
  await legende(page, "Signalement terrain", "Vos salariés peuvent signaler un danger depuis leur téléphone, sans compte, grâce à un QR code affiché dans l'entreprise.", 6000);
  await sansLegende(page);

  // 7. Visites sur le terrain
  await cliquer(page, menu(page, /Visites et audits/));
  await legende(page, "Visites et audits", "Faites le tour du terrain sur tablette ou téléphone, avec une grille de contrôle.", 5000);
  await sansLegende(page);
  const grille = page.getByLabel("Nouvelle visite avec la grille");
  await viser(page, grille);
  await grille.selectOption({ label: "Visite sécurité générale" });
  await cliquer(page, page.getByRole("button", { name: "Commencer la visite" }));
  const point = page.getByRole("group", { name: /^Résultat/ }).first();
  await cliquer(page, point.getByRole("button", { name: /Conforme/ }).first());
  await cliquer(page, page.getByRole("group", { name: /^Résultat/ }).nth(1).getByRole("button", { name: /Non conforme/ }));
  await legende(page, "Visites et audits", "Un point non conforme devient une action du plan en un clic. Et sans réseau, la saisie est gardée sur l'appareil.", 6500);
  await sansLegende(page);

  // 8. Salariés
  await cliquer(page, menu(page, /^Salariés$/));
  await legende(page, "Salariés", "Une fiche par salarié : formations, EPI remis, accueil sécurité, expositions, accidents.", 5000);
  await sansLegende(page);
  await cliquer(page, page.getByRole("link", { name: /Leroy M\./ }));
  await legende(page, "Fiche salarié", "Tout est réuni sur une page, avec les points d'attention, et se télécharge en PDF pour un contrôle.", 6000);
  await sansLegende(page);
  await page.mouse.wheel(0, 450);
  await page.waitForTimeout(1500);
  await page.mouse.wheel(0, -1000);

  // 9. Formations et EPI
  await cliquer(page, menu(page, /Formations/));
  await legende(page, "Formations", "Les habilitations et formations de chacun, avec une alerte avant leur expiration.", 5000);
  await cliquer(page, menu(page, /EPI & stocks/));
  await legende(page, "EPI & stocks", "Les remises d'équipements signées sur l'écran, et le stock à commander, taille par taille.", 5000);
  await sansLegende(page);

  // 10. Recherche
  await legende(page, "Rechercher", "Pour tout retrouver : le champ « Rechercher » en haut du menu, ou Ctrl + K.", 4000);
  await cliquer(page, page.getByRole("button", { name: /Rechercher…/ }));
  await sansLegende(page);
  await page.getByRole("dialog").getByRole("combobox").pressSequentially("chariot", { delay: 140 });
  await page.waitForTimeout(1200);
  await legende(page, "Rechercher", "Salariés, risques, actions, équipements, produits… un clic ouvre directement l'élément.", 5500);
  await sansLegende(page);
  await page.keyboard.press("Escape");

  // 11. Enregistrement et e-mails
  await cliquer(page, menu(page, /Tableau de bord/));
  await reperer(page, page.getByText("✓ Enregistré"));
  await legende(page, "Toujours à jour", "Tout est enregistré en ligne et partagé en direct avec vos collègues. Chaque lundi, un e-mail résume ce qui vous attend.", 6500);
  await sansLegende(page);

  await carton(
    page,
    `<h1>FRISK <span>PLATEFORME</span></h1><p>Pour bien démarrer : ouvrez <b>Mon parcours</b>,<br>il vous indique la prochaine étape.<br><br>Bonne prise en main !</p>`,
    6000,
  );
});

