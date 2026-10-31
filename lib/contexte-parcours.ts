"use client";

import { useEffect, useState } from "react";
import { MODE_TEST } from "./mode-test";
import { useSession } from "./stockage";
import { supabaseNavigateur } from "./supabase/client";
import { useVersions } from "./versions";

// Ce que l'assistant de démarrage et « Mon parcours QHSE » lisent hors des données de l'entreprise :
// versions figées du DUERP et lien de signalement. Chaque valeur reste undefined tant qu'elle n'est
// pas connue (l'étape correspondante est alors laissée de côté plutôt que présentée à tort).
export function useContexteParcours() {
  const session = useSession();
  const { versions, chargement, erreur } = useVersions(session.entrepriseId);
  const [lienActif, setLienActif] = useState<boolean | undefined>(MODE_TEST ? true : undefined);

  useEffect(() => {
    if (MODE_TEST || !session.entrepriseId) return;
    let actif = true;
    supabaseNavigateur()
      .from("entreprises")
      .select("jeton_signalement")
      .eq("id", session.entrepriseId)
      .maybeSingle()
      .then(({ data, error }: { data: { jeton_signalement: string | null } | null; error: unknown }) => {
        if (actif && !error) setLienActif(!!data?.jeton_signalement);
      });
    return () => {
      actif = false;
    };
  }, [session.entrepriseId]);

  const connues = !chargement && !erreur;
  return {
    versions: connues ? versions.length : undefined,
    derniereVersion: connues ? (versions[0]?.created_at.slice(0, 10) ?? null) : undefined,
    lienActif,
  };
}
