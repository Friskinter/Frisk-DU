"use client";

import Link from "next/link";
import { Carte, Chargement, EnTetePage } from "@/components/ui";
import { dateDuJour, decalerJours, formaterDate } from "@/lib/calculs";
import { calculerEcheances } from "@/lib/echeances";
import { mesActions } from "@/lib/mes-actions";
import { statutsAction } from "@/lib/referentiel";
import { peutModifier, useDonnees, useSession } from "@/lib/stockage";
import type { Action, Donnees } from "@/lib/types";

// « Mes actions » : ce qui attend la personne connectée, sans chercher dans le plan d'actions.
export default function PageMesActions() {
  const donnees = useDonnees();
  const { email, role } = useSession();
  if (!donnees) return <Chargement />;

  const aujourdhui = dateDuJour();
  const { enRetard, aVenir, sansEcheance, faitesRecemment } = mesActions(donnees, email, aujourdhui);
  const ouvertes = enRetard.length + aVenir.length + sansEcheance.length;
  // Les responsables organisent aussi les formations : celles expirées ou à renouveler dans les 60 jours.
  const formations = peutModifier(role, "tout")
    ? calculerEcheances(donnees, aujourdhui).filter((e) => e.type === "formation" && e.date <= decalerJours(aujourdhui, 60))
    : [];

  return (
    <div>
      <EnTetePage
        titre="Mes actions"
        description="Les actions de prévention qui vous sont confiées, et ce qui vous attend. Elles vous sont aussi rappelées dans le récapitulatif du lundi."
      />

      {ouvertes === 0 && !faitesRecemment.length && (
        <Carte className="mb-6">
          <p className="text-sm text-ardoise">
            Aucune action ne vous est confiée pour l&apos;instant. Dans le plan d&apos;actions, un responsable peut confier
            une action à un utilisateur avec « Confier à… ».
          </p>
          <Link href="/actions" className="mt-2 inline-block text-sm text-bronze-fonce underline">
            Ouvrir le plan d&apos;actions →
          </Link>
        </Carte>
      )}

      {enRetard.length > 0 && <ListeActions titre={`En retard (${enRetard.length})`} actions={enRetard} donnees={donnees} retard />}
      {aVenir.length > 0 && <ListeActions titre={`À venir (${aVenir.length})`} actions={aVenir} donnees={donnees} />}
      {sansEcheance.length > 0 && <ListeActions titre={`Sans échéance (${sansEcheance.length})`} actions={sansEcheance} donnees={donnees} />}

      {formations.length > 0 && (
        <Carte titre={`Formations à organiser (${formations.length})`} className="mb-6">
          <ul className="divide-y divide-pierre/40">
            {formations.map((e) => (
              <li key={e.id}>
                <Link href={e.lien} className="flex flex-wrap items-baseline gap-x-3 py-2.5 text-sm hover:bg-ivoire">
                  <span className={`w-24 shrink-0 ${e.enRetard ? "font-medium text-[#b42318]" : "text-ardoise"}`}>{formaterDate(e.date)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="font-medium">{e.titre}</span>
                    <span className="text-gris"> · {e.detail}</span>
                    {e.enRetard && <span className="block text-xs text-[#b42318]">Expirée</span>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Carte>
      )}

      {faitesRecemment.length > 0 && (
        <details className="mb-6 rounded-sm border border-pierre/70 bg-white p-4 text-sm">
          <summary className="cursor-pointer text-ardoise">Réalisées ces 30 derniers jours ({faitesRecemment.length})</summary>
          <ul className="mt-2 space-y-1">
            {faitesRecemment.map((a) => (
              <li key={a.id}>
                <Link href={`/actions?action=${a.id}`} className="text-gris line-through hover:underline">
                  {a.intitule || "Action sans intitulé"}
                </Link>
                <span className="text-gris"> · {formaterDate(a.realiseeLe)}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function ListeActions({ titre, actions, donnees, retard = false }: { titre: string; actions: Action[]; donnees: Donnees; retard?: boolean }) {
  const risques = new Map(donnees.duerp.map((l) => [l.id, l]));
  return (
    <Carte titre={titre} className="mb-6">
      <ul className="divide-y divide-pierre/40">
        {actions.map((a) => {
          const risque = risques.get(a.risqueId);
          return (
            <li key={a.id}>
              <Link href={`/actions?action=${a.id}`} className="grid gap-x-4 gap-y-1 py-2.5 text-sm hover:bg-ivoire sm:grid-cols-[6.5rem_1fr_auto] sm:items-baseline">
                <span className={retard ? "font-medium text-[#b42318]" : "text-ardoise"}>{a.echeance ? formaterDate(a.echeance) : "—"}</span>
                <span className="min-w-0">
                  <span className="font-medium">{a.intitule || "Action sans intitulé"}</span>
                  {risque && <span className="block text-xs text-ardoise">{[risque.danger, risque.unite].filter(Boolean).join(" · ")}</span>}
                </span>
                <span className="text-xs text-gris">{statutsAction.find((s) => s.valeur === a.statut)?.libelle}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </Carte>
  );
}
