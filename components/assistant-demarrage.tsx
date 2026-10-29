"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { classeBouton } from "@/components/ui";
import { etapesDemarrage, suggestionsDemarrage } from "@/lib/demarrage";
import { MODE_TEST } from "@/lib/mode-test";
import { modifier, peutModifier, useSession } from "@/lib/stockage";
import { supabaseNavigateur } from "@/lib/supabase/client";
import type { Donnees } from "@/lib/types";
import { useVersions } from "@/lib/versions";

// « Bien démarrer avec Frisk DU » : visible du responsable tant que la mise en place n'est pas finie.
export function AssistantDemarrage({ donnees }: { donnees: Donnees }) {
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

  if (!peutModifier(session.role, "tout") || donnees.preferences?.assistantMasque) return null;
  const etapes = etapesDemarrage(donnees, { versions: chargement || erreur ? undefined : versions.length, lienActif });
  const faites = etapes.filter((e) => e.faite).length;
  if (faites === etapes.length) return null;
  const prochaine = etapes.find((e) => !e.faite)!;
  const suggestions = suggestionsDemarrage(donnees);

  const masquer = () => modifier((d) => ({ ...d, preferences: { ...d.preferences, assistantMasque: true } }));

  return (
    <section className="mb-6 rounded-sm border border-bronze/60 bg-white" aria-labelledby="titre-demarrage">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-pierre/60 px-4 py-3">
        <div>
          <h2 id="titre-demarrage" className="font-serif text-xl">Bien démarrer avec Frisk DU</h2>
          <p className="text-sm text-ardoise">
            {faites} étape{faites > 1 ? "s" : ""} sur {etapes.length}. Chaque étape se coche d&apos;elle-même une fois faite.
          </p>
        </div>
        <button type="button" onClick={masquer} className="text-xs text-ardoise underline">
          Masquer l&apos;assistant
        </button>
      </div>
      <div className="px-4 pt-3" aria-hidden>
        <div className="h-2 overflow-hidden rounded-full bg-marbre">
          <div className="h-full bg-bronze transition-all" style={{ width: `${(faites / etapes.length) * 100}%` }} />
        </div>
      </div>
      <ol className="divide-y divide-pierre/40 px-4 py-2">
        {etapes.map((e, n) => (
          <li key={e.code} className="flex flex-wrap items-start gap-3 py-2.5">
            <span
              aria-hidden
              className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                e.faite ? "bg-[#0ca30c] text-[#0b0b0b]" : e === prochaine ? "bg-bronze text-encre" : "border border-pierre text-ardoise"
              }`}
            >
              {e.faite ? "✓" : n + 1}
            </span>
            <span className="min-w-0 flex-1">
              <span className={`block text-sm font-medium ${e.faite ? "text-gris line-through" : ""}`}>
                {e.titre}
                <span className="sr-only">{e.faite ? " (fait)" : " (à faire)"}</span>
              </span>
              {!e.faite && <span className="block text-xs text-ardoise">{e.aide}</span>}
            </span>
            {!e.faite && (
              <Link href={e.lien} className={e === prochaine ? classeBouton : "text-sm text-bronze-fonce underline"}>
                {e.bouton} →
              </Link>
            )}
          </li>
        ))}
      </ol>
      {suggestions.length > 0 && (
        <p className="border-t border-pierre/60 px-4 py-3 text-xs text-ardoise">
          Pour aller plus loin :{" "}
          {suggestions.map((s, n) => (
            <span key={s.code}>
              {n > 0 && " · "}
              <Link href={s.lien} className="underline">{s.titre}</Link>
            </span>
          ))}
        </p>
      )}
    </section>
  );
}
