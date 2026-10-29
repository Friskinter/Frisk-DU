import type { Instrumentation } from "next";

// Erreurs survenues sur le serveur (pages, routes d'API) : enregistrées pour la console Frisk.
export const onRequestError: Instrumentation.onRequestError = async (erreur, requete, contexte) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { supabaseAdmin } = await import("./lib/supabase/serveur");
  const { pageSansSecret } = await import("./lib/erreurs");
  const admin = supabaseAdmin();
  if (!admin) return;
  const e = erreur as Error & { digest?: string };
  await admin
    .from("erreurs")
    .insert({
      origine: "serveur",
      message: `${e.name ?? "Error"}: ${e.message ?? String(erreur)}`.slice(0, 500),
      detail: `${contexte.routeType} ${contexte.routePath}${e.digest ? ` · ${e.digest}` : ""}\n${e.stack ?? ""}`.slice(0, 4000),
      page: pageSansSecret(requete.path),
    })
    .then(
      () => undefined,
      () => undefined,
    );
};
