"use client";

import Link from "next/link";
import { useState } from "react";
import { Carte, classeChamp } from "@/components/ui";
import { decalerJours, formaterDate } from "@/lib/calculs";
import { calculerEcheances, HORIZON_ECHEANCES, libellesTypesEcheance, type TypeEcheance } from "@/lib/echeances";
import type { Donnees } from "@/lib/types";

const periodes = [
  { valeur: "toutes", libelle: `Retards et ${HORIZON_ECHEANCES} prochains jours` },
  { valeur: "retard", libelle: "En retard" },
  { valeur: "7", libelle: "7 prochains jours" },
  { valeur: "30", libelle: "30 prochains jours" },
] as const;

const AFFICHEES = 12;

// Listes de filtres côte à côte : le champ commun prend toute la largeur, pas ici.
const classeFiltre = `${classeChamp.replace("w-full", "")} w-auto max-w-full`;

// « Prochaines échéances » du tableau de bord : vue chronologique, filtrable, avec un lien vers chaque élément.
export function EcheancesAVenir({ donnees, aujourdhui }: { donnees: Donnees; aujourdhui: string }) {
  const [type, setType] = useState<TypeEcheance | "">("");
  const [periode, setPeriode] = useState<(typeof periodes)[number]["valeur"]>("toutes");
  const [responsable, setResponsable] = useState("");
  const [tout, setTout] = useState(false);

  const echeances = calculerEcheances(donnees, aujourdhui);
  const responsables = [...new Set(echeances.map((e) => e.responsable.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const types = [...new Set(echeances.map((e) => e.type))];

  const filtrees = echeances.filter((e) => {
    if (type && e.type !== type) return false;
    if (responsable && e.responsable.trim() !== responsable) return false;
    if (periode === "retard") return e.enRetard;
    if (periode !== "toutes") return !e.enRetard && e.date <= decalerJours(aujourdhui, Number(periode));
    return true;
  });
  const affichees = tout ? filtrees : filtrees.slice(0, AFFICHEES);
  const enRetard = echeances.filter((e) => e.enRetard).length;

  return (
    <Carte titre="Prochaines échéances" className="mb-6">
      {!echeances.length ? (
        <p className="text-sm text-gris">
          Aucune échéance dans les {HORIZON_ECHEANCES} prochains jours. Les dates des actions, formations, vérifications et
          interventions apparaîtront ici.
        </p>
      ) : (
        <>
          <p className="mb-3 text-sm text-ardoise">
            {echeances.length} échéance{echeances.length > 1 ? "s" : ""}
            {enRetard ? `, dont ${enRetard} en retard` : ""}, sur les {HORIZON_ECHEANCES} prochains jours.
          </p>
          <div className="mb-4 flex flex-wrap gap-2">
            <select aria-label="Type d'échéance" value={type} onChange={(e) => setType(e.target.value as TypeEcheance | "")} className={classeFiltre}>
              <option value="">Tous les types</option>
              {types.map((t) => (
                <option key={t} value={t}>
                  {libellesTypesEcheance[t]}
                </option>
              ))}
            </select>
            <select aria-label="Période" value={periode} onChange={(e) => setPeriode(e.target.value as typeof periode)} className={classeFiltre}>
              {periodes.map((p) => (
                <option key={p.valeur} value={p.valeur}>
                  {p.libelle}
                </option>
              ))}
            </select>
            {responsables.length > 0 && (
              <select aria-label="Responsable" value={responsable} onChange={(e) => setResponsable(e.target.value)} className={classeFiltre}>
                <option value="">Tous les responsables</option>
                {responsables.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            )}
          </div>

          {!filtrees.length ? (
            <p className="text-sm text-gris">Aucune échéance pour ces filtres.</p>
          ) : (
            <ul className="divide-y divide-pierre/40">
              {affichees.map((e) => (
                <li key={e.id}>
                  <Link href={e.lien} className="grid gap-x-4 gap-y-1 py-2.5 text-sm hover:bg-ivoire sm:grid-cols-[7.5rem_1fr_auto] sm:items-baseline">
                    <span className={e.enRetard ? "font-medium text-[#b42318]" : "text-ardoise"}>
                      {formaterDate(e.date)}
                      {e.enRetard && <span className="block text-xs">En retard</span>}
                    </span>
                    <span className="min-w-0">
                      <span className="font-medium">{e.titre}</span>
                      <span className="text-gris"> · {libellesTypesEcheance[e.type]}</span>
                      {(e.detail || e.responsable) && (
                        <span className="block text-xs text-ardoise">
                          {[e.detail, e.responsable && `Responsable : ${e.responsable}`].filter(Boolean).join(" · ")}
                        </span>
                      )}
                    </span>
                    <span aria-hidden className="hidden text-gris sm:block">→</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {filtrees.length > AFFICHEES && (
            <button type="button" onClick={() => setTout(!tout)} className="mt-3 text-sm text-bronze-fonce underline">
              {tout ? "Afficher moins" : `Afficher les ${filtrees.length} échéances`}
            </button>
          )}
        </>
      )}
    </Carte>
  );
}
