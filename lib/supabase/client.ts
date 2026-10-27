import { createBrowserClient } from "@supabase/ssr";
import { supabaseClePublique, supabaseUrl } from "./config";

let client: ReturnType<typeof createBrowserClient> | null = null;

export function supabaseNavigateur() {
  client ??= createBrowserClient(supabaseUrl, supabaseClePublique);
  return client;
}
