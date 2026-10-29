"use client";

import Link from "next/link";
import { useState } from "react";
import { Carte, Chargement, EnTetePage, PastilleCriticite, classeBouton, classeBoutonSecondaire, classeChamp } from "@/components/ui";
import { domaines, metierPersonnalise, metiersDu, type Metier } from "@/lib/bibliotheque";
import { dateDuJour, risqueResiduel } from "@/lib/calculs";
import { actionsProposees, appliquerExpress, ligneDepuis, mesuresDe, risquesDe, unitesDe, type ChoixAction, type ChoixRisque } from "@/lib/duerp-express";
import { principesPrevention } from "@/lib/referentiel";
import { modifier, peutModifier, useDonnees, useSession } from "@/lib/stockage";

const etapes = ["Domaine et métiers", "Unités de travail", "Risques et mesures", "Plan d'actions"];

export default function DuerpExpress() {
  const donnees = useDonnees();
  const { role } = useSession();
  const [etape, setEtape] = useState(0);
  const [domaine, setDomaine] = useState<string | null>(null);
  const [choisis, setChoisis] = useState<Metier[]>([]);
  const [autre, setAutre] = useState("");
  const [unites, setUnites] = useState<{ nom: string; effectif: number; retenue: boolean }[]>([]);
  const [risques, setRisques] = useState<ChoixRisque[]>([]);
  const [actions, setActions] = useState<ChoixAction[]>([]);
  const [responsable, setResponsable] = useState<string | null>(null);
  const [resultat, setResultat] = useState<{ risques: number; actions: number } | null>(null);

  if (!donnees) return <Chargement />;
  if (!peutModifier(role, "tout")) {
    return (
      <Carte titre="DUERP express">
        <p className="text-sm text-ardoise">Seul un responsable de l&apos;entreprise peut préparer le document unique.</p>
      </Carte>
    );
  }

  const basculer = (m: Metier) => setChoisis((cs) => (cs.some((c) => c.id === m.id) ? cs.filter((c) => c.id !== m.id) : [...cs, m]));
  const ajouterAutre = () => {
    if (!autre.trim() || !domaine) return;
    const perso = metierPersonnalise(autre, domaine);
    setChoisis((cs) => (cs.some((c) => c.id === perso.id) ? cs : [...cs, perso]));
    setAutre("");
  };
  const versUnites = () => {
    setUnites(unitesDe(...choisis).map((nom) => ({ nom, effectif: 1, retenue: true })));
    setRisques(risquesDe(choisis));
    setEtape(1);
  };
  const retenues = new Set(unites.filter((u) => u.retenue).map((u) => u.nom));
  const risquesVisibles = risques.filter((r) => retenues.has(r.modele.unite));
  const majRisque = (cle: string, champs: Partial<ChoixRisque>) => setRisques((rs) => rs.map((r) => (r.cle === cle ? { ...r, ...champs } : r)));
  const versActions = () => {
    setActions(actionsProposees(risquesVisibles, dateDuJour()));
    setEtape(3);
  };
  const terminer = () => {
    let bilan = { risques: 0, actions: 0 };
    modifier((d) => {
      const r = appliquerExpress(d, {
        unites: unites.filter((u) => u.retenue),
        risques: risquesVisibles,
        actions,
        responsable: responsable ?? d.fiche?.responsable ?? "",
      });
      bilan = { risques: r.risquesAjoutes, actions: r.actionsAjoutees };
      return r.donnees;
    });
    setResultat(bilan);
  };

  if (resultat) {
    return (
      <div>
        <EnTetePage titre="DUERP express" />
        <Carte titre="C'est fait">
          <p role="status" className="text-sm">
            <strong>{resultat.risques} risque(s)</strong> ajouté(s) à votre document unique et <strong>{resultat.actions} action(s)</strong> à votre
            plan d&apos;actions.
          </p>
          <p className="mt-2 text-sm text-ardoise">
            Relisez maintenant chaque ligne : ajustez les cotations à votre situation réelle, complétez les mesures et le nombre de
            salariés exposés. Le document unique reste votre évaluation.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/duerp" className={classeBouton}>Ouvrir mon DUERP</Link>
            <Link href="/actions" className={classeBoutonSecondaire}>Voir le plan d&apos;actions</Link>
          </div>
        </Carte>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <EnTetePage
        titre="DUERP express"
        description="Un premier document unique en quelques minutes : choisissez votre domaine et vos métiers, cochez ce qui vous concerne et ce qui est déjà en place. Tout reste modifiable ensuite."
      />
      <ol className="flex flex-wrap gap-2 text-sm" aria-label="Étapes">
        {etapes.map((e, i) => (
          <li
            key={e}
            aria-current={i === etape ? "step" : undefined}
            className={`rounded-full px-3 py-1 ${i === etape ? "bg-bronze text-encre" : i < etape ? "bg-bronze/15 text-ardoise" : "bg-white text-gris"}`}
          >
            {i + 1}. {e}
          </li>
        ))}
      </ol>

      {etape === 0 && !domaine && (
        <Carte titre="Dans quel domaine travaillez-vous ?">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {domaines.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => setDomaine(d.id)}
                className="rounded-sm border border-pierre bg-white p-3 text-left transition-colors hover:border-bronze"
              >
                <span className="flex items-center justify-between gap-2 text-sm font-semibold">
                  {d.nom}
                  <span className="text-xs font-normal text-gris">{metiersDu(d.id).length} métiers</span>
                </span>
                <span className="mt-0.5 block text-xs text-gris">{d.description}</span>
              </button>
            ))}
          </div>
          {choisis.length > 0 && <ResumeChoix choisis={choisis} onContinuer={versUnites} />}
        </Carte>
      )}

      {etape === 0 && domaine && (
        <Carte titre={`Vos métiers · ${domaines.find((d) => d.id === domaine)?.nom}`}>
          <p className="mb-3 text-sm text-ardoise">
            Cochez le ou les métiers exercés dans votre entreprise. Votre métier n&apos;y est pas ? Ajoutez-le : il reprendra les situations
            courantes du domaine, que vous compléterez.
          </p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {[...metiersDu(domaine), ...choisis.filter((c) => c.domaine === domaine && c.id.startsWith("perso-"))].map((m) => (
              <label
                key={m.id}
                className={`flex cursor-pointer items-start gap-2 rounded-sm border bg-white p-3 text-sm transition-colors ${choisis.some((c) => c.id === m.id) ? "border-bronze ring-1 ring-bronze" : "border-pierre hover:border-bronze"}`}
              >
                <input type="checkbox" className="mt-1 accent-bronze" checked={choisis.some((c) => c.id === m.id)} onChange={() => basculer(m)} />
                <span>
                  <span className="block font-semibold">{m.nom}</span>
                  <span className="block text-xs text-gris">{m.description}</span>
                </span>
              </label>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-end gap-2">
            <label className="block min-w-64 flex-1 text-sm">
              Ajouter un autre métier
              <input
                value={autre}
                placeholder="Ex. : vitrier, tapissier, cordiste…"
                onChange={(e) => setAutre(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), ajouterAutre())}
                className={`${classeChamp} mt-1`}
              />
            </label>
            <button type="button" className={`${classeBoutonSecondaire} disabled:opacity-60`} disabled={!autre.trim()} onClick={ajouterAutre}>
              + Ajouter
            </button>
          </div>
          <div className="mt-4 flex flex-wrap justify-between gap-2">
            <button type="button" className={classeBoutonSecondaire} onClick={() => setDomaine(null)}>← Autres domaines</button>
            <button type="button" className={`${classeBouton} disabled:opacity-60`} disabled={!choisis.length} onClick={versUnites}>
              Continuer →
            </button>
          </div>
          {choisis.length > 0 && <p className="mt-3 text-xs text-gris">Choisis : {choisis.map((c) => c.nom).join(", ")}. Vous pouvez aussi ajouter des métiers d&apos;un autre domaine.</p>}
        </Carte>
      )}

      {etape === 1 && (
        <Carte titre="Vos unités de travail">
          <p className="mb-3 text-sm text-ardoise">
            Les lieux ou métiers qui regroupent des salariés exposés aux mêmes risques. Décochez ceux qui n&apos;existent pas chez vous et
            indiquez combien de salariés y travaillent.
          </p>
          <ul className="space-y-2">
            {unites.map((u, i) => (
              <li key={u.nom} className="flex flex-wrap items-center gap-3">
                <label className="flex min-w-56 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="accent-bronze"
                    checked={u.retenue}
                    onChange={(e) => setUnites((us) => us.map((x, j) => (j === i ? { ...x, retenue: e.target.checked } : x)))}
                  />
                  {u.nom}
                </label>
                <label className="flex items-center gap-2 text-xs text-gris">
                  Salariés exposés
                  <span className="block w-20">
                    <input
                      type="number"
                      min={1}
                      disabled={!u.retenue}
                      value={u.effectif}
                      onChange={(e) => setUnites((us) => us.map((x, j) => (j === i ? { ...x, effectif: Number(e.target.value) } : x)))}
                      className={classeChamp}
                    />
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <Navigation retour={() => setEtape(0)} suite={() => setEtape(2)} suiteDesactivee={retenues.size === 0} />
        </Carte>
      )}

      {etape === 2 && (
        <div className="space-y-4">
          <p className="text-sm text-ardoise">
            Décochez les risques qui ne vous concernent pas. Pour chaque risque, cochez les mesures <strong>déjà en place</strong> : le niveau
            du risque restant se met à jour.
          </p>
          {[...retenues].map((unite) => (
            <Carte key={unite} titre={unite}>
              <ul className="space-y-4">
                {risquesVisibles
                  .filter((r) => r.modele.unite === unite)
                  .map((r) => {
                    const mesures = mesuresDe(r.modele);
                    return (
                      <li key={r.cle} className={`rounded-sm border p-3 ${r.inclus ? "border-pierre bg-white" : "border-dashed border-pierre bg-ivoire"}`}>
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <label className="flex items-start gap-2 text-sm">
                            <input type="checkbox" className="mt-1 accent-bronze" checked={r.inclus} onChange={(e) => majRisque(r.cle, { inclus: e.target.checked })} />
                            <span>
                              <strong>{r.modele.activite}</strong> · {r.modele.danger}
                              <span className="block text-xs text-gris">{r.modele.risque}</span>
                            </span>
                          </label>
                          {r.inclus && <PastilleCriticite score={risqueResiduel(ligneDepuis(r, 1))} />}
                        </div>
                        {r.inclus && (
                          <fieldset className="mt-2 pl-6">
                            <legend className="mb-1 text-xs font-medium text-ardoise">Déjà en place</legend>
                            <div className="grid gap-1 sm:grid-cols-2">
                              {mesures.map((m) => (
                                <label key={m} className="flex items-start gap-2 text-sm">
                                  <input
                                    type="checkbox"
                                    className="mt-1 accent-bronze"
                                    checked={r.enPlace.includes(m)}
                                    onChange={(e) => majRisque(r.cle, { enPlace: e.target.checked ? [...r.enPlace, m] : r.enPlace.filter((x) => x !== m) })}
                                  />
                                  {m}
                                </label>
                              ))}
                            </div>
                          </fieldset>
                        )}
                      </li>
                    );
                  })}
              </ul>
            </Carte>
          ))}
          <Navigation retour={() => setEtape(1)} suite={versActions} suiteDesactivee={!risquesVisibles.some((r) => r.inclus)} />
        </div>
      )}

      {etape === 3 && (
        <Carte titre="Votre plan d'actions">
          <p className="mb-3 text-sm text-ardoise">
            Les mesures pas encore en place deviennent des actions, avec une échéance selon le niveau du risque. Décochez celles que vous ne
            retenez pas et ajustez les dates.
          </p>
          <label className="mb-4 block max-w-sm text-sm">
            Responsable des actions
            <input
              value={responsable ?? donnees.fiche?.responsable ?? ""}
              placeholder="Nom et fonction"
              onChange={(e) => setResponsable(e.target.value)}
              className={`${classeChamp} mt-1`}
            />
          </label>
          {actions.length === 0 ? (
            <p className="text-sm">Aucune action à proposer : toutes les mesures conseillées sont déjà en place ou les risques sont faibles.</p>
          ) : (
            <ul className="divide-y divide-pierre/60">
              {actions.map((a) => {
                const r = risques.find((x) => x.cle === a.risqueCle)!;
                return (
                  <li key={a.cle} className="flex flex-wrap items-center gap-3 py-2">
                    <label className="flex min-w-0 flex-1 items-start gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="mt-1 accent-bronze"
                        checked={a.inclus}
                        onChange={(e) => setActions((as) => as.map((x) => (x.cle === a.cle ? { ...x, inclus: e.target.checked } : x)))}
                      />
                      <span>
                        {a.intitule}
                        <span className="block text-xs text-gris">
                          {r.modele.unite} · {r.modele.danger} · {principesPrevention.find((p) => p.valeur === a.principe)?.libelle.replace(/^\d\. /, "")}
                        </span>
                      </span>
                    </label>
                    <div className="w-44 shrink-0">
                      <input
                        type="date"
                        aria-label={`Échéance : ${a.intitule}`}
                        disabled={!a.inclus}
                        value={a.echeance}
                        onChange={(e) => setActions((as) => as.map((x) => (x.cle === a.cle ? { ...x, echeance: e.target.value } : x)))}
                        className={classeChamp}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="mt-4 flex flex-wrap justify-between gap-2">
            <button type="button" className={classeBoutonSecondaire} onClick={() => setEtape(2)}>← Retour</button>
            <button type="button" className={classeBouton} onClick={terminer}>
              Ajouter à mon document unique
            </button>
          </div>
        </Carte>
      )}
    </div>
  );
}

function Navigation({ retour, suite, suiteDesactivee }: { retour: () => void; suite: () => void; suiteDesactivee?: boolean }) {
  return (
    <div className="mt-4 flex flex-wrap justify-between gap-2">
      <button type="button" className={classeBoutonSecondaire} onClick={retour}>← Retour</button>
      <button type="button" className={`${classeBouton} disabled:opacity-60`} disabled={suiteDesactivee} onClick={suite}>Continuer →</button>
    </div>
  );
}

function ResumeChoix({ choisis, onContinuer }: { choisis: Metier[]; onContinuer: () => void }) {
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-pierre/60 pt-3 text-sm">
      <p>Choisis : {choisis.map((c) => c.nom).join(", ")}</p>
      <button type="button" className={classeBouton} onClick={onContinuer}>Continuer →</button>
    </div>
  );
}
