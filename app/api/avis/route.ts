import { createClient } from "@supabase/supabase-js";
import { MODE_TEST } from "@/lib/mode-test";
import { supabaseClePublique, supabaseUrl } from "@/lib/supabase/config";

// Avis clients publiés (relus par Frisk), pour le site vitrine. Lecture publique, limitée par la
// base à ce qui est fait pour être affiché (fonction avis_publies, migration 018).
export async function GET() {
  if (MODE_TEST) return Response.json({ avis: [] });
  const { data, error } = await createClient(supabaseUrl, supabaseClePublique, {
    auth: { autoRefreshToken: false, persistSession: false },
  }).rpc("avis_publies");
  if (error) return Response.json({ erreur: "Avis indisponibles." }, { status: 503 });
  return Response.json(
    { avis: data ?? [] },
    // Mis en cache 5 minutes par l'hébergeur : un avis publié apparaît sur le site peu après.
    { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } },
  );
}
