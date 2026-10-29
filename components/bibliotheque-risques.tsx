"use client";

import { useState } from "react";
import { PastilleCriticite, classeBouton, classeBoutonSecondaire, classeChamp } from "@/components/ui";
import { domaines, metiersDu, type Metier, type ModeleRisque } from "@/lib/bibliotheque";
import { nouvelleAction } from "@/lib/actions";
import { nouvelId } from "@/lib/calculs";
import { facteursPenibilite } from "@/lib/referentiel";
import { modifier } from "@/lib/stockage";
import type { Donnees, LigneDuerp } from "@/lib/types";

const normaliser = (t: string) => t.trim().toLowerCase();

function versLigne(m: ModeleRisque, unite: string): LigneDuerp {
  return {
    id: nouvelId(),
    unite,
    activite: m.activite,
    danger: m.danger,
    risque: m.risque,
    effectif: 1,
    gravite: m.gravite,
    frequence: m.frequence,
    mesures: "",
    maitrise: "insuffisante",
    penibilite: m.penibilite ?? "",
    seuilPenibilite: m.penibilite ? "a-evaluer" : "non",
  };
}

export function BibliothequeRisques({
  donnees,
  onFermer,
  onAjout,
}: {
  donnees: Donnees;
  onFermer: () => void;
  onAjout: (nombre: number) => void;
}) {
  const [metier, setMetier] = useState<Metier | null>(null);
  // Index des modèles cochés et nom d'unité choisi pour chaque unité suggérée.
  const [coches, setCoches] = useState<Set<number>>(new Set());
  const [renommage, setRenommage] = useState<Record<string, string>>({});

  const uniteCible = (u: string) => (renommage[u] ?? u).trim() || u;
  const dejaPresent = (m: ModeleRisque) =>
    donnees.duerp.some(
      (l) =>
        normaliser(l.unite) === normaliser(uniteCible(m.unite)) &&
        normaliser(l.activite) === normaliser(m.activite) &&
        normaliser(l.danger) === normaliser(m.danger),
    );

  const choisir = (m: Metier) => {
    setMetier(m);
    setRenommage({});
    // Tout est coché par défaut, sauf ce qui figure déjà dans le DUERP.
    setCoches(new Set(m.risques.map((_, i) => i)));
  };

  const basculer = (i: number) =>
    setCoches((c) => {
      const suivant = new Set(c);
      if (suivant.has(i)) suivant.delete(i);
      else suivant.add(i);
      return suivant;
    });

  const unitesExistantes = [...new Set([...donnees.unites, ...donnees.duerp.map((l) => l.unite)])].filter(Boolean);

  const selection = metier ? metier.risques.map((m, i) => ({ m, i })).filter(({ m, i }) => coches.has(i) && !dejaPresent(m)) : [];

  const ajouter = () => {
    if (!metier || !selection.length) return;
    const lignes = selection.map(({ m }) => versLigne(m, uniteCible(m.unite)));
    // La prévention conseillée devient une action du plan, à compléter (type, responsable, échéance).
    const actions = lignes.map((l, i) => nouvelleAction(l.id, { intitule: selection[i].m.prevention }));
    modifier((d) => ({
      ...d,
      actions: [...d.actions, ...actions],
      unites: [...new Set([...d.unites, ...lignes.map((l) => l.unite)])],
      duerp: [...d.duerp, ...lignes],
    }));
    onAjout(lignes.length);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-encre/60 p-4 sm:p-8" role="dialog" aria-modal="true" aria-label="Bibliothèque de risques">
      <div className="w-full max-w-4xl rounded-sm bg-ivoire shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-pierre/70 p-5">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-bronze-fonce">Bibliothèque de risques</p>
            <h2 className="mt-1 font-serif text-2xl">{metier ? metier.nom : "Choisissez un métier"}</h2>
            <p className="mt-1 text-sm text-ardoise">
              {metier
                ? "Cochez les situations qui concernent l'entreprise. Les cotations sont des valeurs typiques : ajustez-les ensuite dans le tableau."
                : "Des situations de travail courantes, déjà rédigées, pour démarrer ou compléter le DUERP en quelques clics."}
            </p>
          </div>
          <button type="button" onClick={onFermer} aria-label="Fermer" className="text-xl text-gris hover:text-encre">
            ✕
          </button>
        </div>

        {!metier ? (
          <div className="space-y-5 p-5">
            {domaines.map((d) => (
              <section key={d.id}>
                <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-ardoise">{d.nom}</h3>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {metiersDu(d.id).map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => choisir(m)}
                      className="rounded-sm border border-pierre/70 bg-white p-4 text-left transition-colors hover:border-bronze"
                    >
                      <p className="font-medium">{m.nom}</p>
                      <p className="mt-1 text-xs text-ardoise">{m.description}</p>
                      <p className="mt-2 text-xs text-bronze-fonce">{m.risques.length} situations</p>
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className="p-5">
            <datalist id="unites-bibliotheque">
              {unitesExistantes.map((u) => (
                <option key={u} value={u} />
              ))}
            </datalist>
            <div className="space-y-5">
              {[...new Set(metier.risques.map((m) => m.unite))].map((unite) => {
                const indices = metier.risques.map((m, i) => ({ m, i })).filter(({ m }) => m.unite === unite);
                return (
                  <section key={unite} className="rounded-sm border border-pierre/70 bg-white">
                    <div className="flex flex-wrap items-center gap-2 border-b border-pierre/60 bg-marbre/50 px-4 py-2">
                      <label className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="text-gris">Unité de travail :</span>
                        <input
                          list="unites-bibliotheque"
                          value={renommage[unite] ?? unite}
                          onChange={(e) => setRenommage({ ...renommage, [unite]: e.target.value })}
                          className={`${classeChamp} w-56 font-medium`}
                          title="Renommez l'unité ou choisissez une unité existante"
                        />
                      </label>
                      <button
                        type="button"
                        className="ml-auto text-xs text-bronze-fonce underline"
                        onClick={() =>
                          setCoches((c) => {
                            const suivant = new Set(c);
                            const toutes = indices.every(({ i }) => c.has(i));
                            indices.forEach(({ i }) => (toutes ? suivant.delete(i) : suivant.add(i)));
                            return suivant;
                          })
                        }
                      >
                        Tout cocher / décocher
                      </button>
                    </div>
                    <ul className="divide-y divide-pierre/40">
                      {indices.map(({ m, i }) => {
                        const present = dejaPresent(m);
                        return (
                          <li key={i}>
                            <label className={`flex gap-3 px-4 py-3 text-sm ${present ? "opacity-50" : "cursor-pointer hover:bg-ivoire"}`}>
                              <input
                                type="checkbox"
                                className="mt-1 accent-bronze"
                                checked={!present && coches.has(i)}
                                disabled={present}
                                onChange={() => basculer(i)}
                              />
                              <span className="min-w-0 flex-1">
                                <span className="font-medium">{m.activite}</span>
                                <span className="text-ardoise"> · {m.danger} : {m.risque}</span>
                                <span className="mt-0.5 block text-xs text-gris">
                                  Prévention conseillée : {m.prevention}
                                  {m.penibilite && ` · Pénibilité : ${facteursPenibilite.find((f) => f.code === m.penibilite)?.libelle}`}
                                  {present && " · déjà dans le DUERP"}
                                </span>
                              </span>
                              <span className="shrink-0">
                                <PastilleCriticite score={m.gravite * m.frequence} />
                              </span>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                );
              })}
            </div>

            <div className="sticky bottom-0 -mx-5 mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-pierre/70 bg-ivoire px-5 py-4">
              <button type="button" className={classeBoutonSecondaire} onClick={() => setMetier(null)}>
                ← Autre métier
              </button>
              <button type="button" className={`${classeBouton} disabled:opacity-50`} disabled={!selection.length} onClick={ajouter}>
                Ajouter {selection.length} risque{selection.length > 1 ? "s" : ""} au DUERP
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
