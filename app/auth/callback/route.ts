import { NextResponse, type NextRequest } from "next/server";
import { supabaseServeur } from "@/lib/supabase/serveur";

// Arrivée depuis un lien envoyé par e-mail (mot de passe oublié) : ouvre la session puis redirige.
export async function GET(requete: NextRequest) {
  const { searchParams, origin } = requete.nextUrl;
  const code = searchParams.get("code");
  const suite = searchParams.get("suite") ?? "/";
  const destination = suite.startsWith("/") && !suite.startsWith("//") ? suite : "/";

  if (code) {
    const supabase = await supabaseServeur();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${destination}`);
  }
  return NextResponse.redirect(`${origin}/connexion`);
}
