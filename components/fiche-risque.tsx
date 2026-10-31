"use client";

import Link from "next/link";
import { cloneElement, useEffect, useId, useRef, type ReactElement, type ReactNode } from "react";
import { PastilleCriticite, classeChamp } from "@/components/ui";
import { actionEnRetard } from "@/lib/actions";
import { criticiteBrute, formaterDate, niveauDe, risqueResiduel } from "@/lib/calculs";
import { facteursPenibilite, grilleFrequence, grilleGravite, grilleMaitrise, seuilsPenibilite } from "@/lib/referentiel";
import type { Action, LigneDuerp } from "@/lib/types";

// Fiche d'un risque du DUERP : tous les champs les uns sous les autres. Seule vue de saisie sur
// téléphone, et alternative au tableau sur ordinateur. Chaque modification est enregistrée aussitôt.
export function FicheRisque({
  ligne: l,
  actions,
  evenements,
  aujourdhui,
  modifiable,
  onModifier,
  onAjouterAction,
  onDupliquer,
  onSupprimer,
  onReexamine,
  onFermer,
}: {
  ligne: LigneDuerp;
  actions: Action[];
  evenements: number;
  aujourdhui: string;
  modifiable: boolean;
  onModifier: (champs: Partial<LigneDuerp>) => void;
  onAjouterAction: () => void;
  onDupliquer: () => void;
  onSupprimer: () => void;
  onReexamine: () => void;
  onFermer: () => void;
}) {
  const titre = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    titre.current?.focus();
    const echap = (e: KeyboardEvent) => e.key === "Escape" && onFermer();
    document.addEventListener("keydown", echap);
    return () => document.removeEventListener("keydown", echap);
  }, [onFermer]);

  const facteur = facteursPenibilite.find((f) => f.code === l.penibilite);
  const residuel = risqueResiduel(l);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-encre/40 print:hidden" onClick={onFermer}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titre-fiche-risque"
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full flex-col bg-ivoire shadow-xl md:max-w-xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-pierre/70 bg-white px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <p className="text-xs text-gris">Fiche du risque{l.unite ? ` · ${l.unite}` : ""}</p>
            <h2 id="titre-fiche-risque" ref={titre} tabIndex={-1} className="font-serif text-xl outline-none">
              {l.danger || l.activite || "Nouveau risque"}
            </h2>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span title="Risque résiduel : fixe la priorité">
              <PastilleCriticite score={residuel} />
            </span>
            <button type="button" onClick={onFermer} aria-label="Fermer la fiche" className="rounded-sm px-2 py-1 text-xl text-ardoise hover:bg-marbre">
              ✕
            </button>
          </div>
        </div>

        <fieldset disabled={!modifiable} className="min-w-0 flex-1 space-y-5 overflow-y-auto px-4 py-4 sm:px-5">
          {l.reexamen && (
            <div className="rounded-sm border border-[#ec835a] bg-[#fff4e5] p-3 text-sm">
              <p>
                <strong>À réexaminer</strong> : {l.reexamen.motif} ({formaterDate(l.reexamen.depuis)}). Revoyez la cotation, ou
                confirmez qu&apos;elle reste valable.
              </p>
              <button type="button" onClick={onReexamine} className="mt-2 rounded-sm border border-[#ec835a] bg-white px-2 py-0.5 text-xs text-[#9a3412]">
                ✓ Réexaminé
              </button>
            </div>
          )}

          <Groupe titre="Le risque">
            <Champ libelle="Unité de travail" aide="Lieu, service ou métier regroupant des salariés exposés aux mêmes risques.">
              <input list="liste-unites" value={l.unite} onChange={(e) => onModifier({ unite: e.target.value })} className={classeChamp} />
            </Champ>
            <Champ libelle="Activité ou situation" aide="Ce que fait le salarié au moment où il est exposé.">
              <textarea rows={2} value={l.activite} onChange={(e) => onModifier({ activite: e.target.value })} className={classeChamp} />
            </Champ>
            <Champ libelle="Danger" aide="Ce qui peut causer un dommage (une machine, une charge, un produit…).">
              <input list="liste-dangers" value={l.danger} onChange={(e) => onModifier({ danger: e.target.value })} className={classeChamp} />
            </Champ>
            <Champ libelle="Risque ou dommage" aide="Ce qui pourrait arriver au salarié.">
              <textarea rows={2} value={l.risque} onChange={(e) => onModifier({ risque: e.target.value })} className={classeChamp} />
            </Champ>
            <Champ libelle="Effectif exposé">
              <input
                type="number"
                min={0}
                inputMode="numeric"
                value={l.effectif}
                onChange={(e) => onModifier({ effectif: Math.max(0, Number(e.target.value)) })}
                className={`${classeChamp} max-w-32 tabular-nums`}
              />
            </Champ>
          </Groupe>

          <Groupe titre="Cotation">
            <div className="grid gap-3 sm:grid-cols-2">
              <Champ libelle="Gravité" aide={grilleGravite[l.gravite - 1]?.definition}>
                <select value={l.gravite} onChange={(e) => onModifier({ gravite: Number(e.target.value) })} className={classeChamp}>
                  {grilleGravite.map((g) => (
                    <option key={g.valeur} value={g.valeur}>
                      {g.valeur} – {g.libelle}
                    </option>
                  ))}
                </select>
              </Champ>
              <Champ libelle="Fréquence" aide={grilleFrequence[l.frequence - 1]?.definition}>
                <select value={l.frequence} onChange={(e) => onModifier({ frequence: Number(e.target.value) })} className={classeChamp}>
                  {grilleFrequence.map((f) => (
                    <option key={f.valeur} value={f.valeur}>
                      {f.valeur} – {f.libelle}
                    </option>
                  ))}
                </select>
              </Champ>
            </div>
            <p className="flex items-center gap-2 text-sm">
              Criticité brute (gravité × fréquence) <PastilleCriticite score={criticiteBrute(l)} />
            </p>
            <Champ libelle="Mesures existantes" aide="Ce qui est déjà en place pour protéger les salariés.">
              <textarea rows={3} value={l.mesures} onChange={(e) => onModifier({ mesures: e.target.value })} className={classeChamp} />
            </Champ>
            <Champ libelle="Maîtrise" aide={grilleMaitrise.find((m) => m.valeur === l.maitrise)?.definition}>
              <select value={l.maitrise} onChange={(e) => onModifier({ maitrise: e.target.value as LigneDuerp["maitrise"] })} className={classeChamp}>
                {grilleMaitrise.map((m) => (
                  <option key={m.valeur} value={m.valeur}>
                    {m.libelle} (×{m.coefficient})
                  </option>
                ))}
              </select>
            </Champ>
            <p className="flex flex-wrap items-center gap-2 text-sm">
              Risque résiduel <PastilleCriticite score={residuel} />
              <span className="text-xs text-gris">criticité brute × coefficient de maîtrise : {niveauDe(residuel).libelle.toLowerCase()}</span>
            </p>
          </Groupe>

          <Groupe titre="Pénibilité">
            <div className="grid gap-3 sm:grid-cols-2">
              <Champ libelle="Facteur" aide={facteur?.seuil}>
                <select
                  value={l.penibilite}
                  onChange={(e) => onModifier({ penibilite: e.target.value, seuilPenibilite: e.target.value ? l.seuilPenibilite : "non" })}
                  className={classeChamp}
                >
                  <option value="">Aucun facteur</option>
                  {facteursPenibilite.map((f) => (
                    <option key={f.code} value={f.code}>
                      {f.libelle}
                    </option>
                  ))}
                </select>
              </Champ>
              <Champ libelle="Seuil dépassé ?">
                <select
                  value={l.seuilPenibilite}
                  disabled={!l.penibilite}
                  onChange={(e) => onModifier({ seuilPenibilite: e.target.value as LigneDuerp["seuilPenibilite"] })}
                  className={`${classeChamp} disabled:text-gris`}
                >
                  {seuilsPenibilite.map((s) => (
                    <option key={s.valeur} value={s.valeur}>
                      {s.libelle}
                    </option>
                  ))}
                </select>
              </Champ>
            </div>
          </Groupe>

          <Groupe titre={`Actions de prévention (${actions.length})`}>
            {actions.length ? (
              <ul className="space-y-1.5">
                {actions.map((a) => {
                  const retard = actionEnRetard(a, aujourdhui);
                  return (
                    <li key={a.id} className="text-sm">
                      <Link href={`/actions?action=${a.id}`} className="flex items-start gap-2 hover:underline">
                        <span
                          aria-hidden
                          className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                          style={{ background: a.statut === "fait" ? "#0ca30c" : retard ? "#d03b3b" : a.statut === "en-cours" ? "#fab219" : "#d9cfc1" }}
                        />
                        <span className={a.statut === "fait" ? "text-gris line-through" : ""}>
                          {a.intitule || "Action sans intitulé"}
                          {a.echeance && a.statut !== "fait" && (
                            <span className={retard ? "font-semibold text-[#b42318]" : "text-gris"}>
                              {" "}· {retard ? "en retard, " : ""}
                              {formaterDate(a.echeance)}
                            </span>
                          )}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-gris">Aucune action pour ce risque.</p>
            )}
            <button type="button" onClick={onAjouterAction} className="text-sm text-bronze-fonce underline disabled:hidden">
              + Ajouter une action
            </button>
            {evenements > 0 && (
              <Link href={`/accidents?risque=${l.id}`} className="block text-sm text-[#b42318] underline">
                ⚑ {evenements} accident{evenements > 1 ? "s" : ""} ou presque-accident{evenements > 1 ? "s" : ""} rattaché{evenements > 1 ? "s" : ""}
              </Link>
            )}
          </Groupe>
        </fieldset>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-pierre/70 bg-white px-4 py-3 text-sm sm:px-5">
          <Link href={`/journal?element=${l.id}`} className="text-ardoise underline">
            Historique
          </Link>
          {modifiable && (
            <>
              <button type="button" onClick={onDupliquer} className="text-ardoise underline">
                Dupliquer
              </button>
              <button type="button" onClick={onSupprimer} className="text-[#b42318] underline">
                Supprimer
              </button>
            </>
          )}
          <span className="ml-auto text-xs text-gris">Enregistré automatiquement</span>
        </div>
      </div>
    </div>
  );
}

function Groupe({ titre, children }: { titre: string; children: ReactNode }) {
  return (
    <section className="space-y-3 rounded-sm border border-pierre/70 bg-white p-4">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-ardoise">{titre}</h3>
      {children}
    </section>
  );
}

// Le libellé nomme le champ ; l'aide, hors du libellé, le décrit (aria-describedby) : un lecteur
// d'écran annonce « Danger », puis l'explication.
function Champ({ libelle, aide, children }: { libelle: string; aide?: string; children: ReactElement<{ "aria-describedby"?: string }> }) {
  const idAide = useId();
  return (
    <div className="text-sm">
      <label className="block">
        <span className="mb-1 block font-medium">{libelle}</span>
        {aide ? cloneElement(children, { "aria-describedby": idAide }) : children}
      </label>
      {aide && (
        <p id={idAide} className="mt-1 text-xs text-gris">
          {aide}
        </p>
      )}
    </div>
  );
}
