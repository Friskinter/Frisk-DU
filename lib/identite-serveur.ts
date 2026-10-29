import "server-only";
import { lookup } from "node:dns";
import http from "node:http";
import https from "node:https";
import { isIP } from "node:net";
import zlib from "node:zlib";
import { candidatsLogo, couleurDuSite } from "./identite";

// Lecture du site web d'un client pour en tirer son logo et sa couleur.
// Le serveur ne contacte que des adresses publiques : l'adresse IP est contrôlée au moment même
// de la connexion (y compris après une redirection), pour qu'un site ne puisse pas faire lire
// au serveur une machine interne.

const DELAI = 6000;
const REDIRECTIONS_MAX = 3;
const PAGE_MAX = 1_500_000;
const IMAGE_MAX = 1_000_000;
const LOGOS_MAX = 4;

// Adresses privées, locales ou réservées (IPv4, IPv6 et IPv4 dans IPv6).
export function adresseInterdite(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && (b === 168 || b === 0)) ||
      (a === 198 && (b === 18 || b === 19))
    );
  }
  if (version === 6) {
    const x = ip.toLowerCase();
    const v4 = /^(?:0*:)*(?:0*:)?ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(x)?.[1] ?? /^::(\d+\.\d+\.\d+\.\d+)$/.exec(x)?.[1];
    if (v4) return adresseInterdite(v4);
    if (/^::ffff:[0-9a-f]{1,4}:[0-9a-f]{1,4}$/.test(x)) return true;
    return x === "::" || x === "::1" || /^f[cd]/.test(x) || /^fe[89ab]/.test(x) || /^ff/.test(x) || x.startsWith("64:ff9b") || x.startsWith("2001:db8");
  }
  return true;
}

// Résolution DNS qui refuse les adresses interdites : utilisée par la connexion elle-même.
const lookupPublic: typeof lookup = ((nom: string, options: object, rappel: (e: Error | null, a?: unknown, f?: number) => void) => {
  lookup(nom, { ...options, all: true }, (erreur, adresses) => {
    if (erreur) return rappel(erreur);
    const liste = adresses as { address: string; family: number }[];
    if (!liste.length || liste.some((a) => adresseInterdite(a.address))) {
      return rappel(Object.assign(new Error("Adresse non publique"), { code: "EADRESSE" }));
    }
    if ((options as { all?: boolean }).all) return rappel(null, liste);
    rappel(null, liste[0].address, liste[0].family);
  });
}) as typeof lookup;

type Reponse = { type: string; corps: Buffer; url: URL };

function requete(url: URL, maximum: number, accept: string): Promise<{ statut: number; entetes: http.IncomingHttpHeaders; corps: Buffer }> {
  return new Promise((resoudre, rejeter) => {
    if (url.protocol !== "https:" && url.protocol !== "http:") return rejeter(new Error("Protocole refusé"));
    if (url.port && url.port !== "80" && url.port !== "443") return rejeter(new Error("Port refusé"));
    if (isIP(url.hostname.replace(/^\[|\]$/g, "")) && adresseInterdite(url.hostname.replace(/^\[|\]$/g, ""))) return rejeter(new Error("Adresse non publique"));
    const client = url.protocol === "https:" ? https : http;
    const req = client.get(
      url,
      {
        lookup: lookupPublic,
        timeout: DELAI,
        headers: { "user-agent": "Mozilla/5.0 (compatible; FriskDU/1.0; identite visuelle)", accept, "accept-encoding": "gzip, deflate, br" },
      },
      (res) => {
        const encodage = String(res.headers["content-encoding"] ?? "").toLowerCase();
        const flux =
          encodage === "gzip" ? res.pipe(zlib.createGunzip()) :
          encodage === "deflate" ? res.pipe(zlib.createInflate()) :
          encodage === "br" ? res.pipe(zlib.createBrotliDecompress()) : res;
        const morceaux: Buffer[] = [];
        let taille = 0;
        flux.on("data", (m: Buffer) => {
          taille += m.length;
          if (taille > maximum) {
            req.destroy();
            rejeter(new Error("Réponse trop lourde"));
          } else morceaux.push(m);
        });
        flux.on("end", () => resoudre({ statut: res.statusCode ?? 0, entetes: res.headers, corps: Buffer.concat(morceaux) }));
        flux.on("error", rejeter);
      },
    );
    req.on("timeout", () => req.destroy(new Error("Délai dépassé")));
    req.on("error", rejeter);
    setTimeout(() => req.destroy(new Error("Délai dépassé")), DELAI).unref();
  });
}

async function telecharger(depart: URL, maximum: number, accept: string): Promise<Reponse> {
  let url = depart;
  for (let i = 0; i <= REDIRECTIONS_MAX; i++) {
    const r = await requete(url, maximum, accept);
    if (r.statut >= 300 && r.statut < 400 && r.entetes.location) {
      url = new URL(r.entetes.location, url);
      continue;
    }
    if (r.statut !== 200) throw new Error(`Réponse ${r.statut}`);
    return { type: String(r.entetes["content-type"] ?? "").toLowerCase(), corps: r.corps, url };
  }
  throw new Error("Trop de redirections");
}

// Type d'image d'après ses premiers octets (le type annoncé par le site n'est pas fiable).
export function formatImage(o: Buffer): string | null {
  if (o.length < 12) return null;
  if (o[0] === 0x89 && o[1] === 0x50 && o[2] === 0x4e && o[3] === 0x47) return "image/png";
  if (o[0] === 0xff && o[1] === 0xd8 && o[2] === 0xff) return "image/jpeg";
  if (o.subarray(0, 4).toString("latin1") === "GIF8") return "image/gif";
  if (o.subarray(0, 4).toString("latin1") === "RIFF" && o.subarray(8, 12).toString("latin1") === "WEBP") return "image/webp";
  if (o[0] === 0 && o[1] === 0 && o[2] === 1 && o[3] === 0) return "image/x-icon";
  const debut = o.subarray(0, 1000).toString("utf8").replace(/^﻿/, "").trimStart();
  if (/^(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*(<!doctype svg[^>]*>\s*)?<svg[\s>]/i.test(debut)) return "image/svg+xml";
  return null;
}

export type ResultatSite = { logos: string[]; couleur: string | null; site: string };

export async function identiteDuSite(site: URL): Promise<ResultatSite> {
  const page = await telecharger(site, PAGE_MAX, "text/html,application/xhtml+xml");
  if (!page.type.includes("html")) throw new Error("Pas une page web");
  const html = page.corps.toString("utf8");
  const candidats = candidatsLogo(html, page.url).slice(0, 8);

  const images = await Promise.all(
    candidats.map(async (adresse) => {
      try {
        const r = await telecharger(new URL(adresse), IMAGE_MAX, "image/*");
        const format = formatImage(r.corps);
        return format ? `data:${format};base64,${r.corps.toString("base64")}` : null;
      } catch {
        return null;
      }
    }),
  );
  const logos = [...new Set(images.filter((x): x is string => !!x))].slice(0, LOGOS_MAX);
  return { logos, couleur: couleurDuSite(html), site: page.url.origin + "/" };
}
