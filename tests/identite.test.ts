import { describe, expect, it, vi } from "vitest";
import {
  adresseSite,
  candidatsLogo,
  contraste,
  couleurDominante,
  couleurDuSite,
  lireCouleur,
  logoValide,
  marqueDocuments,
  palette,
  variablesCouleur,
  variablesTheme,
} from "@/lib/identite";
import { calculerOperations } from "@/lib/operations";
import { donneesDemo } from "@/lib/demo";

vi.mock("server-only", () => ({}));
const { adresseInterdite, formatImage, identiteDuSite } = await import("@/lib/identite-serveur");

const ENCRE = "#0c0b0a";
const MARBRE = "#ece6dc";

describe("couleurs de l'entreprise", () => {
  it("restent lisibles quelle que soit la couleur choisie", () => {
    for (const couleur of ["#ffeb3b", "#ffffff", "#000000", "#002b5c", "#e30613", "#00a651", "#b08d57", "#7f7f7f"]) {
      const p = palette(couleur);
      expect(contraste(p.accent, ENCRE), `${couleur} : bouton`).toBeGreaterThanOrEqual(4.5);
      expect(contraste(p.clair, ENCRE), `${couleur} : menu`).toBeGreaterThanOrEqual(7);
      expect(contraste(p.fonce, MARBRE), `${couleur} : texte`).toBeGreaterThanOrEqual(4.5);
      expect(contraste(p.fonce, "#ffffff"), `${couleur} : texte sur blanc`).toBeGreaterThanOrEqual(4.5);
      expect(contraste(p.fonce, p.marbre), `${couleur} : texte sur encadré teinté`).toBeGreaterThanOrEqual(4.5);
      expect(contraste(p.clair, p.menu), `${couleur} : texte clair du menu`).toBeGreaterThanOrEqual(4.5);
      expect(contraste("#ec835a", p.menu), `${couleur} : alerte du menu`).toBeGreaterThanOrEqual(4.5);
      expect(contraste("#ffffff", p.menu), `${couleur} : blanc sur le menu`).toBeGreaterThanOrEqual(7);
      expect(contraste("#6b645b", p.marbre), `${couleur} : gris sur encadré`).toBeGreaterThanOrEqual(4.5);
      expect(contraste("#6b645b", p.ivoire), `${couleur} : gris sur la page`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("teintent le menu et les fonds avec la couleur de l'entreprise", () => {
    const p = palette("#002b5c");
    expect(p.menu).not.toBe("#0c0b0a");
    expect(p.ivoire).not.toBe("#ffffff");
    const [r, , b] = [1, 3, 5].map((i) => parseInt(p.menu.slice(i, i + 2), 16));
    expect(b).toBeGreaterThan(r); // le menu reste bleu
  });

  it("gardent la teinte choisie quand elle est déjà lisible", () => {
    expect(palette("#ffeb3b").accent).toBe("#ffeb3b");
    expect(palette("#002b5c").fonce).toBe("#002b5c");
  });

  it("ne remplacent le bronze de Frisk que si une couleur est choisie", () => {
    expect(variablesCouleur(undefined)).toBeNull();
    expect(variablesCouleur({ couleur: "rouge" })).toBeNull();
    expect(Object.keys(variablesCouleur({ couleur: "#002b5c" })!)).toEqual(variablesTheme);
  });

  it("lit les écritures courantes d'une couleur", () => {
    expect(lireCouleur("#1F5FA8")).toBe("#1f5fa8");
    expect(lireCouleur("abc")).toBe("#aabbcc");
    expect(lireCouleur("rgb(31, 95, 168)")).toBe("#1f5fa8");
    expect(lireCouleur("bleu")).toBeNull();
    expect(lireCouleur("rgb(300, 0, 0)")).toBeNull();
  });
});

describe("adresse du site", () => {
  it("accepte une adresse tapée sans https", () => {
    expect(adresseSite("www.acme-btp.fr")?.href).toBe("https://www.acme-btp.fr/");
    expect(adresseSite(" https://acme-btp.fr/contact#plan ")?.href).toBe("https://acme-btp.fr/contact");
  });

  it("refuse ce qui n'est pas un site web", () => {
    for (const x of ["", "acme", "ftp://acme.fr", "javascript:alert(1)", "file:///etc/passwd", "https://moi:secret@acme.fr", "acme btp.fr"]) {
      expect(adresseSite(x), x).toBeNull();
    }
  });
});

describe("recherche du logo dans la page", () => {
  const base = new URL("https://www.acme-btp.fr/accueil");
  const html = `<!doctype html><html><head>
    <meta name="theme-color" content="#1F5FA8">
    <link rel="icon" href="/favicon-32.png" sizes="32x32">
    <link rel="apple-touch-icon" href="/apple-180.png" sizes="180x180">
    <meta property="og:image" content="https://cdn.acme-btp.fr/banniere.jpg">
    <script type="application/ld+json">{"@type":"Organization","logo":{"@type":"ImageObject","url":"https:\\/\\/www.acme-btp.fr\\/img\\/logo-officiel.svg"}}</script>
  </head><body>
    <img src="/img/chantier.jpg" alt="Chantier">
    <a href="/"><img class="site-logo" src="img/logo.png" alt="ACME BTP"></a>
  </body></html>`;

  it("classe les images de la plus probable à la moins probable", () => {
    expect(candidatsLogo(html, base)).toEqual([
      "https://www.acme-btp.fr/img/logo-officiel.svg",
      "https://www.acme-btp.fr/img/logo.png",
      "https://www.acme-btp.fr/apple-180.png",
      "https://www.acme-btp.fr/favicon-32.png",
      "https://cdn.acme-btp.fr/banniere.jpg",
      "https://www.acme-btp.fr/favicon.ico",
    ]);
  });

  it("ignore les images intégrées et les adresses non web", () => {
    const x = candidatsLogo(`<img class="logo" src="data:image/png;base64,AAAA"><link rel="icon" href="javascript:alert(1)">`, base);
    expect(x).toEqual(["https://www.acme-btp.fr/favicon.ico"]);
  });

  it("reprend la couleur déclarée par le site, sauf si elle est neutre", () => {
    expect(couleurDuSite(html)).toBe("#1f5fa8");
    expect(couleurDuSite(`<meta name="theme-color" content="#ffffff">`)).toBeNull();
    expect(couleurDuSite("<p>rien</p>")).toBeNull();
  });
});

describe("couleur dominante d'un logo", () => {
  const pixels = (...groupes: [number, [number, number, number, number]][]) =>
    groupes.flatMap(([n, px]) => Array.from({ length: n }, () => px)).flat();

  it("garde la couleur la plus présente, sans le blanc, le noir ni la transparence", () => {
    const logo = pixels([500, [255, 255, 255, 255]], [300, [0, 0, 0, 255]], [400, [0, 0, 0, 0]], [120, [31, 95, 168, 255]], [40, [230, 30, 20, 255]]);
    expect(couleurDominante(logo)).toBe("#1f5fa8");
  });

  it("ne propose rien pour un logo noir et blanc", () => {
    expect(couleurDominante(pixels([500, [255, 255, 255, 255]], [500, [20, 20, 20, 255]]))).toBeNull();
  });
});

describe("logo enregistré", () => {
  it("n'accepte qu'une image PNG ou JPEG de taille raisonnable", () => {
    expect(logoValide("data:image/png;base64,iVBORw0KGgo=")).toBe(true);
    expect(logoValide("data:image/jpeg;base64,/9j/4AAQ")).toBe(true);
    expect(logoValide("data:image/svg+xml;base64,PHN2Zz4=")).toBe(false);
    expect(logoValide("https://acme.fr/logo.png")).toBe(false);
    expect(logoValide(`data:image/png;base64,${"A".repeat(200_001)}`)).toBe(false);
  });

  it("remplace le logo de Frisk dans les documents, sinon le garde", () => {
    expect(marqueDocuments(undefined, "/frisk.png")).toMatchObject({ logo: "/frisk.png", logoClient: false, frisk: "/frisk.png" });
    const client = marqueDocuments({ logo: "data:image/png;base64,iVBORw0KGgo=", couleur: "#002b5c" }, "/frisk.png");
    expect(client).toMatchObject({ logo: "data:image/png;base64,iVBORw0KGgo=", logoClient: true, accent: "#002b5c", titre: "#002b5c", bandeau: "#002b5c", frisk: "/frisk.png" });
    // Documents Frisk : titres noirs, sans bandeau, comme avant.
    expect(marqueDocuments(undefined, "/frisk.png")).toMatchObject({ titre: "#0c0b0a", bandeau: null, fond: "#0c0b0a" });
  });

  it("est enregistré comme une information générale de l'espace", () => {
    const d = donneesDemo("2026-10-29");
    const ops = calculerOperations(d, { ...d, identite: { couleur: "#002b5c" } });
    expect(ops).toEqual([{ type: "racine", cle: "identite", valeur: { couleur: "#002b5c" } }]);
  });
});

describe("lecture du site par le serveur", () => {
  it("refuse les adresses internes", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "172.16.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1", "::ffff:7f00:1", "224.0.0.1"]) {
      expect(adresseInterdite(ip), ip).toBe(true);
    }
    for (const ip of ["93.184.216.34", "2606:4700::6810:84e5", "172.32.0.1"]) expect(adresseInterdite(ip), ip).toBe(false);
  });

  it("ne contacte pas une machine interne, même par son nom", async () => {
    await expect(identiteDuSite(new URL("http://localhost/"))).rejects.toThrow();
    await expect(identiteDuSite(new URL("http://127.0.0.1/"))).rejects.toThrow(/non publique/);
    await expect(identiteDuSite(new URL("http://exemple.fr:8080/"))).rejects.toThrow(/Port/);
  });

  it("reconnaît le format d'une image à ses premiers octets", () => {
    expect(formatImage(Buffer.from("89504e470d0a1a0a0000000d", "hex"))).toBe("image/png");
    expect(formatImage(Buffer.from("ffd8ffe000104a4649460001", "hex"))).toBe("image/jpeg");
    expect(formatImage(Buffer.from('<?xml version="1.0"?>\n<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBe("image/svg+xml");
    expect(formatImage(Buffer.from("<html><body>Erreur 404</body></html>"))).toBeNull();
  });
});
