import { erreurIgnoree, lireRapport } from "@/lib/erreurs";
import { supabaseAdmin, supabaseServeur } from "@/lib/supabase/serveur";

// Réception des erreurs survenues dans le navigateur (composant SuiviErreurs).
const PAR_MINUTE = 20;
const envois = new Map<string, number[]>();

export async function POST(requete: Request) {
  if (Number(requete.headers.get("content-length") ?? 0) > 16_000) return new Response(null, { status: 413 });
  const adresse = requete.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "inconnue";
  const maintenant = Date.now();
  const recents = (envois.get(adresse) ?? []).filter((t) => t > maintenant - 60_000);
  if (recents.length >= PAR_MINUTE) return new Response(null, { status: 429 });
  envois.set(adresse, [...recents, maintenant]);

  const rapport = lireRapport(await requete.json().catch(() => null));
  const admin = supabaseAdmin();
  if (!rapport || !admin || erreurIgnoree(rapport.message, rapport.detail)) return new Response(null, { status: 204 });

  const { data } = await (await supabaseServeur()).auth.getUser().catch(() => ({ data: { user: null } }));
  await admin.from("erreurs").insert({
    origine: "navigateur",
    message: rapport.message,
    detail: rapport.detail,
    page: rapport.page,
    navigateur: rapport.navigateur,
    user_id: data.user?.id ?? null,
    entreprise_id: data.user ? rapport.entrepriseId ?? null : null,
  });
  return new Response(null, { status: 204 });
}
