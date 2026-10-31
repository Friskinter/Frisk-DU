import type { NextConfig } from "next";
import { supabaseUrl } from "./lib/supabase/config";

// Le mode de test ouvre l'application sans compte : jamais sur l'hébergeur.
if (process.env.NEXT_PUBLIC_FRISK_E2E === "1" && process.env.VERCEL) {
  throw new Error("NEXT_PUBLIC_FRISK_E2E est réservé aux tests : retirez cette variable de Vercel.");
}

// Politique de sécurité du contenu : le navigateur ne charge et ne contacte que l'application,
// Supabase (données, photos, temps réel) et Cloudflare Turnstile (vérification anti-robot).
// 'unsafe-inline' reste nécessaire aux scripts de Next.js : les nonces sont incompatibles avec le
// prérendu partiel (cacheComponents). 'wasm-unsafe-eval' et connect-src data: blob: servent aux PDF
// (calcul de la mise en page, logo et signatures intégrés).
// Le paiement Stripe se fait par redirection : rien à autoriser ici.
const supabase = new URL(supabaseUrl);
const developpement = process.env.NODE_ENV !== "production";
const politiqueContenu = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://challenges.cloudflare.com${developpement ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${supabase.origin}`,
  "font-src 'self' data:",
  `connect-src 'self' data: blob: ${supabase.origin} wss://${supabase.host}`,
  "frame-src https://challenges.cloudflare.com",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const entetesSecurite = [
  { key: "Content-Security-Policy", value: politiqueContenu },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Les liens de signalement contiennent un jeton secret : seul le domaine part vers les autres sites.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      { source: "/:chemin*", headers: entetesSecurite },
      // Application réservée aux clients : jamais dans les moteurs de recherche (le site vitrine
      // Frisk sert à être trouvé). En-tête plutôt que robots.txt, qui empêcherait de le lire.
      { source: "/:chemin*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
    ];
  },
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // Sans réseau (visite sur le terrain), passer d'une page à l'autre attend le retour du réseau au lieu
    // d'échouer : les pages du menu, préchargées, s'affichent avec les données déjà en mémoire.
    useOffline: true,
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
