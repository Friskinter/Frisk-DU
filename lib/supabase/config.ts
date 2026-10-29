// Clés publiques du projet Supabase : elles peuvent figurer dans le navigateur,
// la sécurité repose sur les règles d'accès définies dans supabase/schema.sql.
export const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "https://yluwmhfalzmjnhykpzkj.supabase.co";

export const supabaseClePublique =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() || "sb_publishable_oJJBIGCqeqVL_zUH2fEjsw_OuEediDw";
