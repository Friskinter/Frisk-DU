"use client";

import { couleurDominante, LOGO_TAILLE_MAX } from "./identite";

// Préparation du logo dans le navigateur : toute image (PNG, JPEG, SVG, WebP, icône) devient un
// PNG sans marges vides, d'au plus 600 × 200 pixels, utilisable dans l'espace et dans les PDF.

const LARGEUR_MAX = 600;
const HAUTEUR_MAX = 200;

function chargerImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resoudre, rejeter) => {
    const image = new Image();
    image.onload = () => resoudre(image);
    image.onerror = () => rejeter(new Error("Image illisible"));
    image.src = src;
  });
}

// Zone utile : on retire les bords transparents ou blancs.
function zoneUtile(pixels: Uint8ClampedArray, largeur: number, hauteur: number) {
  const vide = (i: number) => pixels[i + 3] < 16 || (pixels[i] > 245 && pixels[i + 1] > 245 && pixels[i + 2] > 245);
  let haut = hauteur, bas = -1, gauche = largeur, droite = -1;
  for (let y = 0; y < hauteur; y++) {
    for (let x = 0; x < largeur; x++) {
      if (vide((y * largeur + x) * 4)) continue;
      if (y < haut) haut = y;
      if (y > bas) bas = y;
      if (x < gauche) gauche = x;
      if (x > droite) droite = x;
    }
  }
  return bas < 0 ? null : { x: gauche, y: haut, l: droite - gauche + 1, h: bas - haut + 1 };
}

export async function preparerLogo(src: string): Promise<{ logo: string; couleur: string | null }> {
  const image = await chargerImage(src);
  // Un SVG sans dimensions est dessiné en grand, puis recadré.
  const l0 = image.naturalWidth || 800;
  const h0 = image.naturalHeight || 800;
  const echelle0 = Math.min(1, 1600 / Math.max(l0, h0));
  const source = document.createElement("canvas");
  source.width = Math.max(1, Math.round(l0 * echelle0));
  source.height = Math.max(1, Math.round(h0 * echelle0));
  const cs = source.getContext("2d", { willReadFrequently: true });
  if (!cs) throw new Error("Image illisible");
  cs.drawImage(image, 0, 0, source.width, source.height);
  const pixels = cs.getImageData(0, 0, source.width, source.height).data;
  const zone = zoneUtile(pixels, source.width, source.height);
  if (!zone) throw new Error("Image vide");
  const couleur = couleurDominante(pixels);

  let echelle = Math.min(1, LARGEUR_MAX / zone.l, HAUTEUR_MAX / zone.h);
  for (let essai = 0; essai < 8; essai++) {
    const sortie = document.createElement("canvas");
    sortie.width = Math.max(1, Math.round(zone.l * echelle));
    sortie.height = Math.max(1, Math.round(zone.h * echelle));
    const c = sortie.getContext("2d");
    if (!c) break;
    c.imageSmoothingQuality = "high";
    c.drawImage(source, zone.x, zone.y, zone.l, zone.h, 0, 0, sortie.width, sortie.height);
    const logo = sortie.toDataURL("image/png");
    if (logo.length <= LOGO_TAILLE_MAX) return { logo, couleur };
    echelle *= 0.75;
  }
  throw new Error("Image trop lourde");
}

export function lireFichier(fichier: File): Promise<string> {
  return new Promise((resoudre, rejeter) => {
    const lecteur = new FileReader();
    lecteur.onload = () => resoudre(String(lecteur.result));
    lecteur.onerror = () => rejeter(new Error("Fichier illisible"));
    lecteur.readAsDataURL(fichier);
  });
}
