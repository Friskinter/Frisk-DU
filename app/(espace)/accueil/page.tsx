"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { BlocSignature, PaveSignature } from "@/components/signature";
import { Carte, Chargement, EnTetePage, Indicateur, Pastille, PastilleCriticite, classeBouton, classeBoutonSecondaire, classeChamp } from "@/components/ui";
import {
  contrats,
  emargement,
  etatAccueil,
  etatsAccueil,
  formationRenforcee,
  messagesDuTheme,
  nomArrivant,
  nouvelAccueil,
  nouvelleCauserie,
  pointsAccueil,
  risquesDuPoste,
  salariesSansCauserie,
  themesCauserie,
} from "@/lib/accueils";
import { dateDuJour, decalerJours, formaterDate, nouvelId, risqueResiduel, telechargerCsv } from "@/lib/calculs";
import { telechargerEmargement, telechargerFicheAccueil } from "@/lib/pdf/telecharger";
import { modifier, peutModifier, useDonnees, useSession } from "@/lib/stockage";
import type { Accueil, Causerie, Donnees, Signature } from "@/lib/types";

const libelle = "mb-1 block text-xs font-medium text-ardoise";
const grilleAccueil = "lg:grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_7rem_9rem_1.5rem]";
const grilleCauserie = "lg:grid-cols-[7rem_minmax(0,2fr)_minmax(0,1fr)_8rem_1.5rem]";
const HORS_LISTE = "__hors-liste__";

function majAccueil(id: string, champs: Partial<Accueil>) {
  modifier((d) => ({ ...d, accueils: d.accueils.map((a) => (a.id === id ? { ...a, ...champs } : a)) }));
}

function majCauserie(id: string, champs: Partial<Causerie>) {
  modifier((d) => ({ ...d, causeries: d.causeries.map((c) => (c.id === id ? { ...c, ...champs } : c)) }));
}

const unitesDe = (donnees: Donnees) => [...new Set([...donnees.unites, ...donnees.duerp.map((l) => l.unite)].filter(Boolean))];

type Onglet = "accueils" | "causeries";

export default function PageAccueil() {
  // useSearchParams doit être sous un Suspense avec le pré-rendu de Next.js.
  return (
    <Suspense fallback={<Chargement />}>
      <AccueilEtCauseries />
    </Suspense>
  );
}

function AccueilEtCauseries() {
  const donnees = useDonnees();
  const { role } = useSession();
  const parametres = useSearchParams();
  const [onglet, setOnglet] = useState<Onglet>(parametres.get("onglet") === "causeries" || parametres.get("causerie") ? "causeries" : "accueils");

  if (!donnees) return <Chargement />;
  const modifiable = peutModifier(role, "tout");

  return (
    <div>
      <EnTetePage
        titre="Accueil et causeries"
        description="Chaque nouvel arrivant, intérimaire ou stagiaire reçoit un accueil sécurité avant de prendre son poste (art. R4141-2 du Code du travail). Les causeries entretiennent la vigilance de toute l'équipe, en quinze minutes."
      />
      <div className="mb-6 flex gap-1 overflow-x-auto border-b border-pierre" role="tablist">
        {(
          [
            { valeur: "accueils", libelle: "Accueils sécurité" },
            { valeur: "causeries", libelle: "Causeries sécurité" },
          ] as const
        ).map((o) => (
          <button
            key={o.valeur}
            type="button"
            role="tab"
            aria-selected={onglet === o.valeur}
            onClick={() => setOnglet(o.valeur)}
            className={`-mb-px shrink-0 border-b-2 px-4 py-2.5 text-sm transition-colors ${
              onglet === o.valeur ? "border-bronze font-medium text-encre" : "border-transparent text-gris hover:text-encre"
            }`}
          >
            {o.libelle}
          </button>
        ))}
      </div>
      {onglet === "accueils" ? (
        <Accueils donnees={donnees} modifiable={modifiable} ouvertInitial={parametres.get("accueil") ?? ""} />
      ) : (
        <Causeries donnees={donnees} modifiable={modifiable} ouvertInitial={parametres.get("causerie") ?? ""} />
      )}
    </div>
  );
}

// ---------- Accueils sécurité ----------

function Accueils({ donnees, modifiable, ouvertInitial }: { donnees: Donnees; modifiable: boolean; ouvertInitial: string }) {
  const [ouvert, setOuvert] = useState(ouvertInitial);
  const [arrivant, setArrivant] = useState("");
  const aujourdhui = dateDuJour();
  const { accueils, signatures } = donnees;
  const etat = (a: Accueil) => etatAccueil(a, signatures, aujourdhui);
  const compter = (e: string) => accueils.filter((a) => etat(a) === e).length;
  const ordre = { "a-faire": 0, "a-signer": 1, "a-venir": 2, fait: 3 };
  const liste = [...accueils].sort((a, b) => ordre[etat(a)] - ordre[etat(b)] || (b.arriveeLe || "").localeCompare(a.arriveeLe || ""));

  const ajouter = () => {
    const salarie = donnees.salaries.find((s) => s.id === arrivant);
    const a = nouvelAccueil({ salarieId: salarie?.id ?? "", poste: salarie?.poste ?? "", arriveeLe: aujourdhui });
    modifier((d) => ({ ...d, accueils: [a, ...d.accueils] }));
    setArrivant("");
    setOuvert(a.id);
  };

  const exporter = () =>
    telechargerCsv(`Accueils securite - ${donnees.entreprise} - ${aujourdhui}.csv`, [
      ["Nom", "Contrat", "Poste", "Unité de travail", "Arrivée", "Accueil le", "Par", "Points abordés", "Poste à risques", "Signé", "État"],
      ...liste.map((a) => [
        nomArrivant(a, donnees), contrats.find((c) => c.valeur === a.contrat)?.libelle ?? "", a.poste, a.unite, formaterDate(a.arriveeLe), formaterDate(a.accueilLe),
        a.animateur, `${a.points.length}/${pointsAccueil.length}`, a.posteARisque ? "Oui" : "Non", etat(a) === "fait" ? "Oui" : "Non", etatsAccueil[etat(a)].libelle,
      ]),
    ]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        {modifiable ? (
          <div className="flex flex-wrap items-end gap-2">
            <label>
              <span className={libelle}>Nouvel arrivant</span>
              <select value={arrivant} onChange={(e) => setArrivant(e.target.value)} className={`${classeChamp} max-w-72`}>
                <option value="">Choisir…</option>
                <option value={HORS_LISTE}>Intérimaire, stagiaire… (hors liste)</option>
                {donnees.salaries.map((s) => (
                  <option key={s.id} value={s.id}>{s.nom}{s.poste ? ` · ${s.poste}` : ""}</option>
                ))}
              </select>
            </label>
            <button type="button" className={`${classeBouton} disabled:opacity-50`} disabled={!arrivant} onClick={ajouter}>
              + Accueil
            </button>
          </div>
        ) : (
          <span />
        )}
        <button type="button" className={classeBoutonSecondaire} onClick={exporter}>
          Exporter (Excel)
        </button>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Indicateur libelle="Accueils à faire" valeur={compter("a-faire")} detail="personnes arrivées sans accueil" alerte={compter("a-faire") > 0} />
        <Indicateur libelle="À faire signer" valeur={compter("a-signer")} detail="accueil fait, signature manquante" />
        <Indicateur libelle="Arrivées à venir" valeur={compter("a-venir")} detail="accueil à préparer" />
        <Indicateur
          libelle="Accueils faits (12 mois)"
          valeur={accueils.filter((a) => a.accueilLe >= decalerJours(aujourdhui, -365)).length}
          detail={`dont ${accueils.filter((a) => a.accueilLe && formationRenforcee(a)).length} avec formation renforcée`}
        />
      </div>

      {liste.length === 0 ? (
        <p className="rounded-sm border border-pierre/70 bg-white p-6 text-center text-sm text-gris">
          Aucun accueil enregistré. À chaque arrivée (embauche, intérim, stage, changement de poste), créez son accueil sécurité.
        </p>
      ) : (
        <section className="rounded-sm border border-pierre/70 bg-white">
          <div className={`${grilleAccueil} hidden gap-x-3 border-b border-pierre/60 bg-marbre px-3 py-1.5 text-xs text-ardoise lg:grid`}>
            <span>Nouvel arrivant</span>
            <span>Poste</span>
            <span>Arrivée</span>
            <span>Accueil</span>
            <span />
          </div>
          <ul>
            {liste.map((a) => {
              const e = etatsAccueil[etat(a)];
              return (
                <li key={a.id} className="border-b border-pierre/60 last:border-b-0">
                  <button
                    type="button"
                    onClick={() => setOuvert(ouvert === a.id ? "" : a.id)}
                    aria-expanded={ouvert === a.id}
                    className={`${grilleAccueil} grid w-full gap-x-3 gap-y-1.5 px-3 py-2.5 text-left text-sm hover:bg-marbre/40 ${ouvert === a.id ? "bg-marbre/40" : ""}`}
                  >
                    <span className="block min-w-0">
                      <span className="block font-medium">{nomArrivant(a, donnees)}</span>
                      <span className="block text-xs text-gris">{contrats.find((c) => c.valeur === a.contrat)?.libelle}</span>
                    </span>
                    <span className="block min-w-0 text-ardoise">
                      {a.poste || "—"}
                      {formationRenforcee(a) && <span className="block text-xs text-[#b42318]">Formation renforcée</span>}
                    </span>
                    <span className="block tabular-nums">{a.arriveeLe ? formaterDate(a.arriveeLe) : "—"}</span>
                    <span className="block">
                      <Pastille couleur={e.couleur} texte={e.texte}>{e.libelle}</Pastille>
                    </span>
                    <span className="hidden text-right text-bronze-fonce lg:block">{ouvert === a.id ? "▲" : "▼"}</span>
                  </button>
                  {ouvert === a.id && (
                    <div className="border-t border-pierre/60 bg-ivoire p-3 sm:p-4">
                      <FicheAccueil accueil={a} donnees={donnees} modifiable={modifiable} onFermer={() => setOuvert("")} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

function FicheAccueil({ accueil: a, donnees, modifiable, onFermer }: { accueil: Accueil; donnees: Donnees; modifiable: boolean; onFermer: () => void }) {
  const aujourdhui = dateDuJour();
  const risques = risquesDuPoste(donnees.duerp, a.unite);
  const nom = nomArrivant(a, donnees);

  const basculerPoint = (code: string, coche: boolean) =>
    majAccueil(a.id, { points: coche ? [...a.points, code] : a.points.filter((c) => c !== code) });

  const signer = (signature: Signature) => {
    const signatureId = nouvelId();
    modifier((d) => ({
      ...d,
      signatures: { ...d.signatures, [signatureId]: { ...signature, salarieId: a.salarieId } },
      accueils: d.accueils.map((x) => (x.id === a.id ? { ...x, signatureId, accueilLe: x.accueilLe || aujourdhui } : x)),
    }));
  };

  const supprimer = () => {
    if (!confirm(`Supprimer l'accueil sécurité de ${nom} ?`)) return;
    modifier((d) => ({ ...d, accueils: d.accueils.filter((x) => x.id !== a.id) }));
    onFermer();
  };

  return (
    <div className="space-y-3">
      <fieldset disabled={!modifiable} className="min-w-0 space-y-3">
        <div className="grid gap-3 lg:grid-cols-2">
          <Carte titre="Le nouvel arrivant">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="sm:col-span-2">
                <span className={libelle}>Personne</span>
                <select
                  value={a.salarieId || HORS_LISTE}
                  onChange={(e) => {
                    const s = donnees.salaries.find((x) => x.id === e.target.value);
                    majAccueil(a.id, { salarieId: s?.id ?? "", poste: a.poste || s?.poste || "" });
                  }}
                  className={classeChamp}
                >
                  <option value={HORS_LISTE}>Hors liste des salariés (intérimaire, stagiaire…)</option>
                  {donnees.salaries.map((s) => (
                    <option key={s.id} value={s.id}>{s.nom}</option>
                  ))}
                </select>
              </label>
              {!a.salarieId && (
                <label className="sm:col-span-2">
                  <span className={libelle}>Nom et, le cas échéant, agence d&apos;intérim ou école</span>
                  <input value={a.nom} onChange={(e) => majAccueil(a.id, { nom: e.target.value })} className={classeChamp} />
                </label>
              )}
              <label>
                <span className={libelle}>Contrat</span>
                <select value={a.contrat} onChange={(e) => majAccueil(a.id, { contrat: e.target.value as Accueil["contrat"] })} className={classeChamp}>
                  {contrats.map((c) => (
                    <option key={c.valeur} value={c.valeur}>{c.libelle}</option>
                  ))}
                </select>
              </label>
              <label>
                <span className={libelle}>Poste</span>
                <input value={a.poste} onChange={(e) => majAccueil(a.id, { poste: e.target.value })} className={classeChamp} />
              </label>
              <label>
                <span className={libelle}>Unité de travail</span>
                <select value={a.unite} onChange={(e) => majAccueil(a.id, { unite: e.target.value })} className={classeChamp}>
                  <option value="">À préciser</option>
                  {unitesDe(donnees).map((u) => (
                    <option key={u}>{u}</option>
                  ))}
                </select>
              </label>
              <label>
                <span className={libelle}>Arrivée</span>
                <input type="date" value={a.arriveeLe} onChange={(e) => majAccueil(a.id, { arriveeLe: e.target.value })} className={classeChamp} />
              </label>
              <label className="flex items-start gap-2 text-sm sm:col-span-2">
                <input type="checkbox" className="mt-0.5 accent-bronze" checked={a.posteARisque} onChange={(e) => majAccueil(a.id, { posteARisque: e.target.checked })} />
                <span>
                  Poste présentant des risques particuliers pour la santé ou la sécurité
                  {formationRenforcee(a) && (
                    <span className="mt-1 block text-xs text-[#b42318]">
                      CDD ou intérim sur un poste à risques : formation renforcée à la sécurité obligatoire (art. L4154-2), en plus de l&apos;accueil.
                    </span>
                  )}
                </span>
              </label>
            </div>
          </Carte>

          <Carte titre="L'accueil">
            <div className="grid gap-3 sm:grid-cols-2">
              <label>
                <span className={libelle}>Réalisé le</span>
                <input type="date" value={a.accueilLe} max={aujourdhui} onChange={(e) => majAccueil(a.id, { accueilLe: e.target.value })} className={classeChamp} />
              </label>
              <label>
                <span className={libelle}>Par</span>
                <input value={a.animateur} placeholder="Nom et fonction" onChange={(e) => majAccueil(a.id, { animateur: e.target.value })} className={classeChamp} />
              </label>
            </div>
            <p className="mt-3 text-xs text-gris">
              L&apos;accueil se fait avant la prise de poste, puis se complète au poste par le chef d&apos;équipe ou un tuteur.
            </p>
          </Carte>
        </div>

        <Carte titre={`Points abordés (${a.points.length}/${pointsAccueil.length})`}>
          <div className="mb-2">
            <button type="button" className="text-xs text-bronze-fonce underline disabled:hidden" onClick={() => majAccueil(a.id, { points: pointsAccueil.map((p) => p.code) })}>
              Tout cocher
            </button>
          </div>
          <ul className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
            {pointsAccueil.map((p) => (
              <li key={p.code}>
                <label className="flex items-start gap-2 text-sm">
                  <input type="checkbox" className="mt-0.5 accent-bronze" checked={a.points.includes(p.code)} onChange={(e) => basculerPoint(p.code, e.target.checked)} />
                  {p.libelle}
                </label>
              </li>
            ))}
          </ul>
        </Carte>

        <Carte titre="Risques du poste (extrait du document unique)">
          {!a.unite ? (
            <p className="text-sm text-gris">Choisissez l&apos;unité de travail : ses risques s&apos;afficheront ici et sur la fiche d&apos;accueil.</p>
          ) : risques.length === 0 ? (
            <p className="text-sm text-gris">Aucun risque évalué pour « {a.unite} » dans le document unique.</p>
          ) : (
            <ul className="divide-y divide-pierre/60">
              {risques.map((l) => (
                <li key={l.id} className="flex flex-wrap items-start justify-between gap-2 py-2 text-sm">
                  <span className="min-w-0">
                    <span className="font-medium">{l.danger || l.activite}</span>
                    <span className="text-ardoise"> · {l.risque}</span>
                    {l.mesures && <span className="block text-xs text-gris">Mesures : {l.mesures}</span>}
                  </span>
                  <PastilleCriticite score={risqueResiduel(l)} />
                </li>
              ))}
            </ul>
          )}
        </Carte>

        <Carte titre="Compléments">
          <textarea
            rows={3}
            aria-label="Compléments de l'accueil"
            value={a.complement}
            placeholder="Consignes propres au poste, tuteur désigné, formations à prévoir…"
            onChange={(e) => majAccueil(a.id, { complement: e.target.value })}
            className={`${classeChamp} resize-y`}
          />
        </Carte>

        <Carte titre="Signature du nouvel arrivant">
          <div className="max-w-md">
            <BlocSignature
              titre={nom}
              nomPropose={nom}
              signature={a.signatureId ? donnees.signatures?.[a.signatureId] : undefined}
              onValider={signer}
            />
          </div>
        </Carte>
      </fieldset>

      <div className="flex flex-wrap justify-between gap-2">
        <button type="button" className={classeBouton} onClick={() => telechargerFicheAccueil(donnees, a.id)}>
          ⬇ Fiche d&apos;accueil (PDF)
        </button>
        {modifiable && (
          <button type="button" className={`${classeBoutonSecondaire} hover:text-[#b42318]`} onClick={supprimer}>
            Supprimer l&apos;accueil
          </button>
        )}
      </div>
    </div>
  );
}

// ---------- Causeries sécurité ----------

function Causeries({ donnees, modifiable, ouvertInitial }: { donnees: Donnees; modifiable: boolean; ouvertInitial: string }) {
  const [ouvert, setOuvert] = useState(ouvertInitial);
  const [theme, setTheme] = useState("");
  const aujourdhui = dateDuJour();
  const { causeries, signatures } = donnees;
  const recentes = causeries.filter((c) => c.date >= decalerJours(aujourdhui, -365));
  const liste = [...causeries].sort((a, b) => b.date.localeCompare(a.date));
  const absents = salariesSansCauserie(donnees, aujourdhui);

  const ajouter = () => {
    const libre = theme === HORS_LISTE;
    const c = nouvelleCauserie({ date: aujourdhui, theme: libre ? "" : theme, messages: libre ? "" : messagesDuTheme(theme) });
    modifier((d) => ({ ...d, causeries: [c, ...d.causeries] }));
    setTheme("");
    setOuvert(c.id);
  };

  const exporter = () =>
    telechargerCsv(`Causeries securite - ${donnees.entreprise} - ${aujourdhui}.csv`, [
      ["Date", "Thème", "Animée par", "Durée (min)", "Participants", "Signatures", "Remontées"],
      ...liste.map((c) => {
        const e = emargement(c, signatures);
        return [formaterDate(c.date), c.theme, c.animateur, c.duree, e.total, e.signes, c.remarques];
      }),
    ]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        {modifiable ? (
          <div className="flex flex-wrap items-end gap-2">
            <label>
              <span className={libelle}>Nouvelle causerie sur le thème</span>
              <select value={theme} onChange={(e) => setTheme(e.target.value)} className={`${classeChamp} max-w-80`}>
                <option value="">Choisir…</option>
                {themesCauserie.map((t) => (
                  <option key={t.theme}>{t.theme}</option>
                ))}
                <option value={HORS_LISTE}>Autre thème</option>
              </select>
            </label>
            <button type="button" className={`${classeBouton} disabled:opacity-50`} disabled={!theme} onClick={ajouter}>
              + Causerie
            </button>
          </div>
        ) : (
          <span />
        )}
        <button type="button" className={classeBoutonSecondaire} onClick={exporter}>
          Exporter (Excel)
        </button>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Indicateur libelle="Causeries (12 mois)" valeur={recentes.length} detail={liste[0] ? `dernière le ${formaterDate(liste[0].date)}` : "aucune causerie"} />
        <Indicateur libelle="Participations (12 mois)" valeur={recentes.reduce((t, c) => t + c.participants.length, 0)} detail="présences cumulées" />
        <Indicateur
          libelle="Émargements manquants"
          valeur={causeries.reduce((t, c) => t + (emargement(c, signatures).total - emargement(c, signatures).signes), 0)}
          detail="participants n'ayant pas signé"
        />
        <Indicateur
          libelle="Salariés sans causerie"
          valeur={absents.length}
          detail={`sur ${donnees.salaries.length}, depuis 12 mois`}
          alerte={donnees.salaries.length > 0 && absents.length === donnees.salaries.length}
        />
      </div>

      {liste.length === 0 ? (
        <p className="rounded-sm border border-pierre/70 bg-white p-6 text-center text-sm text-gris">
          Aucune causerie. Choisissez un thème ci-dessus : les messages clés sont prêts, il ne reste qu&apos;à réunir l&apos;équipe quinze minutes.
        </p>
      ) : (
        <section className="rounded-sm border border-pierre/70 bg-white">
          <div className={`${grilleCauserie} hidden gap-x-3 border-b border-pierre/60 bg-marbre px-3 py-1.5 text-xs text-ardoise lg:grid`}>
            <span>Date</span>
            <span>Thème</span>
            <span>Animée par</span>
            <span>Émargement</span>
            <span />
          </div>
          <ul>
            {liste.map((c) => {
              const e = emargement(c, signatures);
              return (
                <li key={c.id} className="border-b border-pierre/60 last:border-b-0">
                  <button
                    type="button"
                    onClick={() => setOuvert(ouvert === c.id ? "" : c.id)}
                    aria-expanded={ouvert === c.id}
                    className={`${grilleCauserie} grid w-full gap-x-3 gap-y-1.5 px-3 py-2.5 text-left text-sm hover:bg-marbre/40 ${ouvert === c.id ? "bg-marbre/40" : ""}`}
                  >
                    <span className="block tabular-nums">{c.date ? formaterDate(c.date) : "—"}</span>
                    <span className="block font-medium">{c.theme || "Thème à préciser"}</span>
                    <span className="block text-ardoise">{c.animateur || "—"}</span>
                    <span className={`block text-xs ${e.total && e.signes < e.total ? "text-[#b42318]" : "text-ardoise"}`}>
                      {e.total ? `${e.signes}/${e.total} signé(s)` : "Aucun participant"}
                    </span>
                    <span className="hidden text-right text-bronze-fonce lg:block">{ouvert === c.id ? "▲" : "▼"}</span>
                  </button>
                  {ouvert === c.id && (
                    <div className="border-t border-pierre/60 bg-ivoire p-3 sm:p-4">
                      <FicheCauserie causerie={c} donnees={donnees} modifiable={modifiable} onFermer={() => setOuvert("")} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

function FicheCauserie({ causerie: c, donnees, modifiable, onFermer }: { causerie: Causerie; donnees: Donnees; modifiable: boolean; onFermer: () => void }) {
  const [externe, setExterne] = useState("");
  const [signataire, setSignataire] = useState("");
  const [trace, setTrace] = useState<string | null>(null);
  const presents = new Set(c.participants.map((p) => p.salarieId).filter(Boolean));
  const services = [...new Set(donnees.salaries.map((s) => s.service || "Sans service"))];
  const nomDe = (p: Causerie["participants"][number]) => donnees.salaries.find((s) => s.id === p.salarieId)?.nom || p.nom || "Participant";

  const basculer = (salarieId: string, present: boolean) =>
    majCauserie(c.id, {
      participants: present
        ? [...c.participants, { id: nouvelId(), salarieId, nom: "" }]
        : c.participants.filter((p) => p.salarieId !== salarieId || p.signatureId),
    });
  const ajouterService = (service: string) => {
    const nouveaux = donnees.salaries.filter((s) => (s.service || "Sans service") === service && !presents.has(s.id));
    majCauserie(c.id, { participants: [...c.participants, ...nouveaux.map((s) => ({ id: nouvelId(), salarieId: s.id, nom: "" }))] });
  };
  const ajouterExterne = () => {
    if (!externe.trim()) return;
    majCauserie(c.id, { participants: [...c.participants, { id: nouvelId(), salarieId: "", nom: externe.trim() }] });
    setExterne("");
  };
  const retirer = (id: string) => majCauserie(c.id, { participants: c.participants.filter((p) => p.id !== id) });

  const valider = (participantId: string) => {
    const p = c.participants.find((x) => x.id === participantId);
    if (!p || !trace) return;
    const signatureId = nouvelId();
    modifier((d) => ({
      ...d,
      signatures: { ...d.signatures, [signatureId]: { image: trace, date: dateDuJour(), salarieId: p.salarieId, nom: p.salarieId ? undefined : p.nom } },
      causeries: d.causeries.map((x) => (x.id === c.id ? { ...x, participants: x.participants.map((y) => (y.id === participantId ? { ...y, signatureId } : y)) } : x)),
    }));
    setSignataire("");
    setTrace(null);
  };

  const supprimer = () => {
    if (!confirm(`Supprimer la causerie « ${c.theme || "sans thème"} » et son émargement ?`)) return;
    modifier((d) => ({ ...d, causeries: d.causeries.filter((x) => x.id !== c.id) }));
    onFermer();
  };

  return (
    <div className="space-y-3">
      <fieldset disabled={!modifiable} className="min-w-0 space-y-3">
        <div className="grid gap-3 lg:grid-cols-2">
          <Carte titre="La causerie">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="sm:col-span-2">
                <span className={libelle}>Thème</span>
                <input list="themes-causerie" value={c.theme} onChange={(e) => majCauserie(c.id, { theme: e.target.value })} className={classeChamp} />
                <datalist id="themes-causerie">
                  {themesCauserie.map((t) => <option key={t.theme} value={t.theme} />)}
                </datalist>
              </label>
              <label>
                <span className={libelle}>Date</span>
                <input type="date" value={c.date} onChange={(e) => majCauserie(c.id, { date: e.target.value })} className={classeChamp} />
              </label>
              <label>
                <span className={libelle}>Durée (minutes)</span>
                <input type="number" min={5} step={5} value={c.duree} onChange={(e) => majCauserie(c.id, { duree: Math.max(0, Number(e.target.value)) })} className={classeChamp} />
              </label>
              <label className="sm:col-span-2">
                <span className={libelle}>Animée par</span>
                <input value={c.animateur} onChange={(e) => majCauserie(c.id, { animateur: e.target.value })} className={classeChamp} />
              </label>
            </div>
          </Carte>
          <Carte titre="Contenu">
            <label className="block">
              <span className={libelle}>Messages clés</span>
              <textarea rows={5} value={c.messages} onChange={(e) => majCauserie(c.id, { messages: e.target.value })} className={`${classeChamp} field-sizing-content resize-y`} />
            </label>
            {messagesDuTheme(c.theme) && c.messages !== messagesDuTheme(c.theme) && (
              <button type="button" className="mt-1 text-xs text-bronze-fonce underline disabled:hidden" onClick={() => majCauserie(c.id, { messages: messagesDuTheme(c.theme) })}>
                Reprendre les messages proposés pour ce thème
              </button>
            )}
            <label className="mt-3 block">
              <span className={libelle}>Questions et remontées des participants</span>
              <textarea rows={2} value={c.remarques} onChange={(e) => majCauserie(c.id, { remarques: e.target.value })} className={`${classeChamp} resize-y`} />
            </label>
          </Carte>
        </div>

        <Carte titre={`Participants et émargement (${c.participants.length})`}>
          {donnees.salaries.length > 0 && (
            <details className="mb-3 rounded-sm border border-pierre/70 bg-white p-3" open={c.participants.length === 0}>
              <summary className="cursor-pointer text-sm font-medium">Choisir les participants</summary>
              <div className="mt-3 space-y-3">
                {services.map((service) => (
                  <div key={service}>
                    <div className="mb-1 flex items-center gap-3">
                      <span className="text-xs font-semibold uppercase tracking-wide text-ardoise">{service}</span>
                      <button type="button" className="text-xs text-bronze-fonce underline disabled:hidden" onClick={() => ajouterService(service)}>
                        Tout le service
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      {donnees.salaries
                        .filter((s) => (s.service || "Sans service") === service)
                        .map((s) => (
                          <label key={s.id} className="flex items-center gap-2 text-sm">
                            <input type="checkbox" className="accent-bronze" checked={presents.has(s.id)} onChange={(e) => basculer(s.id, e.target.checked)} />
                            {s.nom}
                          </label>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            </details>
          )}
          <div className="mb-3 flex flex-wrap gap-2">
            <input
              aria-label="Participant hors liste"
              value={externe}
              placeholder="Intérimaire, sous-traitant…"
              onChange={(e) => setExterne(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), ajouterExterne())}
              className={`${classeChamp} max-w-72`}
            />
            <button type="button" className={classeBoutonSecondaire} onClick={ajouterExterne} disabled={!externe.trim()}>
              + Participant
            </button>
          </div>
          {c.participants.length > 0 && (
            <ul className="divide-y divide-pierre/60 rounded-sm border border-pierre/70 bg-white">
              {c.participants.map((p) => {
                const signature = p.signatureId ? donnees.signatures?.[p.signatureId] : undefined;
                return (
                  <li key={p.id} className="p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-medium">{nomDe(p)}</span>
                      {signature ? (
                        // eslint-disable-next-line @next/next/no-img-element -- image en data URL
                        <img src={signature.image} alt={`Signature de ${nomDe(p)}`} className="h-10 w-auto" />
                      ) : (
                        <span className="flex gap-3">
                          <button
                            type="button"
                            className="text-sm text-bronze-fonce underline disabled:hidden"
                            onClick={() => {
                              setSignataire(signataire === p.id ? "" : p.id);
                              setTrace(null);
                            }}
                          >
                            {signataire === p.id ? "Annuler" : "Faire signer"}
                          </button>
                          <button type="button" aria-label={`Retirer ${nomDe(p)}`} className="text-gris hover:text-[#b42318] disabled:hidden" onClick={() => retirer(p.id)}>
                            ✕
                          </button>
                        </span>
                      )}
                    </div>
                    {signataire === p.id && !signature && (
                      <div className="mt-2 max-w-md">
                        <PaveSignature onChange={setTrace} />
                        <button type="button" className={`${classeBouton} mt-2 disabled:opacity-50`} disabled={!trace} onClick={() => valider(p.id)}>
                          Valider la signature de {nomDe(p)}
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Carte>
      </fieldset>

      <div className="flex flex-wrap justify-between gap-2">
        <button type="button" className={classeBouton} onClick={() => telechargerEmargement(donnees, c.id)}>
          ⬇ Feuille d&apos;émargement (PDF)
        </button>
        {modifiable && (
          <button type="button" className={`${classeBoutonSecondaire} hover:text-[#b42318]`} onClick={supprimer}>
            Supprimer la causerie
          </button>
        )}
      </div>
    </div>
  );
}
