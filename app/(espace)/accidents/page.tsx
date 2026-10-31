"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type ReactNode } from "react";
import { LienSignalement } from "@/components/lien-signalement";
import {
  Carte,
  Chargement,
  EnTetePage,
  Indicateur,
  Pastille,
  PastilleCriticite,
  classeBouton,
  classeBoutonSecondaire,
  classeChamp,
} from "@/components/ui";
import { nouvelleAction } from "@/lib/actions";
import { dateDuJour, formatNombre, formaterDate, risqueResiduel, telechargerCsv } from "@/lib/calculs";
import { nouvelleLigne } from "@/lib/donnees";
import {
  actionsDeLEvenement,
  calculerIndicateurs,
  declarationEnRetard,
  ecartsCotation,
  echeanceDeclaration,
  estAccident,
  estClos,
  etapes,
  graviteConstatee,
  nomVictime,
  nouvelEvenement,
  peutAllerAuRegistre,
} from "@/lib/evenements";
import { deposerAttestation, liensPhotos, ouvrirAttestation, supprimerAttestation, TYPES_ACCEPTES } from "@/lib/attestations";
import { telechargerRegistreBenins } from "@/lib/pdf/telecharger";
import {
  declarations,
  facteursAnalyse,
  grilleFrequence,
  grilleGravite,
  grilleMaitrise,
  niveauxSoins,
  principesPrevention,
  statutsAction,
  typesEvenement,
} from "@/lib/referentiel";
import { modifier, peutModifier, useDonnees, useSession } from "@/lib/stockage";
import type { Action, Donnees, Evenement, LigneDuerp, TypeEvenement } from "@/lib/types";

const libelle = "mb-1 block text-xs font-medium text-ardoise";
// Colonnes de la liste sur grand écran ; sur mobile, les informations s'empilent.
const grilleLigne = "lg:grid-cols-[7rem_minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.1fr)_1.5rem]";

function mettreAJour(id: string, champs: Partial<Evenement>) {
  modifier((d) => ({ ...d, evenements: d.evenements.map((e) => (e.id === id ? { ...e, ...champs } : e)) }));
}

// Changer de type ou de conséquences ajuste la déclaration attendue.
function changerType(e: Evenement, type: TypeEvenement) {
  const accident = estAccident({ type });
  if (accident === estAccident(e)) return mettreAJour(e.id, { type });
  mettreAJour(e.id, accident
    ? { type, soins: "premiers-soins", declaration: "a-faire" }
    : { type, soins: "aucun", joursArret: 0, lesions: "", declaration: "non-requise", declareeLe: "" });
}

function changerSoins(e: Evenement, soins: Evenement["soins"]) {
  const registre = e.declaration === "registre" && !peutAllerAuRegistre({ type: e.type, soins });
  mettreAJour(e.id, {
    soins,
    joursArret: soins === "arret" ? e.joursArret : 0,
    ...(registre ? { declaration: "a-faire" as const } : {}),
  });
}

export default function PageAccidents() {
  // useSearchParams doit être sous un Suspense avec le pré-rendu de Next.js.
  return (
    <Suspense fallback={<Chargement />}>
      <Accidents />
    </Suspense>
  );
}

function Accidents() {
  const donnees = useDonnees();
  const { role } = useSession();
  const parametres = useSearchParams();
  const risqueFiltre = parametres.get("risque") ?? "";
  const [ouvert, setOuvert] = useState(parametres.get("evenement") ?? "");
  const [type, setType] = useState("");
  const [annee, setAnnee] = useState("");
  const [aTraiter, setATraiter] = useState(false);
  const [guide, setGuide] = useState(false);
  const [signalement, setSignalement] = useState(parametres.get("signalement") === "1");
  const { entrepriseId } = useSession();

  if (!donnees) return <Chargement />;
  const modifiable = peutModifier(role, "tout");
  const aujourdhui = dateDuJour();
  const indicateurs = calculerIndicateurs(donnees, aujourdhui);

  const liste = [...donnees.evenements]
    .filter(
      (e) =>
        (!risqueFiltre || e.risqueId === risqueFiltre) &&
        (!type || (type === "accidents" ? estAccident(e) : !estAccident(e))) &&
        (!annee || e.date.startsWith(annee)) &&
        (!aTraiter || !estClos(e, donnees.actions)),
    )
    .sort((a, b) => (b.date || "9999").localeCompare(a.date || "9999"));
  const annees = [...new Set(donnees.evenements.map((e) => e.date.slice(0, 4)).filter(Boolean))].sort().reverse();
  const benins = donnees.evenements.filter((e) => e.declaration === "registre");

  const ajouter = (t: TypeEvenement) => {
    const e = nouvelEvenement({ type: t, date: aujourdhui });
    modifier((d) => ({ ...d, evenements: [e, ...d.evenements] }));
    setOuvert(e.id);
  };

  const exporter = () =>
    telechargerCsv(`Registre des accidents - ${donnees.entreprise} - ${aujourdhui}.csv`, [
      ["Date", "Heure", "Type", "Lieu", "Unité de travail", "Personne concernée", "Témoins", "Circonstances", "Lésions", "Conséquences", "Jours d'arrêt", "Déclaration", "Déclarée le", "Gravité potentielle", "Cause principale et enseignements", "Analysé le", "Risque du DUERP", "Cotation revue le"],
      ...liste.map((e) => {
        const risque = donnees.duerp.find((l) => l.id === e.risqueId);
        return [
          formaterDate(e.date), e.heure, typesEvenement.find((t) => t.valeur === e.type)?.libelle ?? "", e.lieu, e.unite,
          nomVictime(e, donnees), e.temoins, e.description, e.lesions,
          estAccident(e) ? niveauxSoins.find((n) => n.valeur === e.soins)?.libelle ?? "" : "", e.joursArret || "",
          declarations.find((x) => x.valeur === e.declaration)?.libelle ?? "", formaterDate(e.declareeLe),
          e.gravitePotentielle || "", e.enseignements, formaterDate(e.analyseeLe),
          risque ? `${risque.danger || risque.activite} (${risque.unite})` : "", formaterDate(e.reevalueLe),
        ];
      }),
    ]);

  return (
    <div>
      <EnTetePage
        titre="Accidents et presque-accidents"
        description="Registre des accidents du travail, des presque-accidents et des situations dangereuses. Chaque événement est déclaré si besoin, analysé pour en comprendre les causes, puis reporté dans le DUERP."
        plus={
          <>
            <button type="button" className={classeBoutonSecondaire} onClick={() => setGuide(!guide)}>
              {guide ? "Masquer la méthode" : "? Méthode"}
            </button>
            <button
              type="button"
              className={classeBoutonSecondaire}
              disabled={!benins.length}
              title={benins.length ? undefined : "Aucun accident inscrit au registre des accidents bénins"}
              onClick={() => telechargerRegistreBenins(donnees)}
            >
              Registre des accidents bénins (PDF)
            </button>
            <button type="button" className={classeBoutonSecondaire} onClick={exporter}>
              Exporter (Excel)
            </button>
          </>
        }
        actions={
          <>
            <button type="button" className={classeBoutonSecondaire} aria-expanded={signalement} onClick={() => setSignalement(!signalement)}>
              📱 Signalement par les salariés
            </button>
            {modifiable && (
              <>
                <button type="button" className={classeBoutonSecondaire} onClick={() => ajouter("presque-accident")}>
                  + Presque-accident
                </button>
                <button type="button" className={classeBouton} onClick={() => ajouter("accident-travail")}>
                  + Accident
                </button>
              </>
            )}
          </>
        }
      />

      {guide && <Methode />}
      {signalement && (
        <div className="mb-4">
          <LienSignalement entrepriseId={entrepriseId} entreprise={donnees.entreprise} identite={donnees.identite} modifiable={modifiable} />
        </div>
      )}

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Indicateur
          libelle="Jours sans accident avec arrêt"
          valeur={indicateurs.joursSansAccident ?? "—"}
          detail={indicateurs.joursSansAccident === null ? "aucun accident avec arrêt enregistré" : "depuis le dernier accident du travail avec arrêt"}
        />
        <Indicateur
          libelle="Accidents avec arrêt (12 mois)"
          valeur={indicateurs.accidentsAvecArret}
          detail={`${indicateurs.joursArret} jour(s) d'arrêt, hors accidents de trajet`}
          alerte={indicateurs.accidentsAvecArret > 0}
        />
        <Indicateur
          libelle="Taux de fréquence · gravité"
          valeur={
            indicateurs.tauxFrequence === null
              ? "—"
              : `${formatNombre.format(indicateurs.tauxFrequence)} · ${formatNombre.format(indicateurs.tauxGravite ?? 0)}`
          }
          detail={
            indicateurs.tauxFrequence === null
              ? "renseignez l'effectif ou les heures travaillées dans les réglages"
              : `accidents par million d'heures · jours d'arrêt pour 1 000 heures${indicateurs.heuresEstimees ? " (heures estimées d'après l'effectif)" : ""}`
          }
        />
        <Indicateur
          libelle="Presque-accidents signalés (12 mois)"
          valeur={indicateurs.presqueAccidents}
          detail="et situations dangereuses : plus on en signale, mieux on prévient"
        />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {risqueFiltre && (
          <Link href="/accidents" className="rounded-full bg-bronze/15 px-3 py-1 text-xs">
            Un seul risque ✕
          </Link>
        )}
        <select aria-label="Filtrer par type d’événement" value={type} onChange={(e) => setType(e.target.value)} className={`${classeChamp} max-w-64`}>
          <option value="">Tous les événements</option>
          <option value="accidents">Accidents (travail et trajet)</option>
          <option value="signalements">Presque-accidents et situations dangereuses</option>
        </select>
        <select aria-label="Filtrer par année" value={annee} onChange={(e) => setAnnee(e.target.value)} className={`${classeChamp} max-w-44`}>
          <option value="">Toutes les années</option>
          {annees.map((a) => (
            <option key={a}>{a}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-ardoise">
          <input type="checkbox" className="accent-bronze" checked={aTraiter} onChange={(e) => setATraiter(e.target.checked)} />
          À traiter seulement
        </label>
      </div>

      {liste.length === 0 ? (
        <p className="rounded-sm border border-pierre/70 bg-white p-6 text-center text-sm text-gris">
          {donnees.evenements.length
            ? "Aucun événement ne correspond à ces critères."
            : "Aucun événement enregistré. Signalez aussi les presque-accidents : ils montrent les risques avant qu'un accident n'arrive."}
        </p>
      ) : (
        <div className="rounded-sm border border-pierre/70 bg-white">
          <div className={`${grilleLigne} hidden gap-x-3 border-b border-pierre/60 bg-marbre px-3 py-2 text-xs font-semibold uppercase tracking-wide text-ardoise lg:grid`}>
            <span>Date</span>
            <span>Événement</span>
            <span>Lieu et personne concernée</span>
            <span>Conséquences</span>
            <span>Avancement</span>
            <span />
          </div>
          <ul>
            {liste.map((e) => (
              <li key={e.id} className="border-b border-pierre/60 last:border-b-0">
                <LigneEvenement
                  evenement={e}
                  donnees={donnees}
                  aujourdhui={aujourdhui}
                  ouvert={ouvert === e.id}
                  onBasculer={() => setOuvert(ouvert === e.id ? "" : e.id)}
                />
                {ouvert === e.id && (
                  <fieldset disabled={!modifiable} className="min-w-0 border-t border-pierre/60 bg-ivoire p-3 sm:p-4">
                    <FicheEvenement evenement={e} donnees={donnees} aujourdhui={aujourdhui} onFermer={() => setOuvert("")} />
                  </fieldset>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function PastilleType({ type }: { type: TypeEvenement }) {
  const t = typesEvenement.find((x) => x.valeur === type)!;
  return (
    <Pastille couleur={t.couleur} texte={t.texte}>
      {t.libelle}
    </Pastille>
  );
}

function LigneEvenement({
  evenement: e,
  donnees,
  aujourdhui,
  ouvert,
  onBasculer,
}: {
  evenement: Evenement;
  donnees: Donnees;
  aujourdhui: string;
  ouvert: boolean;
  onBasculer: () => void;
}) {
  const avancement = etapes(e, donnees.actions);
  const victime = nomVictime(e, donnees);
  const retard = declarationEnRetard(e, aujourdhui);
  const pastilles: { fait: boolean; libelle: string; alerte?: boolean }[] = [
    ...(estAccident(e)
      ? [{ fait: avancement.declaration, libelle: retard ? "Déclaration hors délai" : "Déclaration", alerte: retard }]
      : []),
    { fait: avancement.analyse, libelle: "Analyse" },
    { fait: avancement.risque, libelle: "DUERP" },
    ...(actionsDeLEvenement(donnees.actions, e).length ? [{ fait: avancement.actions, libelle: "Actions" }] : []),
  ];
  return (
    <button
      type="button"
      onClick={onBasculer}
      aria-expanded={ouvert}
      className={`${grilleLigne} grid w-full gap-x-3 gap-y-1.5 px-3 py-2.5 text-left text-sm hover:bg-marbre/40 ${ouvert ? "bg-marbre/40" : ""}`}
    >
      <span className="block whitespace-nowrap tabular-nums">
        {e.date ? formaterDate(e.date) : <span className="text-gris">Date ?</span>}
        {e.heure && <span className="block text-xs text-gris">{e.heure}</span>}
        {e.signalement && <span className="block text-xs text-bronze-fonce">📱 Signalé</span>}
        {!!e.photos?.length && <span className="block text-xs text-gris">📷 {e.photos.length}</span>}
      </span>
      <span className="block">
        <PastilleType type={e.type} />
        <span className="mt-1 line-clamp-2 block text-ardoise">{e.description || <span className="text-gris">Circonstances à décrire</span>}</span>
      </span>
      <span className="block">
        <span className="block">{e.lieu || e.unite || <span className="text-gris">Lieu non précisé</span>}</span>
        {victime && <span className="block text-xs text-gris">{victime}</span>}
      </span>
      <span className="block text-ardoise">
        {estAccident(e) ? (
          <>
            {niveauxSoins.find((n) => n.valeur === e.soins)?.libelle}
            {e.soins === "arret" && e.joursArret > 0 && <span className="block text-xs text-gris">{e.joursArret} jour(s)</span>}
          </>
        ) : (
          <span className="text-xs text-gris">
            {e.gravitePotentielle ? `Gravité potentielle : ${grilleGravite.find((g) => g.valeur === e.gravitePotentielle)?.libelle.toLowerCase()}` : "Sans lésion"}
          </span>
        )}
      </span>
      <span className="block">
        {estClos(e, donnees.actions) ? (
          <Pastille couleur="#0ca30c" texte="#0b0b0b" icone="✓">Traité</Pastille>
        ) : (
          <span className="flex flex-wrap gap-1">
            {pastilles.map((p) => (
              <span
                  key={p.libelle}
                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${
                    p.fait ? "border-transparent bg-[#0ca30c]/10 text-[#0b6b0b]" : p.alerte ? "border-[#d03b3b] text-[#b42318]" : "border-pierre text-ardoise"
                  }`}
                >
                  <span aria-hidden>{p.fait ? "✓" : "○"}</span>
                  {p.libelle}
                </span>
            ))}
          </span>
        )}
      </span>
      <span className="hidden text-right text-bronze-fonce lg:block">{ouvert ? "▲" : "▼"}</span>
    </button>
  );
}

function Section({ numero, titre, children, aide }: { numero: number; titre: string; children: ReactNode; aide?: ReactNode }) {
  return (
    <Carte titre={`${numero}. ${titre}`}>
      {aide && <div className="mb-3 text-xs text-ardoise">{aide}</div>}
      {children}
    </Carte>
  );
}

function FicheEvenement({
  evenement: e,
  donnees,
  aujourdhui,
  onFermer,
}: {
  evenement: Evenement;
  donnees: Donnees;
  aujourdhui: string;
  onFermer: () => void;
}) {
  const accident = estAccident(e);
  const maj = (champs: Partial<Evenement>) => mettreAJour(e.id, champs);
  const supprimer = () => {
    const liees = actionsDeLEvenement(donnees.actions, e).length;
    if (confirm(`Supprimer cet événement du registre ?${liees ? ` Ses ${liees} action(s) restent dans le plan d'actions.` : ""}`)) {
      modifier((d) => ({
        ...d,
        evenements: d.evenements.filter((x) => x.id !== e.id),
        actions: d.actions.map((a) => (a.evenementId === e.id ? { ...a, evenementId: undefined } : a)),
      }));
      e.photos?.forEach((p) => void supprimerAttestation(p.chemin));
      onFermer();
    }
  };
  const unites = [...new Set([...donnees.unites, ...donnees.duerp.map((l) => l.unite)].filter(Boolean))];

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {e.signalement && (
        <p className="rounded-sm border border-bronze/60 bg-bronze/10 p-3 text-sm lg:col-span-2">
          📱 Signalé depuis le terrain par <strong>{e.signalement.par}</strong>, reçu le{" "}
          {new Date(e.signalement.recuLe).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}. Vérifiez les informations, rattachez la
          personne concernée à votre liste de salariés et complétez l&apos;événement.
        </p>
      )}
      <Section
        numero={1}
        titre="Les faits"
        aide="Décrivez ce qui s'est passé, sans jugement ni recherche de coupable : qui faisait quoi, où, avec quel matériel, et ce qui a changé par rapport à d'habitude."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="sm:col-span-2">
            <span className={libelle}>Type d&apos;événement</span>
            <select value={e.type} onChange={(x) => changerType(e, x.target.value as TypeEvenement)} className={classeChamp}>
              {typesEvenement.map((t) => (
                <option key={t.valeur} value={t.valeur}>{t.libelle}</option>
              ))}
            </select>
            <span className="mt-1 block text-xs text-gris">{typesEvenement.find((t) => t.valeur === e.type)?.definition}</span>
          </label>
          <label>
            <span className={libelle}>Date</span>
            <input type="date" value={e.date} max={aujourdhui} onChange={(x) => maj({ date: x.target.value })} className={classeChamp} />
          </label>
          <label>
            <span className={libelle}>Heure</span>
            <input type="time" value={e.heure} onChange={(x) => maj({ heure: x.target.value })} className={classeChamp} />
          </label>
          <label>
            <span className={libelle}>Unité de travail</span>
            <select value={e.unite} onChange={(x) => maj({ unite: x.target.value })} className={classeChamp}>
              <option value="">À préciser</option>
              {unites.map((u) => (
                <option key={u}>{u}</option>
              ))}
            </select>
          </label>
          <label>
            <span className={libelle}>Lieu précis</span>
            <input value={e.lieu} placeholder="Quai 2, allée C…" onChange={(x) => maj({ lieu: x.target.value })} className={classeChamp} />
          </label>
          <label>
            <span className={libelle}>{accident ? "Victime" : "Personne concernée (facultatif)"}</span>
            <select
              value={e.salarieId}
              onChange={(x) => maj({ salarieId: x.target.value, victime: x.target.value === "externe" ? e.victime : "" })}
              className={classeChamp}
            >
              <option value="">{accident ? "À préciser" : "Aucune"}</option>
              {donnees.salaries.map((s) => (
                <option key={s.id} value={s.id}>{s.nom}</option>
              ))}
              <option value="externe">Intérimaire, prestataire, visiteur…</option>
            </select>
          </label>
          {e.salarieId === "externe" ? (
            <label>
              <span className={libelle}>Nom et entreprise</span>
              <input value={e.victime} placeholder="Nom, agence d'intérim…" onChange={(x) => maj({ victime: x.target.value })} className={classeChamp} />
            </label>
          ) : (
            <label>
              <span className={libelle}>Témoins</span>
              <input value={e.temoins} onChange={(x) => maj({ temoins: x.target.value })} className={classeChamp} />
            </label>
          )}
          {e.salarieId === "externe" && (
            <label className="sm:col-span-2">
              <span className={libelle}>Témoins</span>
              <input value={e.temoins} onChange={(x) => maj({ temoins: x.target.value })} className={classeChamp} />
            </label>
          )}
          <label className="sm:col-span-2">
            <span className={libelle}>Circonstances</span>
            <textarea
              rows={3}
              value={e.description}
              placeholder="En déchargeant un carton de 25 kg posé au sol, le salarié a ressenti une douleur dans le dos…"
              onChange={(x) => maj({ description: x.target.value })}
              className={`${classeChamp} resize-y`}
            />
          </label>
          {accident && (
            <>
              <label className="sm:col-span-2">
                <span className={libelle}>Nature et siège des lésions</span>
                <input value={e.lesions} placeholder="Coupure à la main gauche, entorse de la cheville droite…" onChange={(x) => maj({ lesions: x.target.value })} className={classeChamp} />
              </label>
              <label>
                <span className={libelle}>Conséquences</span>
                <select value={e.soins} onChange={(x) => changerSoins(e, x.target.value as Evenement["soins"])} className={classeChamp}>
                  {niveauxSoins.map((n) => (
                    <option key={n.valeur} value={n.valeur}>{n.libelle}</option>
                  ))}
                </select>
              </label>
              {e.soins === "arret" ? (
                <label>
                  <span className={libelle}>Jours d&apos;arrêt (à compléter à la reprise)</span>
                  <input
                    type="number"
                    min={0}
                    value={e.joursArret || ""}
                    onChange={(x) => maj({ joursArret: Math.max(0, Math.round(Number(x.target.value) || 0)) })}
                    className={`${classeChamp} tabular-nums`}
                  />
                </label>
              ) : (
                <label>
                  <span className={libelle}>Premiers soins donnés par</span>
                  <input value={e.secouriste} placeholder="Nom du sauveteur secouriste du travail" onChange={(x) => maj({ secouriste: x.target.value })} className={classeChamp} />
                </label>
              )}
            </>
          )}
          <label className="sm:col-span-2">
            <span className={libelle}>Gravité potentielle : qu&apos;aurait-il pu arriver, dans des circonstances un peu différentes ?</span>
            <select value={e.gravitePotentielle} onChange={(x) => maj({ gravitePotentielle: Number(x.target.value) })} className={classeChamp}>
              <option value={0}>À évaluer</option>
              {grilleGravite.map((g) => (
                <option key={g.valeur} value={g.valeur}>{g.valeur} – {g.libelle} : {g.exemples}</option>
              ))}
            </select>
          </label>
        </div>
        <p className="mt-3 text-xs text-gris">
          Les lésions sont des données de santé : seules les personnes ayant un compte sur cet espace y ont accès.
          N&apos;indiquez que ce qui est utile à la prévention.
        </p>
      </Section>

      <div className="grid content-start gap-3">
        <Declaration evenement={e} aujourdhui={aujourdhui} />
        <Analyse evenement={e} aujourdhui={aujourdhui} />
      </div>

      <ReportDuerp evenement={e} donnees={donnees} aujourdhui={aujourdhui} />
      <ActionsCorrectives evenement={e} donnees={donnees} />
      <Photos evenement={e} />

      <div className="flex flex-wrap items-center justify-between gap-3 lg:col-span-2">
        <Link href={`/journal?element=${e.id}`} className="text-xs text-ardoise underline">
          ◷ Historique des modifications
        </Link>
        <span className="flex gap-2">
          <button type="button" onClick={supprimer} className={`${classeBoutonSecondaire} hover:text-[#b42318] disabled:hidden`}>
            Supprimer l&apos;événement
          </button>
          <button type="button" onClick={onFermer} className={classeBoutonSecondaire}>
            Fermer
          </button>
        </span>
      </div>
    </div>
  );
}

function Declaration({ evenement: e, aujourdhui }: { evenement: Evenement; aujourdhui: string }) {
  if (!estAccident(e)) {
    return (
      <Section numero={2} titre="Déclaration">
        <p className="text-sm text-ardoise">
          Pas de déclaration à la CPAM pour un presque-accident ou une situation dangereuse. Il s&apos;analyse pourtant
          comme un accident : c&apos;est le meilleur moyen d&apos;éviter qu&apos;il se reproduise avec des conséquences.
        </p>
      </Section>
    );
  }
  const echeance = echeanceDeclaration(e);
  const retard = declarationEnRetard(e, aujourdhui);
  const choix = declarations.filter(
    (x) => x.valeur !== "non-requise" && (x.valeur !== "registre" || peutAllerAuRegistre(e) || e.declaration === "registre"),
  );
  return (
    <Section numero={2} titre="Déclaration">
      <div className="grid gap-3">
        <label>
          <span className={libelle}>État</span>
          <select
            value={e.declaration}
            onChange={(x) => {
              const declaration = x.target.value as Evenement["declaration"];
              mettreAJour(e.id, { declaration, declareeLe: declaration === "faite" ? e.declareeLe || aujourdhui : "" });
            }}
            className={`${classeChamp} ${retard ? "font-semibold text-[#b42318]" : ""}`}
          >
            {choix.map((x) => (
              <option key={x.valeur} value={x.valeur}>{x.libelle}</option>
            ))}
          </select>
        </label>
        {e.declaration === "faite" && (
          <label>
            <span className={libelle}>Déclarée le</span>
            <input type="date" value={e.declareeLe} onChange={(x) => mettreAJour(e.id, { declareeLe: x.target.value })} className={classeChamp} />
          </label>
        )}
      </div>
      <p className={`mt-2 text-xs ${retard ? "font-semibold text-[#b42318]" : "text-ardoise"}`}>
        {e.declaration === "a-faire" &&
          (echeance
            ? `${retard ? "⚠ Délai dépassé : " : ""}à déclarer au plus tard le ${formaterDate(echeance)} (48 heures, dimanches non compris, à compter du moment où vous avez eu connaissance de l'accident).`
            : "Indiquez la date de l'accident pour connaître le délai de déclaration.")}
        {e.declaration !== "a-faire" && declarations.find((x) => x.valeur === e.declaration)?.definition}
      </p>
      {e.declaration === "a-faire" && (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-ardoise">
          <li>Déclaration en ligne sur net-entreprises.fr, ou formulaire Cerfa n° 14463 envoyé à la CPAM du salarié.</li>
          <li>Remettez au salarié la feuille d&apos;accident du travail (Cerfa n° 11383) pour ses soins.</li>
          <li>Pour un intérimaire, prévenez l&apos;agence d&apos;intérim : c&apos;est elle qui déclare.</li>
          {peutAllerAuRegistre(e) && (
            <li>Sans arrêt ni soins médicaux, l&apos;accident peut être inscrit au registre des accidents bénins si l&apos;entreprise le tient.</li>
          )}
        </ul>
      )}
    </Section>
  );
}

function Analyse({ evenement: e, aujourdhui }: { evenement: Evenement; aujourdhui: string }) {
  // Une case vide de plus que les réponses déjà données, jusqu'à 5.
  const pourquoi = [...e.pourquoi];
  while (pourquoi.length < 5 && (pourquoi.length === 0 || pourquoi[pourquoi.length - 1].trim())) pourquoi.push("");
  const majPourquoi = (i: number, valeur: string) => {
    const suite = [...e.pourquoi];
    suite[i] = valeur;
    while (suite.length && !suite[suite.length - 1]?.trim()) suite.pop();
    mettreAJour(e.id, { pourquoi: suite.map((p) => p ?? "") });
  };

  return (
    <Section
      numero={3}
      titre="Analyse des causes"
      aide="Un accident a presque toujours plusieurs causes. Partez des faits et demandez-vous « pourquoi ? » jusqu'à trouver une cause sur laquelle l'entreprise peut agir. Faites l'analyse à chaud, avec la personne concernée, les témoins et l'encadrement."
    >
      <p className={libelle}>Les 5 pourquoi</p>
      <ol className="space-y-1.5">
        {pourquoi.map((p, i) => (
          <li key={i} className="flex items-center gap-2">
            <span className="w-20 shrink-0 text-xs text-gris">Pourquoi ? {i + 1}</span>
            <input
              value={p}
              placeholder={i === 0 ? "Pourquoi l'événement s'est-il produit ?" : "Et pourquoi cela ?"}
              onChange={(x) => majPourquoi(i, x.target.value)}
              className={classeChamp}
            />
          </li>
        ))}
      </ol>

      <p className={`${libelle} mt-4`}>Les faits, famille par famille</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {facteursAnalyse.map((f) => (
          <label key={f.cle}>
            <span className="text-xs font-medium">{f.libelle}</span>
            <textarea
              rows={3}
              value={e.facteurs[f.cle]}
              placeholder={f.question}
              onChange={(x) => mettreAJour(e.id, { facteurs: { ...e.facteurs, [f.cle]: x.target.value } })}
              className={`${classeChamp} resize-y text-xs`}
            />
          </label>
        ))}
      </div>

      <label className="mt-4 block">
        <span className={libelle}>Cause principale et enseignements</span>
        <textarea
          rows={2}
          value={e.enseignements}
          placeholder="Ce que l'entreprise retient et doit changer."
          onChange={(x) => mettreAJour(e.id, { enseignements: x.target.value })}
          className={`${classeChamp} resize-y`}
        />
      </label>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label>
          <span className={libelle}>Analyse faite par</span>
          <input value={e.analysePar} placeholder="Employeur, chef d'équipe, salarié, CSE…" onChange={(x) => mettreAJour(e.id, { analysePar: x.target.value })} className={classeChamp} />
        </label>
        <label>
          <span className={libelle}>Analyse terminée le</span>
          <span className="flex gap-2">
            <input type="date" value={e.analyseeLe} onChange={(x) => mettreAJour(e.id, { analyseeLe: x.target.value })} className={`${classeChamp} min-w-0`} />
            {!e.analyseeLe && (
              <button type="button" onClick={() => mettreAJour(e.id, { analyseeLe: aujourdhui })} className={`${classeBoutonSecondaire} whitespace-nowrap disabled:hidden`}>
                Aujourd&apos;hui
              </button>
            )}
          </span>
        </label>
      </div>
    </Section>
  );
}

function ReportDuerp({ evenement: e, donnees, aujourdhui }: { evenement: Evenement; donnees: Donnees; aujourdhui: string }) {
  const risque = donnees.duerp.find((l) => l.id === e.risqueId);
  const ecarts = risque ? ecartsCotation(e, risque, donnees.evenements, aujourdhui) : [];
  // Les risques de la même unité de travail d'abord.
  const proposes = [...donnees.duerp].sort((a, b) => Number(b.unite === e.unite) - Number(a.unite === e.unite));
  const majRisque = (champs: Partial<LigneDuerp>) =>
    modifier((d) => ({ ...d, duerp: d.duerp.map((l) => (l.id === e.risqueId ? { ...l, ...champs } : l)) }));
  const creerRisque = () => {
    const gravite = Math.max(graviteConstatee(e), e.gravitePotentielle, 1);
    const ligne = nouvelleLigne(e.unite || donnees.unites[0] || "", { gravite, effectif: 1 });
    modifier((d) => ({
      ...d,
      duerp: [...d.duerp, ligne],
      evenements: d.evenements.map((x) => (x.id === e.id ? { ...x, risqueId: ligne.id, reevalueLe: "" } : x)),
    }));
  };

  return (
    <Section
      numero={4}
      titre="Report dans le DUERP"
      aide="Le document unique doit être mis à jour quand un accident ou un incident apporte une information nouvelle sur un risque (article R4121-2 du Code du travail). Rattachez l'événement au risque concerné et revoyez sa cotation."
    >
      <label className="block">
        <span className={libelle}>Risque du DUERP concerné</span>
        <select value={risque ? e.risqueId : ""} onChange={(x) => mettreAJour(e.id, { risqueId: x.target.value, reevalueLe: "" })} className={classeChamp}>
          <option value="">À rattacher</option>
          {proposes.map((l) => (
            <option key={l.id} value={l.id}>
              {l.unite} · {l.danger || l.activite || "Risque sans titre"}{l.risque ? ` (${l.risque})` : ""}
            </option>
          ))}
        </select>
      </label>
      {!risque && (
        <p className="mt-2 text-xs text-ardoise">
          Le risque n&apos;apparaît pas dans le DUERP ? C&apos;est qu&apos;il n&apos;avait pas été identifié :{" "}
          <button type="button" onClick={creerRisque} className="text-bronze-fonce underline disabled:no-underline disabled:text-gris">
            l&apos;ajouter au DUERP
          </button>
          , puis complétez la ligne (activité, danger, mesures existantes).
        </p>
      )}
      {risque && (
        <>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <label>
              <span className={libelle}>Gravité</span>
              <select value={risque.gravite} onChange={(x) => majRisque({ gravite: Number(x.target.value) })} className={classeChamp}>
                {grilleGravite.map((g) => (
                  <option key={g.valeur} value={g.valeur}>{g.valeur} – {g.libelle}</option>
                ))}
              </select>
            </label>
            <label>
              <span className={libelle}>Fréquence</span>
              <select value={risque.frequence} onChange={(x) => majRisque({ frequence: Number(x.target.value) })} className={classeChamp}>
                {grilleFrequence.map((f) => (
                  <option key={f.valeur} value={f.valeur}>{f.valeur} – {f.libelle}</option>
                ))}
              </select>
            </label>
            <label>
              <span className={libelle}>Maîtrise</span>
              <select value={risque.maitrise} onChange={(x) => majRisque({ maitrise: x.target.value as LigneDuerp["maitrise"] })} className={classeChamp}>
                {grilleMaitrise.map((m) => (
                  <option key={m.valeur} value={m.valeur}>{m.libelle}</option>
                ))}
              </select>
            </label>
          </div>
          <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-ardoise">
            Risque résiduel : <PastilleCriticite score={risqueResiduel(risque)} />
            <Link href="/duerp" className="underline">Ouvrir le DUERP</Link>
          </p>
          {ecarts.length > 0 && !e.reevalueLe && (
            <ul className="mt-3 space-y-1 rounded-sm border border-[#ec835a] bg-[#ec835a]/10 p-3 text-xs text-[#8a2c0d]">
              {ecarts.map((x) => (
                <li key={x}>⚠ {x}</li>
              ))}
            </ul>
          )}
          <div className="mt-3">
            {e.reevalueLe ? (
              <p className="text-sm text-[#0b6b0b]">
                ✓ Cotation revue le {formaterDate(e.reevalueLe)}{" "}
                <button type="button" onClick={() => mettreAJour(e.id, { reevalueLe: "" })} className="text-xs text-ardoise underline disabled:hidden">
                  annuler
                </button>
              </p>
            ) : (
              <button type="button" onClick={() => mettreAJour(e.id, { reevalueLe: aujourdhui })} className={`${classeBoutonSecondaire} disabled:hidden`}>
                ✓ J&apos;ai revu la cotation de ce risque
              </button>
            )}
          </div>
        </>
      )}
    </Section>
  );
}

function ActionsCorrectives({ evenement: e, donnees }: { evenement: Evenement; donnees: Donnees }) {
  const actions = actionsDeLEvenement(donnees.actions, e);
  const risque = donnees.duerp.find((l) => l.id === e.risqueId);
  const majAction = (id: string, champs: Partial<Action>) =>
    modifier((d) => ({ ...d, actions: d.actions.map((a) => (a.id === id ? { ...a, ...champs } : a)) }));
  const ajouter = () =>
    risque && modifier((d) => ({ ...d, actions: [...d.actions, nouvelleAction(risque.id, { evenementId: e.id })] }));

  return (
    <Section
      numero={5}
      titre="Actions correctives"
      aide="Les actions décidées après l'analyse rejoignent le plan d'actions, sur le risque concerné. Privilégiez les mesures qui suppriment ou réduisent le risque à la source plutôt que les consignes ou les EPI."
    >
      {actions.length > 0 && (
        <ul className="mb-3 space-y-2">
          {actions.map((a) => (
            <li key={a.id} className="grid gap-2 rounded-sm bg-marbre/50 p-2 sm:grid-cols-[1fr_11rem]">
              <input value={a.intitule} placeholder="Intitulé de l'action" onChange={(x) => majAction(a.id, { intitule: x.target.value })} className={`${classeChamp} font-medium`} />
              <select value={a.statut} onChange={(x) => majAction(a.id, { statut: x.target.value as Action["statut"], realiseeLe: x.target.value === "fait" ? a.realiseeLe || dateDuJour() : "" })} className={classeChamp}>
                {statutsAction.map((s) => (
                  <option key={s.valeur} value={s.valeur}>{s.libelle}</option>
                ))}
              </select>
              <select value={a.principe} onChange={(x) => majAction(a.id, { principe: x.target.value as Action["principe"] })} className={`${classeChamp} ${a.principe ? "" : "text-[#b42318]"}`}>
                <option value="">Type de mesure à préciser</option>
                {principesPrevention.map((p) => (
                  <option key={p.valeur} value={p.valeur}>{p.libelle}</option>
                ))}
              </select>
              <input type="date" value={a.echeance} title="Échéance" onChange={(x) => majAction(a.id, { echeance: x.target.value })} className={classeChamp} />
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <button
          type="button"
          onClick={ajouter}
          disabled={!risque}
          title={risque ? undefined : "Rattachez d'abord l'événement à un risque du DUERP"}
          className={`${classeBoutonSecondaire} disabled:opacity-50`}
        >
          + Action corrective
        </button>
        {!risque && <span className="text-xs text-gris">Rattachez d&apos;abord l&apos;événement à un risque du DUERP (étape 4).</span>}
        {risque && actions.length > 0 && (
          <Link href={`/actions?risque=${risque.id}`} className="text-xs text-ardoise underline">
            Compléter dans le plan d&apos;actions (responsable, coût, efficacité)
          </Link>
        )}
      </div>
    </Section>
  );
}

function Methode() {
  return (
    <div className="mb-6 grid gap-4 rounded-sm border border-pierre/70 bg-white p-5 text-sm text-ardoise lg:grid-cols-3">
      <div>
        <p className="font-medium text-encre">Pourquoi signaler les presque-accidents ?</p>
        <p className="mt-1">
          Pour un accident grave, on compte des dizaines d&apos;accidents légers et des centaines de presque-accidents
          (pyramide de Bird). Ils ont les mêmes causes : les signaler et les analyser permet d&apos;agir avant que
          quelqu&apos;un ne soit blessé. Encouragez les équipes à les remonter, sans chercher de coupable.
        </p>
      </div>
      <div>
        <p className="font-medium text-encre">Ce que dit la réglementation</p>
        <ul className="mt-1 list-disc space-y-1 pl-5">
          <li>Accident du travail ou de trajet : déclaration à la CPAM dans les 48 heures (article R441-3 du Code de la sécurité sociale).</li>
          <li>Sans arrêt ni soins médicaux, inscription possible au registre des accidents bénins (article L441-4).</li>
          <li>Le DUERP est mis à jour après toute information nouvelle sur un risque (article R4121-2 du Code du travail).</li>
        </ul>
      </div>
      <div>
        <p className="font-medium text-encre">Comment analyser</p>
        <ol className="mt-1 list-decimal space-y-1 pl-5">
          <li>Recueillir les faits, vite, sur place, avec la personne concernée et les témoins.</li>
          <li>Les classer : individu, tâche, matériel, milieu (méthode de l&apos;INRS).</li>
          <li>Remonter aux causes avec les « 5 pourquoi ».</li>
          <li>Décider d&apos;actions qui suppriment ou réduisent la cause, et revoir la cotation du risque.</li>
        </ol>
      </div>
    </div>
  );
}

// Photos de l'événement : prises par le salarié qui l'a signalé, ou ajoutées ensuite.
function Photos({ evenement: e }: { evenement: Evenement }) {
  const { entrepriseId } = useSession();
  const [liens, setLiens] = useState<Record<string, string>>({});
  const [erreur, setErreur] = useState("");
  const photos = e.photos ?? [];
  const chemins = photos.map((p) => p.chemin).join("|");

  useEffect(() => {
    if (!chemins) return;
    let actif = true;
    void liensPhotos(chemins.split("|")).then((l) => actif && setLiens(l));
    return () => {
      actif = false;
    };
  }, [chemins]);

  const ajouter = async (fichier: File | undefined) => {
    if (!fichier) return;
    setErreur("");
    try {
      const photo = await deposerAttestation(entrepriseId, e.id, fichier);
      modifier((d) => ({ ...d, evenements: d.evenements.map((x) => (x.id === e.id ? { ...x, photos: [...(x.photos ?? []), photo] } : x)) }));
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "L'envoi de la photo a échoué.");
    }
  };

  const retirer = (chemin: string) => {
    if (!confirm("Supprimer cette photo ?")) return;
    modifier((d) => ({ ...d, evenements: d.evenements.map((x) => (x.id === e.id ? { ...x, photos: (x.photos ?? []).filter((p) => p.chemin !== chemin) } : x)) }));
    void supprimerAttestation(chemin);
  };

  return (
    <Carte titre="Photos" className="lg:col-span-2">
      {photos.length === 0 && <p className="mb-2 text-sm text-gris">Aucune photo.</p>}
      {photos.length > 0 && (
        <ul className="mb-3 flex flex-wrap gap-3">
          {photos.map((p, n) => (
            <li key={p.chemin} className="relative">
              <a
                href="#"
                onClick={(x) => {
                  x.preventDefault();
                  void ouvrirAttestation(p.chemin);
                }}
                className="block h-28 w-28 overflow-hidden rounded-sm border border-pierre/70 bg-marbre"
                aria-label={`Ouvrir la photo ${n + 1} en grand`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- lien temporaire du stockage privé */}
                {liens[p.chemin] && <img src={liens[p.chemin]} alt="" className="h-full w-full object-cover" />}
              </a>
              <button
                type="button"
                onClick={() => retirer(p.chemin)}
                aria-label={`Supprimer la photo ${n + 1}`}
                className="absolute -right-2 -top-2 h-6 w-6 rounded-full bg-encre text-xs text-white disabled:hidden"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
      {erreur && <p role="alert" className="mb-2 text-sm text-[#b42318]">{erreur}</p>}
      <label className={`${classeBoutonSecondaire} cursor-pointer has-[:disabled]:hidden`}>
        📷 Ajouter une photo
        <input type="file" accept={TYPES_ACCEPTES.filter((t) => t.startsWith("image/")).join(",")} className="sr-only" onChange={(x) => { void ajouter(x.target.files?.[0]); x.target.value = ""; }} />
      </label>
    </Carte>
  );
}
