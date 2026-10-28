"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BibliothequeRisques } from "@/components/bibliotheque-risques";
import { actionEnRetard, actionsDuRisque, nouvelleAction } from "@/lib/actions";
import { nouvelleLigne } from "@/lib/donnees";
import { BoutonDocumentUnique } from "@/components/bouton-document-unique";
import { GuideCotation } from "@/components/guide-cotation";
import { VersionsDuerp } from "@/components/versions-duerp";
import {
  Chargement,
  EnTetePage,
  PastilleCriticite,
  classeBouton,
  classeBoutonSecondaire,
  classeChamp,
} from "@/components/ui";
import {
  criticiteBrute,
  dateDuJour,
  formaterDate,
  niveauDe,
  nouvelId,
  risqueResiduel,
  telechargerCsv,
} from "@/lib/calculs";
import {
  facteursPenibilite,
  famillesDangers,
  grilleFrequence,
  grilleGravite,
  grilleMaitrise,
  niveauxCriticite,
  seuilsPenibilite,
  statutsAction,
} from "@/lib/referentiel";
import { modifier, peutModifier, useDonnees, useSession } from "@/lib/stockage";
import type { LigneDuerp } from "@/lib/types";

const cellule = "border-b border-r border-pierre/60 p-1 align-top";
const champCellule =
  "w-full rounded-[2px] border border-transparent bg-transparent px-1.5 py-1 text-sm outline-none hover:border-pierre focus:border-bronze focus:bg-white";

const colonnes: { titre: string; aide: string; largeur: number }[] = [
  { titre: "Unité de travail", aide: "Lieu, service ou métier regroupant des salariés exposés aux mêmes risques.", largeur: 180 },
  { titre: "Activité / situation", aide: "Ce que fait le salarié au moment où il est exposé.", largeur: 190 },
  { titre: "Danger", aide: "Ce qui peut causer un dommage (une machine, une charge, un produit…).", largeur: 210 },
  { titre: "Risque / dommage", aide: "Ce qui pourrait arriver au salarié.", largeur: 190 },
  { titre: "Effectif", aide: "Nombre de salariés exposés.", largeur: 90 },
  { titre: "G", aide: "Gravité de 1 à 4 : voir le guide de cotation.", largeur: 140 },
  { titre: "F", aide: "Fréquence d'exposition de 1 à 4 : voir le guide de cotation.", largeur: 150 },
  { titre: "Criticité brute", aide: "G × F, sans tenir compte des protections.", largeur: 130 },
  { titre: "Mesures existantes", aide: "Ce qui est déjà en place pour protéger les salariés.", largeur: 200 },
  { titre: "Maîtrise", aide: "Efficacité des mesures existantes.", largeur: 150 },
  { titre: "Risque résiduel", aide: "Criticité brute × coefficient de maîtrise : fixe la priorité.", largeur: 140 },
  { titre: "Pénibilité", aide: "Facteur de risques professionnels concerné (10 facteurs du Code du travail).", largeur: 190 },
  { titre: "Seuil", aide: "L'exposition dépasse-t-elle le seuil réglementaire ? Voir la page Pénibilité.", largeur: 140 },
  { titre: "Actions de prévention", aide: "Mesures prévues ou réalisées pour ce risque : elles se gèrent dans le plan d'actions.", largeur: 280 },
];


function mettreAJour(id: string, champs: Partial<LigneDuerp>) {
  modifier((d) => ({
    ...d,
    duerp: d.duerp.map((l) => (l.id === id ? { ...l, ...champs } : l)),
  }));
}

export default function PageDuerp() {
  const donnees = useDonnees();
  const { role } = useSession();
  const router = useRouter();
  const modifiable = peutModifier(role, "tout");
  const [recherche, setRecherche] = useState("");
  const [unite, setUnite] = useState("");
  const [niveau, setNiveau] = useState("");
  const [tri, setTri] = useState(false);
  const [guide, setGuide] = useState(false);
  const [bibliotheque, setBibliotheque] = useState(false);
  const [versions, setVersions] = useState(false);
  const [ajoutes, setAjoutes] = useState(0);

  if (!donnees) return <Chargement />;

  const aujourdhui = dateDuJour();
  const unitesConnues = [...new Set([...donnees.unites, ...donnees.duerp.map((l) => l.unite)])].filter(Boolean);
  const terme = recherche.trim().toLowerCase();

  let lignes = donnees.duerp.filter(
    (l) =>
      (!unite || l.unite === unite) &&
      (!niveau || niveauDe(risqueResiduel(l)).code === niveau) &&
      (!terme ||
        [l.unite, l.activite, l.danger, l.risque, l.mesures, ...actionsDuRisque(donnees.actions, l).map((a) => `${a.intitule} ${a.responsable}`)]
          .join(" ")
          .toLowerCase()
          .includes(terme)),
  );
  if (tri) lignes = [...lignes].sort((a, b) => risqueResiduel(b) - risqueResiduel(a));

  const ajouter = (apres?: LigneDuerp) =>
    modifier((d) => {
      const nouvelle = apres
        ? { ...apres, id: nouvelId() }
        : nouvelleLigne(unite || unitesConnues[0] || "");
      const index = apres ? d.duerp.findIndex((l) => l.id === apres.id) + 1 : d.duerp.length;
      const duerp = [...d.duerp];
      duerp.splice(index, 0, nouvelle);
      return { ...d, duerp };
    });

  const supprimer = (l: LigneDuerp) => {
    const nbActions = actionsDuRisque(donnees.actions, l).length;
    const nbEvenements = donnees.evenements.filter((e) => e.risqueId === l.id).length;
    const avertissement =
      (nbActions ? ` Ses ${nbActions} action(s) de prévention seront aussi supprimées.` : "") +
      (nbEvenements ? ` ${nbEvenements} accident(s) ou presque-accident(s) devront être rattachés à un autre risque.` : "");
    if (confirm(`Supprimer la ligne « ${l.danger || l.activite || "sans titre"} » ?${avertissement}`)) {
      modifier((d) => ({
        ...d,
        duerp: d.duerp.filter((x) => x.id !== l.id),
        actions: d.actions.filter((a) => a.risqueId !== l.id),
        evenements: d.evenements.map((e) => (e.risqueId === l.id ? { ...e, risqueId: "", reevalueLe: "" } : e)),
      }));
    }
  };

  const evenementsLigne = (l: LigneDuerp) => donnees.evenements.filter((e) => e.risqueId === l.id).length;

  const ajouterAction = (l: LigneDuerp) => {
    modifier((d) => ({ ...d, actions: [...d.actions, nouvelleAction(l.id)] }));
    router.push(`/actions?risque=${l.id}`);
  };

  const exporter = () =>
    telechargerCsv(`DUERP-${donnees.entreprise}-${aujourdhui}.csv`, [
      [...colonnes.map((c) => c.titre)],
      ...lignes.map((l) => [
        l.unite, l.activite, l.danger, l.risque, l.effectif, l.gravite, l.frequence,
        criticiteBrute(l), l.mesures, grilleMaitrise.find((m) => m.valeur === l.maitrise)?.libelle ?? "",
        `${risqueResiduel(l)} (${niveauDe(risqueResiduel(l)).libelle})`,
        facteursPenibilite.find((f) => f.code === l.penibilite)?.libelle ?? "",
        seuilsPenibilite.find((s) => s.valeur === l.seuilPenibilite)?.libelle ?? "",
        actionsDuRisque(donnees.actions, l)
          .map((a) =>
            [a.intitule, a.responsable, formaterDate(a.echeance), statutsAction.find((s) => s.valeur === a.statut)?.libelle]
              .filter(Boolean)
              .join(" · "),
          )
          .join(" | "),
      ]),
    ]);

  return (
    <div>
      <EnTetePage
        titre="Document unique (DUERP)"
        description="Chaque ligne est un risque. Cliquez dans une case pour la modifier : tout est enregistré automatiquement."
        actions={
          <>
            <button type="button" className={classeBoutonSecondaire} onClick={() => setGuide(!guide)}>
              {guide ? "Masquer le guide" : "? Guide de cotation"}
            </button>
            <button type="button" className={classeBoutonSecondaire} onClick={exporter}>
              Exporter (Excel)
            </button>
            <BoutonDocumentUnique donnees={donnees} />
            <button type="button" className={classeBoutonSecondaire} onClick={() => setVersions(true)}>
              🗄 Versions
            </button>
            <button type="button" className={`${classeBoutonSecondaire} disabled:opacity-50`} disabled={!modifiable} onClick={() => setBibliotheque(true)}>
              📚 Bibliothèque de risques
            </button>
            <button type="button" className={`${classeBouton} disabled:opacity-50`} disabled={!modifiable} onClick={() => ajouter()}>
              + Ajouter un risque
            </button>
          </>
        }
      />

      {versions && <VersionsDuerp donnees={donnees} onFermer={() => setVersions(false)} />}

      {bibliotheque && (
        <BibliothequeRisques
          donnees={donnees}
          onFermer={() => setBibliotheque(false)}
          onAjout={(nombre) => {
            setBibliotheque(false);
            setAjoutes(nombre);
            setUnite("");
            setNiveau("");
            setRecherche("");
          }}
        />
      )}

      {ajoutes > 0 && (
        <div className="mb-4 flex items-start justify-between gap-3 rounded-sm border border-[#0ca30c] bg-[#0ca30c]/10 p-3 text-sm">
          <p>
            <strong>✓ {ajoutes} risque{ajoutes > 1 ? "s" : ""} ajouté{ajoutes > 1 ? "s" : ""} en bas du tableau.</strong>{" "}
            Pour chacun, indiquez l&apos;effectif exposé et les mesures déjà en place, ajustez la gravité, la fréquence et
            la maîtrise. Les mesures conseillées ont été ajoutées au plan d&apos;actions : précisez-y leur type, un responsable et une échéance.
          </p>
          <button type="button" onClick={() => setAjoutes(0)} aria-label="Fermer" className="text-gris">✕</button>
        </div>
      )}

      {donnees.duerp.length === 0 && modifiable && (
        <div className="mb-6 rounded-sm border border-bronze/60 bg-white p-6 text-center">
          <p className="font-serif text-xl">Votre document unique est vide</p>
          <p className="mx-auto mt-2 max-w-xl text-sm text-ardoise">
            Démarrez à partir de la bibliothèque : choisissez votre métier, cochez les situations qui vous concernent, et
            les risques sont ajoutés au tableau, déjà rédigés.
          </p>
          <button type="button" className={`${classeBouton} mt-4`} onClick={() => setBibliotheque(true)}>
            📚 Ouvrir la bibliothèque de risques
          </button>
        </div>
      )}

      {guide && (
        <div className="mb-8 rounded-sm border border-pierre/70 bg-white p-5 print:hidden">
          <GuideCotation />
        </div>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-2 print:hidden">
        <input
          type="search"
          placeholder="Rechercher…"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          className={`${classeChamp} max-w-60`}
        />
        <select value={unite} onChange={(e) => setUnite(e.target.value)} className={`${classeChamp} max-w-56`}>
          <option value="">Toutes les unités</option>
          {unitesConnues.map((u) => (
            <option key={u}>{u}</option>
          ))}
        </select>
        <select value={niveau} onChange={(e) => setNiveau(e.target.value)} className={`${classeChamp} max-w-48`}>
          <option value="">Tous les niveaux</option>
          {niveauxCriticite.map((n) => (
            <option key={n.code} value={n.code}>
              {n.libelle}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-ardoise">
          <input type="checkbox" checked={tri} onChange={(e) => setTri(e.target.checked)} className="accent-bronze" />
          Trier par priorité
        </label>
        <span className="ml-auto text-sm text-gris">
          {lignes.length} ligne{lignes.length > 1 ? "s" : ""} sur {donnees.duerp.length}
        </span>
      </div>

      <datalist id="liste-unites">
        {unitesConnues.map((u) => (
          <option key={u} value={u} />
        ))}
      </datalist>
      <datalist id="liste-dangers">
        {famillesDangers.map((d) => (
          <option key={d} value={d} />
        ))}
      </datalist>

      {/* Un fieldset désactivé grise d'un coup tous les champs pour les rôles sans droit de modification. */}
      <fieldset disabled={!modifiable} className="min-w-0">
        <div className="max-h-[70vh] overflow-auto rounded-sm border border-pierre/70 bg-white print:max-h-none print:overflow-visible">
          <table className="w-max table-fixed border-separate border-spacing-0 text-sm">
            <thead className="sticky top-0 z-10 bg-marbre">
              <tr>
                {colonnes.map((c) => (
                  <th
                    key={c.titre}
                    title={c.aide}
                    style={{ width: c.largeur }}
                    className="border-b border-r border-pierre/60 px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-ardoise"
                  >
                    {c.titre}
                    <span className="ml-1 cursor-help text-gris print:hidden">ⓘ</span>
                  </th>
                ))}
                <th style={{ width: 112 }} className="border-b border-pierre/60 px-2 py-2 print:hidden" />
              </tr>
            </thead>
            <tbody>
              {lignes.map((l) => {
                const actionsLigne = actionsDuRisque(donnees.actions, l);
                const facteur = facteursPenibilite.find((f) => f.code === l.penibilite);
                return (
                  <tr key={l.id} className="hover:bg-ivoire">
                    <td className={cellule}>
                      <input list="liste-unites" value={l.unite} onChange={(e) => mettreAJour(l.id, { unite: e.target.value })} className={champCellule} />
                    </td>
                    <td className={cellule}>
                      <textarea rows={2} value={l.activite} onChange={(e) => mettreAJour(l.id, { activite: e.target.value })} className={`${champCellule} resize-y`} />
                    </td>
                    <td className={cellule}>
                      <input list="liste-dangers" value={l.danger} onChange={(e) => mettreAJour(l.id, { danger: e.target.value })} className={champCellule} />
                    </td>
                    <td className={cellule}>
                      <textarea rows={2} value={l.risque} onChange={(e) => mettreAJour(l.id, { risque: e.target.value })} className={`${champCellule} resize-y`} />
                    </td>
                    <td className={cellule}>
                      <input type="number" min={0} value={l.effectif} onChange={(e) => mettreAJour(l.id, { effectif: Math.max(0, Number(e.target.value)) })} className={`${champCellule} tabular-nums`} />
                    </td>
                    <td className={cellule}>
                      <select
                        value={l.gravite}
                        title={grilleGravite[l.gravite - 1]?.definition}
                        onChange={(e) => mettreAJour(l.id, { gravite: Number(e.target.value) })}
                        className={champCellule}
                      >
                        {grilleGravite.map((g) => (
                          <option key={g.valeur} value={g.valeur}>
                            {g.valeur} – {g.libelle}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className={cellule}>
                      <select
                        value={l.frequence}
                        title={grilleFrequence[l.frequence - 1]?.definition}
                        onChange={(e) => mettreAJour(l.id, { frequence: Number(e.target.value) })}
                        className={champCellule}
                      >
                        {grilleFrequence.map((f) => (
                          <option key={f.valeur} value={f.valeur}>
                            {f.valeur} – {f.libelle}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className={`${cellule} px-2 py-2`}>
                      <PastilleCriticite score={criticiteBrute(l)} />
                    </td>
                    <td className={cellule}>
                      <textarea rows={2} value={l.mesures} onChange={(e) => mettreAJour(l.id, { mesures: e.target.value })} className={`${champCellule} resize-y`} />
                    </td>
                    <td className={cellule}>
                      <select
                        value={l.maitrise}
                        title={grilleMaitrise.find((m) => m.valeur === l.maitrise)?.definition}
                        onChange={(e) => mettreAJour(l.id, { maitrise: e.target.value as LigneDuerp["maitrise"] })}
                        className={champCellule}
                      >
                        {grilleMaitrise.map((m) => (
                          <option key={m.valeur} value={m.valeur}>
                            {m.libelle} (×{m.coefficient})
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className={`${cellule} px-2 py-2`}>
                      <PastilleCriticite score={risqueResiduel(l)} />
                    </td>
                    <td className={cellule}>
                      <select
                        value={l.penibilite}
                        title={facteur?.seuil}
                        onChange={(e) =>
                          mettreAJour(l.id, {
                            penibilite: e.target.value,
                            seuilPenibilite: e.target.value ? l.seuilPenibilite : "non",
                          })
                        }
                        className={champCellule}
                      >
                        <option value="">Aucun facteur</option>
                        {facteursPenibilite.map((f) => (
                          <option key={f.code} value={f.code}>
                            {f.libelle}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className={cellule}>
                      <select
                        value={l.seuilPenibilite}
                        disabled={!l.penibilite}
                        onChange={(e) => mettreAJour(l.id, { seuilPenibilite: e.target.value as LigneDuerp["seuilPenibilite"] })}
                        className={`${champCellule} disabled:text-gris`}
                      >
                        {seuilsPenibilite.map((s) => (
                          <option key={s.valeur} value={s.valeur}>
                            {s.libelle}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className={`${cellule} px-2 py-1.5`}>
                      <ul className="space-y-1">
                        {actionsLigne.map((a) => {
                          const retard = actionEnRetard(a, aujourdhui);
                          return (
                            <li key={a.id} className="flex items-start gap-1.5 text-xs">
                              <span
                                aria-hidden
                                className="mt-1 h-2 w-2 shrink-0 rounded-full"
                                style={{ background: a.statut === "fait" ? "#0ca30c" : retard ? "#d03b3b" : a.statut === "en-cours" ? "#fab219" : "#d9cfc1" }}
                              />
                              <span className="min-w-0">
                                <span className={a.statut === "fait" ? "text-gris line-through" : ""}>{a.intitule || "Action sans intitulé"}</span>
                                {a.echeance && a.statut !== "fait" && (
                                  <span className={retard ? "font-semibold text-[#b42318]" : "text-gris"}>
                                    {" "}· {retard ? "en retard, " : ""}
                                    {formaterDate(a.echeance)}
                                  </span>
                                )}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                      <span className="mt-1 flex gap-3 text-xs print:hidden">
                        <button type="button" onClick={() => ajouterAction(l)} className="text-bronze underline disabled:hidden">
                          + Action
                        </button>
                        {actionsLigne.length > 0 && (
                          <Link href={`/actions?risque=${l.id}`} className="text-ardoise underline">
                            Gérer ({actionsLigne.length})
                          </Link>
                        )}
                        {evenementsLigne(l) > 0 && (
                          <Link href={`/accidents?risque=${l.id}`} className="text-[#b42318] underline" title="Accidents et presque-accidents rattachés à ce risque">
                            ⚑ {evenementsLigne(l)}
                          </Link>
                        )}
                      </span>
                    </td>
                    <td className="border-b border-pierre/60 p-1 align-top whitespace-nowrap print:hidden">
                      <Link href={`/journal?element=${l.id}`} title="Historique des modifications de la ligne" className="rounded-sm px-2 py-1 text-ardoise hover:bg-marbre">
                        ◷
                      </Link>
                      <button type="button" title="Dupliquer la ligne" onClick={() => ajouter(l)} className="rounded-sm px-2 py-1 text-ardoise hover:bg-marbre">
                        ⧉
                      </button>
                      <button type="button" title="Supprimer la ligne" onClick={() => supprimer(l)} className="rounded-sm px-2 py-1 text-ardoise hover:bg-marbre hover:text-[#b42318]">
                        ✕
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <button
            type="button"
            onClick={() => ajouter()}
            className="sticky left-0 block w-full px-4 py-3 text-left text-sm text-bronze hover:bg-marbre/60 print:hidden"
          >
            + Ajouter une ligne{unite ? ` dans « ${unite} »` : ""}
          </button>
        </div>
      </fieldset>
      <p className="mt-2 text-xs text-gris print:hidden">
        Astuce : survolez un en-tête ⓘ pour son explication, et le bouton ⧉ duplique une ligne pour saisir plus vite un risque proche.
      </p>
    </div>
  );
}
