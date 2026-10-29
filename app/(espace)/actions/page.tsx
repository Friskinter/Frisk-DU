"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import {
  Chargement,
  EnTetePage,
  Indicateur,
  PastilleCriticite,
  classeBoutonSecondaire,
  classeChamp,
} from "@/components/ui";
import { actionEnRetard, actionsDuRisque, effectifDeclare, estPapripact, nouvelleAction } from "@/lib/actions";
import { dateDuJour, formatEuros, formaterDate, risqueResiduel, telechargerCsv } from "@/lib/calculs";
import { efficacites, principesPrevention, statutsAction } from "@/lib/referentiel";
import { modifier, peutModifier, useDonnees, useSession } from "@/lib/stockage";
import type { Action, Evenement, Formation, LigneDuerp, Visite } from "@/lib/types";

const cellule = "border-b border-pierre/60 p-1 align-top";
const champ =
  "w-full rounded-[2px] border border-transparent bg-transparent px-1.5 py-1 text-sm outline-none hover:border-pierre focus:border-bronze focus:bg-white disabled:hover:border-transparent";

function mettreAJour(id: string, champs: Partial<Action>) {
  modifier((d) => ({ ...d, actions: d.actions.map((a) => (a.id === id ? { ...a, ...champs } : a)) }));
}

export default function PagePlanActions() {
  // useSearchParams doit être sous un Suspense avec le pré-rendu de Next.js.
  return (
    <Suspense fallback={<Chargement />}>
      <PlanActions />
    </Suspense>
  );
}

function PlanActions() {
  const donnees = useDonnees();
  const { role } = useSession();
  const risqueFiltre = useSearchParams().get("risque") ?? "";
  const [statut, setStatut] = useState("");
  const [principe, setPrincipe] = useState("");
  const [responsable, setResponsable] = useState("");
  const [annee, setAnnee] = useState("");
  const [retardSeulement, setRetardSeulement] = useState(false);
  const [guide, setGuide] = useState(false);

  if (!donnees) return <Chargement />;
  const modifiable = peutModifier(role, "tout");
  const aujourdhui = dateDuJour();
  const papripact = estPapripact(donnees);
  const effectif = effectifDeclare(donnees);

  const garder = (a: Action) =>
    (!statut || a.statut === statut) &&
    (!principe || a.principe === principe) &&
    (!responsable || a.responsable === responsable) &&
    (!annee || a.echeance.startsWith(annee)) &&
    (!retardSeulement || actionEnRetard(a, aujourdhui));

  const filtresActifs = !!(statut || principe || responsable || annee || retardSeulement);
  const risques = [...donnees.duerp]
    .filter((l) => !risqueFiltre || l.id === risqueFiltre)
    .sort((a, b) => risqueResiduel(b) - risqueResiduel(a))
    .map((l) => ({ risque: l, actions: actionsDuRisque(donnees.actions, l).filter(garder) }))
    // Sans filtre, on montre aussi les risques sans action pour pouvoir en ajouter.
    .filter((g) => g.actions.length || (!filtresActifs && (risqueFiltre || risqueResiduel(g.risque) >= 4)));

  // Actions dont le risque n'existe pas (créées depuis une visite, risque supprimé…) : regroupées à part.
  const idsRisques = new Set(donnees.duerp.map((l) => l.id));
  const orphelines = risqueFiltre ? [] : donnees.actions.filter((a) => !idsRisques.has(a.risqueId)).filter(garder);

  const toutes = donnees.actions;
  const realisees = toutes.filter((a) => a.statut === "fait");
  const enRetard = toutes.filter((a) => actionEnRetard(a, aujourdhui));
  const budgetPrevu = toutes.filter((a) => a.statut !== "fait").reduce((t, a) => t + (a.cout ?? 0), 0);
  const budgetRealise = realisees.reduce((t, a) => t + (a.cout ?? 0), 0);
  const responsables = [...new Set(toutes.map((a) => a.responsable).filter(Boolean))].sort();
  const annees = [...new Set(toutes.map((a) => a.echeance.slice(0, 4)).filter(Boolean))].sort();

  const ajouter = (l: LigneDuerp) => modifier((d) => ({ ...d, actions: [...d.actions, nouvelleAction(l.id)] }));
  const supprimer = (a: Action) => {
    if (confirm(`Supprimer l'action « ${a.intitule || "sans intitulé"} » ?`)) {
      modifier((d) => ({ ...d, actions: d.actions.filter((x) => x.id !== a.id) }));
    }
  };
  const changerStatut = (a: Action, valeur: Action["statut"]) =>
    mettreAJour(a.id, {
      statut: valeur,
      // Date de réalisation renseignée automatiquement, effacée si l'action est rouverte.
      realiseeLe: valeur === "fait" ? a.realiseeLe || aujourdhui : "",
      efficacite: valeur === "fait" ? a.efficacite : "non-evaluee",
    });

  const exporter = () => {
    const risqueDe = new Map(donnees.duerp.map((l) => [l.id, l]));
    telechargerCsv(`${papripact ? "Programme annuel de prevention" : "Plan d'actions"} - ${donnees.entreprise} - ${aujourdhui}.csv`, [
      ["Unité de travail", "Risque", "Risque résiduel", "Action", "Type de mesure", "Responsable", "Échéance", "Coût HT", "Ressources", "Indicateur", "Statut", "Réalisée le", "Efficacité", "Constat"],
      ...[...risques, { risque: null, actions: orphelines }].flatMap((g) =>
        g.actions.map((a) => {
          const l = risqueDe.get(a.risqueId);
          return [
            l?.unite ?? "", l ? l.danger || l.risque : "Non rattachée à un risque", l ? risqueResiduel(l) : "", a.intitule,
            principesPrevention.find((p) => p.valeur === a.principe)?.libelle ?? "",
            a.responsable, formaterDate(a.echeance), a.cout ?? "", a.ressources, a.indicateur,
            statutsAction.find((s) => s.valeur === a.statut)?.libelle ?? "", formaterDate(a.realiseeLe),
            efficacites.find((e) => e.valeur === a.efficacite)?.libelle ?? "", a.commentaire,
          ];
        }),
      ),
    ]);
  };

  return (
    <div>
      <EnTetePage
        titre={papripact ? "Programme annuel de prévention" : "Plan d'actions de prévention"}
        description={
          papripact
            ? `Entreprise d'au moins 50 salariés : le programme annuel de prévention (PAPRIPACT) détaille les mesures, leur coût, les indicateurs et le calendrier.`
            : `Liste des actions de prévention issues du DUERP${effectif === null ? " (renseignez l'effectif dans les réglages : à partir de 50 salariés, un programme annuel est requis)" : ""}.`
        }
        actions={
          <>
            <button type="button" className={classeBoutonSecondaire} onClick={() => setGuide(!guide)}>
              {guide ? "Masquer la hiérarchie" : "? Hiérarchie des mesures"}
            </button>
            <button type="button" className={classeBoutonSecondaire} onClick={exporter}>
              Exporter (Excel)
            </button>
          </>
        }
      />

      {guide && (
        <div className="mb-6 rounded-sm border border-pierre/70 bg-white p-5">
          <p className="text-sm text-ardoise">
            Les principes généraux de prévention (article L4121-2 du Code du travail) imposent de privilégier les mesures
            les plus efficaces : on cherche d&apos;abord à supprimer le risque, puis à le réduire collectivement ; les
            équipements de protection individuelle ne viennent qu&apos;en complément.
          </p>
          <ol className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {principesPrevention.map((p) => (
              <li key={p.valeur} className="rounded-sm bg-marbre/60 p-3 text-sm">
                <p className="font-medium">{p.libelle}</p>
                <p className="text-ardoise">{p.definition}</p>
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Indicateur
          libelle="Actions réalisées"
          valeur={toutes.length ? `${Math.round((realisees.length / toutes.length) * 100)} %` : "—"}
          detail={`${realisees.length} sur ${toutes.length}`}
        />
        <Indicateur libelle="En retard" valeur={enRetard.length} alerte={enRetard.length > 0} detail="échéance dépassée" />
        <Indicateur libelle="Budget à engager" valeur={formatEuros.format(budgetPrevu)} detail="HT, actions non réalisées" />
        <Indicateur libelle="Budget réalisé" valeur={formatEuros.format(budgetRealise)} detail="HT, actions réalisées" />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {risqueFiltre && (
          <Link href="/actions" className="rounded-full bg-bronze/15 px-3 py-1 text-xs">
            Un seul risque ✕
          </Link>
        )}
        <select aria-label="Filtrer par statut" value={statut} onChange={(e) => setStatut(e.target.value)} className={`${classeChamp} max-w-40`}>
          <option value="">Tous les statuts</option>
          {statutsAction.map((s) => (
            <option key={s.valeur} value={s.valeur}>{s.libelle}</option>
          ))}
        </select>
        <select aria-label="Filtrer par type de mesure" value={principe} onChange={(e) => setPrincipe(e.target.value)} className={`${classeChamp} max-w-56`}>
          <option value="">Tous les types de mesure</option>
          {principesPrevention.map((p) => (
            <option key={p.valeur} value={p.valeur}>{p.libelle}</option>
          ))}
        </select>
        <select aria-label="Filtrer par responsable" value={responsable} onChange={(e) => setResponsable(e.target.value)} className={`${classeChamp} max-w-52`}>
          <option value="">Tous les responsables</option>
          {responsables.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
        <select aria-label="Filtrer par année" value={annee} onChange={(e) => setAnnee(e.target.value)} className={`${classeChamp} max-w-36`}>
          <option value="">Toutes les années</option>
          {annees.map((a) => (
            <option key={a}>{a}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-ardoise">
          <input type="checkbox" className="accent-bronze" checked={retardSeulement} onChange={(e) => setRetardSeulement(e.target.checked)} />
          En retard seulement
        </label>
      </div>

      <datalist id="liste-responsables">
        {responsables.map((r) => (
          <option key={r} value={r} />
        ))}
      </datalist>

      {risques.length === 0 && orphelines.length === 0 ? (
        <p className="rounded-sm border border-pierre/70 bg-white p-6 text-center text-sm text-gris">
          Aucune action ne correspond à ces critères.
        </p>
      ) : (
        <fieldset disabled={!modifiable} className="min-w-0">
          <div className="overflow-x-auto rounded-sm border border-pierre/70 bg-white">
            <table className="w-full min-w-[72rem] border-separate border-spacing-0 text-sm">
              <thead className="bg-marbre text-left text-xs uppercase tracking-wide text-ardoise">
                <tr>
                  <th className="border-b border-pierre/60 px-2 py-2" style={{ width: "25%" }}>Action, moyens et indicateur</th>
                  <th className="border-b border-pierre/60 px-2 py-2" style={{ width: "17%" }}>Type de mesure</th>
                  <th className="border-b border-pierre/60 px-2 py-2" style={{ width: "12%" }}>Responsable</th>
                  <th className="border-b border-pierre/60 px-2 py-2" style={{ width: "10%" }}>Échéance</th>
                  <th className="border-b border-pierre/60 px-2 py-2" style={{ width: "8%" }}>Coût HT</th>
                  <th className="border-b border-pierre/60 px-2 py-2" style={{ width: "9%" }}>Statut</th>
                  <th className="border-b border-pierre/60 px-2 py-2" style={{ width: "17%" }}>Réalisation et efficacité</th>
                  <th className="border-b border-pierre/60 px-2 py-2" style={{ width: "2%" }} />
                </tr>
              </thead>
              <tbody>
                {risques.map(({ risque: l, actions }) => (
                  <GroupeRisque
                    key={l.id}
                    risque={l}
                    actions={actions}
                    aujourdhui={aujourdhui}
                    evenements={donnees.evenements}
                    visites={donnees.visites}
                    formations={donnees.formations}
                    onAjouter={() => ajouter(l)}
                    onSupprimer={supprimer}
                    onStatut={changerStatut}
                  />
                ))}
                {orphelines.length > 0 && (
                  <GroupeRisque
                    risque={null}
                    risquesDuerp={donnees.duerp}
                    actions={orphelines}
                    aujourdhui={aujourdhui}
                    evenements={donnees.evenements}
                    visites={donnees.visites}
                    formations={donnees.formations}
                    onSupprimer={supprimer}
                    onStatut={changerStatut}
                  />
                )}
              </tbody>
            </table>
          </div>
        </fieldset>
      )}
    </div>
  );
}

function GroupeRisque({
  risque: l,
  risquesDuerp = [],
  actions,
  aujourdhui,
  evenements,
  visites,
  formations,
  onAjouter,
  onSupprimer,
  onStatut,
}: {
  risque: LigneDuerp | null; // null : actions non rattachées à un risque du DUERP
  risquesDuerp?: LigneDuerp[];
  actions: Action[];
  aujourdhui: string;
  evenements: Evenement[];
  visites: Visite[];
  formations: Formation[];
  onAjouter?: () => void;
  onSupprimer: (a: Action) => void;
  onStatut: (a: Action, statut: Action["statut"]) => void;
}) {
  const seulementEpi = !!l && actions.length > 0 && actions.every((a) => a.principe === "epi") && risqueResiduel(l) >= 8;
  return (
    <>
      {!l && (
        <tr className="bg-ivoire">
          <td colSpan={8} className="border-b border-pierre/60 px-3 py-2">
            <span className="font-medium">Actions non rattachées à un risque du DUERP</span>
            <span className="ml-2 text-xs text-gris">Rattachez-les au risque concerné pour qu&apos;elles figurent dans le document unique.</span>
          </td>
        </tr>
      )}
      {l && (
      <tr className="bg-ivoire">
        <td colSpan={8} className="border-b border-pierre/60 px-3 py-2">
          <div className="flex flex-wrap items-center gap-3">
            <PastilleCriticite score={risqueResiduel(l)} />
            <span className="font-medium">{l.danger || l.activite || "Risque"}</span>
            <span className="text-gris">{l.unite} · {l.risque}</span>
            {seulementEpi && (
              <span className="text-xs text-[#b42318]">⚠ Uniquement des EPI : prévoir une mesure collective ou d&apos;organisation</span>
            )}
            <button type="button" onClick={onAjouter} className="text-xs text-bronze-fonce underline disabled:hidden">
              + Ajouter une action
            </button>
          </div>
        </td>
      </tr>
      )}
      {actions.length === 0 && (
        <tr>
          <td colSpan={8} className="border-b border-pierre/60 px-3 py-2 text-xs text-gris">Aucune action pour ce risque.</td>
        </tr>
      )}
      {actions.map((a) => {
        const retard = actionEnRetard(a, aujourdhui);
        const fait = a.statut === "fait";
        const origine = a.evenementId ? evenements.find((e) => e.id === a.evenementId) : undefined;
        const visite = a.visiteId ? visites.find((v) => v.id === a.visiteId) : undefined;
        const formes = formations.filter((f) => f.actionId === a.id).length;
        return (
          <tr key={a.id}>
            <td className={cellule}>
              <textarea
                rows={2}
                value={a.intitule}
                placeholder="Intitulé de l'action"
                onChange={(e) => mettreAJour(a.id, { intitule: e.target.value })}
                className={`${champ} resize-y font-medium`}
              />
              <input
                value={a.ressources}
                placeholder="Moyens (prestataire, temps, matériel…)"
                onChange={(e) => mettreAJour(a.id, { ressources: e.target.value })}
                className={`${champ} text-xs`}
              />
              <input
                value={a.indicateur}
                placeholder="Indicateur de résultat"
                onChange={(e) => mettreAJour(a.id, { indicateur: e.target.value })}
                className={`${champ} text-xs`}
              />
              {a.principe === "formation" && (
                <Link href="/formations" className="block px-1.5 text-xs text-ardoise underline">
                  ◆ {formes ? `${formes} salarié(s) formé(s)` : "Enregistrer les salariés formés"}
                </Link>
              )}
              {origine && (
                <Link href={`/accidents?evenement=${origine.id}`} className="block px-1.5 text-xs text-[#b42318] underline">
                  ⚑ Suite {origine.type === "presque-accident" || origine.type === "situation-dangereuse" ? "à l'événement" : "à l'accident"} du {formaterDate(origine.date)}
                </Link>
              )}
              {visite && (
                <Link href={`/visites?visite=${visite.id}`} className="block px-1.5 text-xs text-ardoise underline">
                  ☑ Non-conformité relevée lors de la visite du {formaterDate(visite.date)}
                </Link>
              )}
              {!l && (
                <select
                  aria-label="Rattacher au risque du DUERP"
                  value=""
                  onChange={(e) => e.target.value && mettreAJour(a.id, { risqueId: e.target.value })}
                  className={`${champ} text-xs text-bronze-fonce`}
                >
                  <option value="">Rattacher à un risque du DUERP…</option>
                  {risquesDuerp.map((r) => (
                    <option key={r.id} value={r.id}>{[r.unite, r.danger || r.activite].filter(Boolean).join(" · ")}</option>
                  ))}
                </select>
              )}
            </td>
            <td className={cellule}>
              <select aria-label="Type de mesure"
                value={a.principe}
                title={principesPrevention.find((p) => p.valeur === a.principe)?.definition}
                onChange={(e) => mettreAJour(a.id, { principe: e.target.value as Action["principe"] })}
                className={`${champ} ${a.principe ? "" : "text-[#b42318]"}`}
              >
                <option value="">À préciser</option>
                {principesPrevention.map((p) => (
                  <option key={p.valeur} value={p.valeur}>{p.libelle}</option>
                ))}
              </select>
            </td>
            <td className={cellule}>
              <input aria-label="Responsable" list="liste-responsables" value={a.responsable} onChange={(e) => mettreAJour(a.id, { responsable: e.target.value })} className={champ} />
            </td>
            <td className={cellule}>
              <input aria-label="Échéance"
                type="date"
                value={a.echeance}
                onChange={(e) => mettreAJour(a.id, { echeance: e.target.value })}
                className={`${champ} ${retard ? "font-semibold text-[#b42318]" : ""}`}
              />
              {retard && <p className="px-1.5 text-xs text-[#b42318]">⚠ En retard</p>}
            </td>
            <td className={cellule}>
              <input aria-label="Coût estimé en euros"
                type="number"
                min={0}
                step={10}
                value={a.cout ?? ""}
                placeholder="€"
                onChange={(e) => mettreAJour(a.id, { cout: e.target.value === "" ? null : Math.max(0, Number(e.target.value)) })}
                className={`${champ} tabular-nums`}
              />
            </td>
            <td className={cellule}>
              <select aria-label="Statut" value={a.statut} onChange={(e) => onStatut(a, e.target.value as Action["statut"])} className={champ}>
                {statutsAction.map((s) => (
                  <option key={s.valeur} value={s.valeur}>{s.libelle}</option>
                ))}
              </select>
            </td>
            <td className={cellule}>
              {fait ? (
                <>
                  <input aria-label="Date de réalisation"
                    type="date"
                    value={a.realiseeLe}
                    title="Date de réalisation"
                    onChange={(e) => mettreAJour(a.id, { realiseeLe: e.target.value })}
                    className={`${champ} text-xs`}
                  />
                  <select aria-label="Efficacité"
                    value={a.efficacite}
                    onChange={(e) => mettreAJour(a.id, { efficacite: e.target.value as Action["efficacite"] })}
                    className={`${champ} text-xs`}
                  >
                    {efficacites.map((ef) => (
                      <option key={ef.valeur} value={ef.valeur}>{ef.libelle}</option>
                    ))}
                  </select>
                  <textarea
                    rows={1}
                    value={a.commentaire}
                    placeholder="Constat (mesure, visite, retour des salariés…)"
                    onChange={(e) => mettreAJour(a.id, { commentaire: e.target.value })}
                    className={`${champ} resize-y text-xs`}
                  />
                  {(a.efficacite === "partielle" || a.efficacite === "inefficace") && (
                    <Link href="/duerp" className="block px-1.5 text-xs text-[#b42318] underline">
                      Réévaluer le risque dans le DUERP
                    </Link>
                  )}
                  {a.efficacite === "efficace" && (
                    <p className="px-1.5 text-xs text-gris">Pensez à mettre à jour la maîtrise du risque dans le DUERP.</p>
                  )}
                </>
              ) : (
                <p className="px-1.5 py-1 text-xs text-gris">
                  {a.echeance ? `Prévue pour le ${formaterDate(a.echeance)}` : "Échéance à fixer"}
                </p>
              )}
            </td>
            <td className={`${cellule} text-right`}>
              <button
                type="button"
                title="Supprimer l'action"
                onClick={() => onSupprimer(a)}
                className="rounded-sm px-2 py-1 text-ardoise hover:bg-marbre hover:text-[#b42318] disabled:hidden"
              >
                ✕
              </button>
            </td>
          </tr>
        );
      })}
    </>
  );
}

