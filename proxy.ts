import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseClePublique, supabaseUrl } from "@/lib/supabase/config";

// /api/alertes est appelée par le planificateur, sans session : elle vérifie son propre secret.
// Les pages /legal/ (mentions légales, CGU, confidentialité) sont lisibles sans compte.
const pagesPubliques = ["/connexion", "/auth/", "/api/alertes", "/legal/"];

// Rafraîchit la session Supabase et renvoie vers la connexion les visiteurs non connectés.
export async function proxy(requete: NextRequest) {
  let reponse = NextResponse.next({ request: requete });

  const supabase = createServerClient(supabaseUrl, supabaseClePublique, {
    cookies: {
      getAll: () => requete.cookies.getAll(),
      setAll: (aEcrire, entetes) => {
        aEcrire.forEach(({ name, value }) => requete.cookies.set(name, value));
        reponse = NextResponse.next({ request: requete });
        aEcrire.forEach(({ name, value, options }) => reponse.cookies.set(name, value, options));
        Object.entries(entetes).forEach(([cle, valeur]) => reponse.headers.set(cle, valeur));
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const chemin = requete.nextUrl.pathname;
  const publique = pagesPubliques.some((p) => chemin.startsWith(p));

  if (!data?.claims && !publique) {
    const url = requete.nextUrl.clone();
    url.pathname = "/connexion";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return reponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|logo-frisk.png).*)"],
};
