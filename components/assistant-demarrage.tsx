"use client";

import Link from "next/link";
import { classeBouton } from "@/components/ui";
import { dateDuJour } from "@/lib/calculs";
import { useContexteParcours } from "@/lib/contexte-parcours";
import { etapesDemarrage, suggestionsDemarrage } from "@/lib/demarrage";
import { calculerParcours, questionsSansReponse } from "@/lib/parcours";
import { modifier, peutModifier, useSession } from "@/lib/stockage";
import type { Donnees } from "@/lib/types";

// « Bien démarrer avec Frisk Plateforme » : visible du responsable tant que la mise en place n'est pas finie.
export function AssistantDemarrage({ donnees }: { donnees: Donnees }) {
  const session = useSession();
  const contexte = useContexteParcours();

  // Assistant masqué, mise en place terminée ou lecture seule : un simple rappel du parcours.
  const etapes = etapesDemarrage(donnees, contexte);
  const faites = etapes.filter((e) => e.faite).length;
  if (!peutModifier(session.role, "tout") || donnees.preferences?.assistantMasque || faites === etapes.length) {
    return <ResumeParcours donnees={donnees} contexte={contexte} />;
  }
  const prochaine = etapes.find((e) => !e.faite)!;
  const suggestions = suggestionsDemarrage(donnees);

  const masquer = () => modifier((d) => ({ ...d, preferences: { ...d.preferences, assistantMasque: true } }));

  return (
    <section className="mb-6 rounded-sm border border-bronze/60 bg-white" aria-labelledby="titre-demarrage">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-pierre/60 px-4 py-3">
        <div>
          <h2 id="titre-demarrage" className="font-serif text-xl">Bien démarrer avec Frisk Plateforme</h2>
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
      <p className="border-t border-pierre/60 px-4 py-3 text-sm">
        {questionsSansReponse(donnees.fiche?.profil) > 0 && (
          <span className="text-ardoise">Répondez à cinq questions sur votre entreprise pour un parcours adapté. </span>
        )}
        <Link href="/parcours" className="font-medium text-bronze-fonce underline">
          Voir mon parcours QHSE complet →
        </Link>
      </p>
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

// Rappel discret du parcours quand l'assistant n'est plus affiché, tant qu'il reste des étapes.
function ResumeParcours({ donnees, contexte }: { donnees: Donnees; contexte: ReturnType<typeof useContexteParcours> }) {
  const parcours = calculerParcours(donnees, { aujourdhui: dateDuJour(), ...contexte });
  if (!parcours.prochaine) return null;
  return (
    <Link
      href="/parcours"
      className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-sm border border-pierre/70 bg-white px-4 py-3 text-sm hover:border-bronze"
    >
      <span className="font-medium">Mon parcours QHSE : {parcours.pourcentage} %</span>
      <span className="h-1.5 w-28 overflow-hidden rounded-full bg-marbre" aria-hidden>
        <span className="block h-full bg-bronze" style={{ width: `${parcours.pourcentage}%` }} />
      </span>
      <span className="min-w-0 flex-1 text-ardoise">Prochaine étape : {parcours.prochaine.titre}</span>
      <span aria-hidden className="text-gris">→</span>
    </Link>
  );
}
