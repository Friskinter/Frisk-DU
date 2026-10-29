"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { BlocSignature } from "@/components/signature";
import {
  Carte,
  Chargement,
  EnTetePage,
  Indicateur,
  Pastille,
  classeBouton,
  classeBoutonSecondaire,
  classeChamp,
} from "@/components/ui";
import { dateDuJour, formaterDate, nouvelId, telechargerCsv } from "@/lib/calculs";
import {
  PERMIS_FEU,
  SEUIL_HEURES,
  charges,
  elementsManquants,
  enCoursOuProche,
  estSigne,
  etatIntervention,
  etatsIntervention,
  nouveauRisqueIntervention,
  nouveauSuivi,
  nouvelleIntervention,
  planEcritObligatoire,
  raisonObligation,
  risqueDuTravail,
  risquesCourants,
  travauxDangereux,
} from "@/lib/interventions";
import { telechargerPlanPrevention } from "@/lib/pdf/telecharger";
import { Protocoles } from "./protocoles";
import { modifier, peutModifier, useDonnees, useSession } from "@/lib/stockage";
import type { Donnees, Intervention, RisqueIntervention, Signature, SuiviIntervention } from "@/lib/types";

const libelle = "mb-1 block text-xs font-medium text-ardoise";
const grilleLigne = "lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_9rem_1.5rem]";

function maj(id: string, champs: Partial<Intervention>) {
  modifier((d) => ({ ...d, interventions: d.interventions.map((i) => (i.id === id ? { ...i, ...champs } : i)) }));
}

function signer(id: string, cle: "signatureEu" | "signatureEe", signature: Signature) {
  const signatureId = nouvelId();
  modifier((d) => ({
    ...d,
    signatures: { ...d.signatures, [signatureId]: signature },
    interventions: d.interventions.map((i) => (i.id === id ? { ...i, [cle]: signatureId } : i)),
  }));
}

function majListe<T extends { id: string }>(i: Intervention, cle: "risques" | "suivi", id: string, champs: Partial<T>) {
  maj(i.id, { [cle]: (i[cle] as unknown as T[]).map((x) => (x.id === id ? { ...x, ...champs } : x)) });
}

export default function PageEntreprisesExterieures() {
  // useSearchParams doit être sous un Suspense avec le pré-rendu de Next.js.
  return (
    <Suspense fallback={<Chargement />}>
      <EntreprisesExterieures />
    </Suspense>
  );
}

type Onglet = "plans" | "protocoles";

const onglets: { valeur: Onglet; libelle: string }[] = [
  { valeur: "plans", libelle: "Plans de prévention" },
  { valeur: "protocoles", libelle: "Protocoles de sécurité (transporteurs)" },
];

function EntreprisesExterieures() {
  const donnees = useDonnees();
  const { role } = useSession();
  const parametres = useSearchParams();
  const [onglet, setOnglet] = useState<Onglet>(parametres.get("onglet") === "protocoles" || parametres.get("protocole") ? "protocoles" : "plans");

  if (!donnees) return <Chargement />;
  const modifiable = peutModifier(role, "tout");

  return (
    <div>
      <EnTetePage
        titre="Entreprises extérieures"
        description="Maintenance, nettoyage, travaux, sous-traitants, transporteurs… Avant toute intervention, les deux entreprises analysent ensemble les risques liés à leur présence simultanée et arrêtent les mesures de prévention : plan de prévention (art. R4512-6 du Code du travail) ou, pour les chargements et déchargements, protocole de sécurité (art. R4515-4)."
      />
      <div className="mb-6 flex gap-1 overflow-x-auto border-b border-pierre" role="tablist">
        {onglets.map((o) => (
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
      {onglet === "plans" ? (
        <PlansPrevention donnees={donnees} modifiable={modifiable} ouvertInitial={parametres.get("intervention") ?? ""} />
      ) : (
        <Protocoles donnees={donnees} modifiable={modifiable} ouvertInitial={parametres.get("protocole") ?? ""} />
      )}
    </div>
  );
}

function PlansPrevention({ donnees, modifiable, ouvertInitial }: { donnees: Donnees; modifiable: boolean; ouvertInitial: string }) {
  const [ouvert, setOuvert] = useState(ouvertInitial);
  const [terminees, setTerminees] = useState(false);
  const aujourdhui = dateDuJour();
  const { interventions, signatures } = donnees;
  const etat = (i: Intervention) => etatIntervention(i, signatures, aujourdhui);

  const liste = interventions
    .filter((i) => terminees || etat(i) !== "terminee" || i.id === ouvert)
    .sort((a, b) => (a.debut || "9999").localeCompare(b.debut || "9999"));
  const compter = (etats: string[]) => interventions.filter((i) => etats.includes(etat(i))).length;
  const aVenir30 = interventions.filter((i) => i.debut > aujourdhui && enCoursOuProche(i, aujourdhui, 30)).length;

  const ajouter = () => {
    const courants = risquesCourants
      .filter((r) => r.code === "circulation" || r.code === "coactivite")
      .map((r) => nouveauRisqueIntervention({ phase: r.phase, risque: r.risque, mesures: r.mesures, charge: r.charge }));
    const i = nouvelleIntervention({ debut: aujourdhui, risques: courants, coordinateur: donnees.fiche?.responsable ?? "" });
    modifier((d) => ({ ...d, interventions: [...d.interventions, i] }));
    setOuvert(i.id);
  };

  const exporter = () =>
    telechargerCsv(`Entreprises exterieures - ${donnees.entreprise} - ${aujourdhui}.csv`, [
      ["Entreprise extérieure", "SIRET", "Représentant", "Téléphone", "Nature des travaux", "Lieux", "Début", "Fin", "Effectif", "Heures prévues", "Travaux dangereux", "Plan écrit obligatoire", "Inspection commune", "Risques analysés", "Signé", "État"],
      ...interventions.map((i) => [
        i.entreprise, i.siret, i.responsable, i.telephone, i.objet, i.lieux, formaterDate(i.debut), formaterDate(i.fin), i.effectif, i.heures,
        travauxDangereux.filter((t) => i.travauxDangereux.includes(t.code)).map((t) => t.libelle).join(" | "),
        planEcritObligatoire(i) ? "Oui" : "Non", formaterDate(i.inspectionLe), i.risques.length, estSigne(i, signatures) ? "Oui" : "Non",
        etatsIntervention[etat(i)].libelle,
      ]),
    ]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-3xl text-sm text-ardoise">
          Inspection commune des lieux, analyse des risques d&apos;interférence et mesures arrêtées ensemble. Écrit obligatoire dès {SEUIL_HEURES} heures de
          travaux sur 12 mois ou pour un travail dangereux.
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={classeBoutonSecondaire} onClick={exporter}>
            Exporter (Excel)
          </button>
          {modifiable && (
            <button type="button" className={classeBouton} onClick={ajouter}>
              + Intervention
            </button>
          )}
        </div>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Indicateur libelle="En cours" valeur={compter(["en-cours"])} detail="plan de prévention signé" />
        <Indicateur
          libelle="À préparer ou signer"
          valeur={compter(["a-preparer", "a-signer"])}
          detail="inspection, analyse ou signatures manquantes"
          alerte={interventions.some((i) => enCoursOuProche(i, aujourdhui, 15) && ["a-preparer", "a-signer"].includes(etat(i)))}
        />
        <Indicateur libelle="À venir" valeur={aVenir30} detail="dans les 30 jours" />
        <Indicateur
          libelle="Plans écrits obligatoires"
          valeur={interventions.filter((i) => etat(i) !== "terminee" && planEcritObligatoire(i)).length}
          detail={`${SEUIL_HEURES} h et plus, ou travaux dangereux`}
        />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-sm text-ardoise">
          <input type="checkbox" className="accent-bronze" checked={terminees} onChange={(e) => setTerminees(e.target.checked)} />
          Afficher les interventions terminées
        </label>
      </div>

      {liste.length === 0 ? (
        <p className="rounded-sm border border-pierre/70 bg-white p-6 text-center text-sm text-gris">
          {interventions.length
            ? "Aucune intervention en cours ou à venir."
            : "Aucune intervention enregistrée. Ajoutez la prochaine venue d'une entreprise extérieure pour préparer son plan de prévention."}
        </p>
      ) : (
        <section className="rounded-sm border border-pierre/70 bg-white">
          <div className={`${grilleLigne} hidden gap-x-3 border-b border-pierre/60 bg-marbre px-3 py-1.5 text-xs text-ardoise lg:grid`}>
            <span>Entreprise et travaux</span>
            <span>Dates</span>
            <span>Plan de prévention</span>
            <span />
          </div>
          <ul>
            {liste.map((i) => {
              const e = etatsIntervention[etat(i)];
              return (
                <li key={i.id} className="border-b border-pierre/60 last:border-b-0">
                  <button
                    type="button"
                    onClick={() => setOuvert(ouvert === i.id ? "" : i.id)}
                    aria-expanded={ouvert === i.id}
                    className={`${grilleLigne} grid w-full gap-x-3 gap-y-1.5 px-3 py-2.5 text-left text-sm hover:bg-marbre/40 ${ouvert === i.id ? "bg-marbre/40" : ""}`}
                  >
                    <span className="block min-w-0">
                      <span className="block font-medium">{i.entreprise || "Entreprise sans nom"}</span>
                      <span className="block truncate text-xs text-gris">{[i.objet, i.lieux].filter(Boolean).join(" · ") || "Travaux à préciser"}</span>
                    </span>
                    <span className="block tabular-nums text-ardoise">
                      {i.debut ? `${formaterDate(i.debut)}${i.fin ? ` → ${formaterDate(i.fin)}` : ""}` : "Dates à préciser"}
                    </span>
                    <span className="flex flex-wrap items-center gap-1.5">
                      <Pastille couleur={e.couleur} texte={e.texte}>{e.libelle}</Pastille>
                      {planEcritObligatoire(i) && <span className="text-xs text-gris">écrit obligatoire</span>}
                    </span>
                    <span className="hidden text-right text-bronze-fonce lg:block">{ouvert === i.id ? "▲" : "▼"}</span>
                  </button>
                  {ouvert === i.id && (
                    <div className="border-t border-pierre/60 bg-ivoire p-3 sm:p-4">
                      <FicheIntervention intervention={i} donnees={donnees} modifiable={modifiable} onFermer={() => setOuvert("")} />
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

function FicheIntervention({
  intervention: i,
  donnees,
  modifiable,
  onFermer,
}: {
  intervention: Intervention;
  donnees: Donnees;
  modifiable: boolean;
  onFermer: () => void;
}) {
  const manquants = elementsManquants(i, donnees.signatures);
  const obligatoire = planEcritObligatoire(i);
  const signe = estSigne(i, donnees.signatures);
  // Dès la première signature, le contenu ne change plus sans nouvelles signatures.
  const verrouille = !!(i.signatureEu || i.signatureEe);
  const deverrouiller = () => {
    if (!confirm("Modifier le plan ? Les signatures actuelles seront retirées du plan : les deux représentants devront signer à nouveau.")) return;
    maj(i.id, { signatureEu: undefined, signatureEe: undefined });
  };

  const basculerTravail = (code: string, coche: boolean) => {
    if (!coche) {
      maj(i.id, { travauxDangereux: i.travauxDangereux.filter((c) => c !== code) });
      return;
    }
    // Le risque type du travail coché est ajouté à l'analyse, s'il n'y est pas déjà.
    const risque = risqueDuTravail(code);
    const present = i.risques.some((r) => r.phase === risque?.phase);
    maj(i.id, {
      travauxDangereux: [...i.travauxDangereux, code],
      risques: risque && !present ? [...i.risques, risque] : i.risques,
    });
  };

  const ajouterRisque = (code: string) => {
    const type = risquesCourants.find((r) => r.code === code);
    const r = type ? nouveauRisqueIntervention({ phase: type.phase, risque: type.risque, mesures: type.mesures, charge: type.charge }) : nouveauRisqueIntervention();
    maj(i.id, { risques: [...i.risques, r] });
  };

  const supprimer = () => {
    if (!confirm(`Supprimer l'intervention de « ${i.entreprise || "cette entreprise"} » et son plan de prévention ?`)) return;
    modifier((d) => ({ ...d, interventions: d.interventions.filter((x) => x.id !== i.id) }));
    onFermer();
  };

  return (
    <div className="space-y-3">
      {manquants.length > 0 ? (
        <p className="rounded-sm border border-[#fab219] bg-[#fab219]/10 p-3 text-sm">
          <span className="font-medium">Pour finaliser le plan de prévention, il manque : </span>
          {manquants.join(", ")}.
        </p>
      ) : (
        <p className="rounded-sm border border-[#0ca30c] bg-[#0ca30c]/10 p-3 text-sm">
          Plan de prévention complet et signé. Remettez-en un exemplaire à l&apos;entreprise extérieure et présentez les mesures à vos salariés concernés.
        </p>
      )}

      {verrouille && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-pierre/70 bg-white p-3 text-sm">
          <span className="text-ardoise">
            Plan {signe ? "signé" : "en cours de signature"} : son contenu est verrouillé pour rester conforme à ce qui a été signé. Les inspections et
            réunions de coordination restent modifiables.
          </span>
          {modifiable && (
            <button type="button" className={classeBoutonSecondaire} onClick={deverrouiller}>
              Modifier le plan
            </button>
          )}
        </div>
      )}

      <fieldset disabled={!modifiable} className="min-w-0 space-y-3">
        <fieldset disabled={verrouille} className="min-w-0 space-y-3">
        <div className="grid gap-3 lg:grid-cols-2">
          <Carte titre="1. Entreprise extérieure">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="sm:col-span-2">
                <span className={libelle}>Raison sociale</span>
                <input value={i.entreprise} placeholder="Nom de l'entreprise extérieure" onChange={(x) => maj(i.id, { entreprise: x.target.value })} className={classeChamp} />
              </label>
              <label>
                <span className={libelle}>SIRET</span>
                <input value={i.siret} onChange={(x) => maj(i.id, { siret: x.target.value })} className={classeChamp} />
              </label>
              <label>
                <span className={libelle}>Représentant (nom, fonction)</span>
                <input value={i.responsable} onChange={(x) => maj(i.id, { responsable: x.target.value })} className={classeChamp} />
              </label>
              <label>
                <span className={libelle}>Téléphone</span>
                <input type="tel" value={i.telephone} onChange={(x) => maj(i.id, { telephone: x.target.value })} className={classeChamp} />
              </label>
              <label>
                <span className={libelle}>E-mail</span>
                <input type="email" value={i.email} onChange={(x) => maj(i.id, { email: x.target.value })} className={classeChamp} />
              </label>
              <label className="sm:col-span-2">
                <span className={libelle}>Sous-traitants éventuels</span>
                <input value={i.sousTraitants} placeholder="Nom et activité de chaque sous-traitant" onChange={(x) => maj(i.id, { sousTraitants: x.target.value })} className={classeChamp} />
              </label>
            </div>
          </Carte>

          <Carte titre="2. L'intervention">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="sm:col-span-2">
                <span className={libelle}>Nature des travaux</span>
                <textarea rows={2} value={i.objet} placeholder="Maintenance des portes de quai, nettoyage des sols…" onChange={(x) => maj(i.id, { objet: x.target.value })} className={`${classeChamp} resize-y`} />
              </label>
              <label className="sm:col-span-2">
                <span className={libelle}>Lieux et unités de travail concernés</span>
                <input list="liste-unites-ee" value={i.lieux} onChange={(x) => maj(i.id, { lieux: x.target.value })} className={classeChamp} />
                <datalist id="liste-unites-ee">
                  {donnees.unites.map((u) => <option key={u} value={u} />)}
                </datalist>
              </label>
              <label>
                <span className={libelle}>Début</span>
                <input type="date" value={i.debut} onChange={(x) => maj(i.id, { debut: x.target.value })} className={classeChamp} />
              </label>
              <label>
                <span className={libelle}>Fin prévue</span>
                <input type="date" value={i.fin} min={i.debut || undefined} onChange={(x) => maj(i.id, { fin: x.target.value })} className={classeChamp} />
              </label>
              <label>
                <span className={libelle}>Nombre d&apos;intervenants</span>
                <input type="number" min={1} value={i.effectif} onChange={(x) => maj(i.id, { effectif: Math.max(1, Number(x.target.value)) })} className={classeChamp} />
              </label>
              <label>
                <span className={libelle}>Durée prévue (heures sur 12 mois)</span>
                <input type="number" min={0} step={10} value={i.heures} onChange={(x) => maj(i.id, { heures: Math.max(0, Number(x.target.value)) })} className={classeChamp} />
              </label>
              <label className="sm:col-span-2">
                <span className={libelle}>Représentant de votre entreprise</span>
                <input value={i.coordinateur} placeholder="Personne qui coordonne l'intervention" onChange={(x) => maj(i.id, { coordinateur: x.target.value })} className={classeChamp} />
              </label>
            </div>
            <p className={`mt-3 text-xs ${obligatoire ? "font-medium text-[#b42318]" : "text-gris"}`}>
              {obligatoire
                ? `Plan de prévention écrit obligatoire : ${raisonObligation(i)}.`
                : `Plan écrit non obligatoire sous ${SEUIL_HEURES} heures et sans travaux dangereux, mais l'inspection commune et l'analyse des risques restent dues. Un écrit est toujours recommandé.`}
            </p>
          </Carte>
        </div>

        <Carte titre="3. Travaux dangereux (arrêté du 19 mars 1993)">
          <p className="mb-3 text-xs text-gris">
            Cochez les travaux concernés : le plan devient obligatoirement écrit, quelle que soit la durée, et un risque type est ajouté à l&apos;analyse.
          </p>
          <div className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
            {travauxDangereux.map((t) => (
              <label key={t.code} className="flex items-start gap-2 text-sm">
                <input type="checkbox" className="mt-0.5 accent-bronze" checked={i.travauxDangereux.includes(t.code)} onChange={(x) => basculerTravail(t.code, x.target.checked)} />
                {t.libelle}
              </label>
            ))}
          </div>
          {i.travauxDangereux.includes(PERMIS_FEU) && (
            <p className="mt-3 rounded-sm border border-[#d03b3b] bg-[#d03b3b]/10 p-2 text-sm">
              Travaux par points chauds : délivrez un permis de feu avant chaque intervention et organisez une surveillance après la fin des travaux.
            </p>
          )}
        </Carte>

        <Carte titre="4. Inspection commune préalable">
          <div className="grid gap-3 sm:grid-cols-[12rem_1fr]">
            <label>
              <span className={libelle}>Date</span>
              <input type="date" value={i.inspectionLe} onChange={(x) => maj(i.id, { inspectionLe: x.target.value })} className={classeChamp} />
            </label>
            <label>
              <span className={libelle}>Participants</span>
              <input value={i.inspectionPar} placeholder="Noms et entreprises" onChange={(x) => maj(i.id, { inspectionPar: x.target.value })} className={classeChamp} />
            </label>
          </div>
          <p className="mt-2 text-xs text-gris">
            Avant les travaux, les deux entreprises visitent ensemble les lieux, les installations et les matériels concernés, et délimitent la zone d&apos;intervention.
          </p>
        </Carte>

        <Carte titre="5. Risques liés à l'interférence des activités">
          <p className="mb-3 text-xs text-gris">
            Pour chaque phase de travail, les risques dus à la présence simultanée des deux entreprises et les mesures prises par chacune.
          </p>
          {i.risques.length === 0 && <p className="mb-3 text-sm text-gris">Aucun risque analysé.</p>}
          <ul className="space-y-3">
            {i.risques.map((r, n) => (
              <LigneRisque key={r.id} intervention={i} risque={r} numero={n + 1} />
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className={classeBoutonSecondaire} onClick={() => ajouterRisque("")}>
              + Risque
            </button>
            <select
              aria-label="Ajouter un risque type"
              value=""
              onChange={(x) => x.target.value && ajouterRisque(x.target.value)}
              className={`${classeChamp} max-w-72`}
            >
              <option value="">Ajouter un risque type…</option>
              {risquesCourants.map((r) => (
                <option key={r.code} value={r.code}>{r.phase}</option>
              ))}
            </select>
          </div>
        </Carte>

        <Carte titre="6. Consignes et organisation">
          <div className="grid gap-3 lg:grid-cols-3">
            <label>
              <span className={libelle}>Instructions données aux intervenants</span>
              <textarea rows={4} value={i.consignes} placeholder="Accueil sécurité, accès, circulation, zones interdites, EPI obligatoires…" onChange={(x) => maj(i.id, { consignes: x.target.value })} className={`${classeChamp} resize-y`} />
            </label>
            <label>
              <span className={libelle}>Matériels et installations mis à disposition</span>
              <textarea rows={4} value={i.materiels} placeholder="Locaux, énergies, matériel prêté, consignations…" onChange={(x) => maj(i.id, { materiels: x.target.value })} className={`${classeChamp} resize-y`} />
            </label>
            <label>
              <span className={libelle}>Premiers secours et alerte</span>
              <textarea rows={4} value={i.secours} placeholder="Sauveteurs secouristes, trousse, numéros d'urgence, point de rassemblement…" onChange={(x) => maj(i.id, { secours: x.target.value })} className={`${classeChamp} resize-y`} />
            </label>
          </div>
          <label className="mt-3 block">
            <span className={libelle}>Remarques</span>
            <input value={i.notes} onChange={(x) => maj(i.id, { notes: x.target.value })} className={classeChamp} />
          </label>
        </Carte>

        </fieldset>

        <Carte titre="7. Inspections et réunions de coordination">
          {i.suivi.length === 0 && <p className="mb-3 text-sm text-gris">Aucune pour l&apos;instant. Pour les travaux longs ou dangereux, prévoyez des points réguliers sur le terrain.</p>}
          <ul className="space-y-2">
            {i.suivi.map((x) => (
              <li key={x.id} className="grid gap-2 sm:grid-cols-[10rem_10rem_1fr_auto]">
                <input type="date" aria-label="Date" value={x.date} onChange={(e) => majListe<SuiviIntervention>(i, "suivi", x.id, { date: e.target.value })} className={classeChamp} />
                <select aria-label="Type" value={x.type} onChange={(e) => majListe<SuiviIntervention>(i, "suivi", x.id, { type: e.target.value as SuiviIntervention["type"] })} className={classeChamp}>
                  <option value="inspection">Inspection</option>
                  <option value="reunion">Réunion</option>
                </select>
                <input aria-label="Observations" value={x.observations} placeholder="Observations, mesures complémentaires…" onChange={(e) => majListe<SuiviIntervention>(i, "suivi", x.id, { observations: e.target.value })} className={classeChamp} />
                <button type="button" title="Supprimer" onClick={() => maj(i.id, { suivi: i.suivi.filter((y) => y.id !== x.id) })} className="px-2 text-gris hover:text-[#b42318]">
                  ✕
                </button>
              </li>
            ))}
          </ul>
          <button type="button" className={`${classeBoutonSecondaire} mt-3`} onClick={() => maj(i.id, { suivi: [...i.suivi, nouveauSuivi({ date: dateDuJour() })] })}>
            + Inspection ou réunion
          </button>
        </Carte>

        <Carte titre="8. Signatures">
          {signe ? (
            <p className="mb-3 text-xs text-gris">
              Plan signé. Si les travaux ou les risques changent, cliquez sur « Modifier le plan » : les deux représentants devront le signer à nouveau.
            </p>
          ) : (
            <p className="mb-3 text-xs text-gris">
              Faites signer le plan par les deux représentants, sur tablette ou à la souris, une fois l&apos;analyse terminée. Une signature ne peut plus être modifiée.
            </p>
          )}
          <div className="grid gap-4 lg:grid-cols-2">
            <BlocSignature
              titre="Entreprise utilisatrice"
              nomPropose={i.coordinateur}
              signature={i.signatureEu ? donnees.signatures?.[i.signatureEu] : undefined}
              onValider={(signature) => signer(i.id, "signatureEu", signature)}
            />
            <BlocSignature
              titre="Entreprise extérieure"
              nomPropose={i.responsable}
              signature={i.signatureEe ? donnees.signatures?.[i.signatureEe] : undefined}
              onValider={(signature) => signer(i.id, "signatureEe", signature)}
            />
          </div>
        </Carte>
      </fieldset>

      <div className="flex flex-wrap justify-between gap-2">
        <button type="button" className={classeBouton} onClick={() => telechargerPlanPrevention(donnees, i.id)}>
          ⬇ Plan de prévention (PDF)
        </button>
        {modifiable && (
          <button type="button" className={`${classeBoutonSecondaire} hover:text-[#b42318]`} onClick={supprimer}>
            Supprimer l&apos;intervention
          </button>
        )}
      </div>
    </div>
  );
}

function LigneRisque({ intervention: i, risque: r, numero }: { intervention: Intervention; risque: RisqueIntervention; numero: number }) {
  const changer = (champs: Partial<RisqueIntervention>) => majListe<RisqueIntervention>(i, "risques", r.id, champs);
  return (
    <li className="rounded-sm border border-pierre/70 bg-white p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-ardoise">Risque {numero}</span>
        <button type="button" title="Supprimer ce risque" onClick={() => maj(i.id, { risques: i.risques.filter((x) => x.id !== r.id) })} className="px-2 text-gris hover:text-[#b42318]">
          ✕
        </button>
      </div>
      <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.4fr)_13rem]">
        <label>
          <span className={libelle}>Phase ou situation</span>
          <textarea rows={3} value={r.phase} onChange={(x) => changer({ phase: x.target.value })} className={`${classeChamp} field-sizing-content resize-y`} />
        </label>
        <label>
          <span className={libelle}>Risque</span>
          <textarea rows={3} value={r.risque} onChange={(x) => changer({ risque: x.target.value })} className={`${classeChamp} field-sizing-content resize-y`} />
        </label>
        <label>
          <span className={libelle}>Mesures de prévention</span>
          <textarea rows={3} value={r.mesures} onChange={(x) => changer({ mesures: x.target.value })} className={`${classeChamp} field-sizing-content resize-y`} />
        </label>
        <label>
          <span className={libelle}>À la charge de</span>
          <select value={r.charge} onChange={(x) => changer({ charge: x.target.value as RisqueIntervention["charge"] })} className={classeChamp}>
            {charges.map((c) => (
              <option key={c.valeur} value={c.valeur}>{c.libelle}</option>
            ))}
          </select>
        </label>
      </div>
    </li>
  );
}
