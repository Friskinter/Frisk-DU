import type { NextConfig } from "next";

// Le mode de test ouvre l'application sans compte : jamais sur l'hébergeur.
if (process.env.NEXT_PUBLIC_FRISK_E2E === "1" && process.env.VERCEL) {
  throw new Error("NEXT_PUBLIC_FRISK_E2E est réservé aux tests : retirez cette variable de Vercel.");
}

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
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
