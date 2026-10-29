import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { supabaseClePublique, supabaseUrl } from "./config";

// Client agissant au nom de l'utilisateur connecté (règles d'accès appliquées).
export async function supabaseServeur() {
  const magasin = await cookies();
  return createServerClient(supabaseUrl, supabaseClePublique, {
    cookies: {
      getAll: () => magasin.getAll(),
      setAll: (aEcrire) => {
        try {
          aEcrire.forEach(({ name, value, options }) => magasin.set(name, value, options));
        } catch {
          // Appel depuis un composant serveur : le proxy se charge de rafraîchir la session.
        }
      },
    },
  });
}

// Client administrateur : contourne les règles d'accès. Uniquement côté serveur, et seulement
// après avoir vérifié que l'appelant est un administrateur Frisk (ou, pour le signalement terrain,
// que le lien de signalement est valide).
export function supabaseAdmin() {
  const cle = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!cle) return null;
  return createClient(supabaseUrl, cle, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
