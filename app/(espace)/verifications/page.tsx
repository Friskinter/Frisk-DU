"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { classeCible, idCible, useCible } from "@/lib/cible";
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
import { nouvelleAction } from "@/lib/actions";
import { deposerAttestation, ouvrirAttestation, supprimerAttestation, TYPES_ACCEPTES } from "@/lib/attestations";
import { dateDuJour, formaterDate, telechargerCsv } from "@/lib/calculs";
import { telechargerRegistreSecurite } from "@/lib/pdf/telecharger";
import {
  derniereVerification,
  etatEquipement,
  etatsEquipement,
  familles,
  nouvelEquipement,
  nouvelleObservation,
  nouvelleVerification,
  observationLevee,
  observationsOuvertes,
  prochaineDate,
  resultats,
  typeEquipement,
  typesEquipement,
  type EtatEquipement,
} from "@/lib/verifications";
import { modifier, peutModifier, useDonnees, useSession } from "@/lib/stockage";
import type { Donnees, Equipement, Observation, Verification } from "@/lib/types";

const libelle = "mb-1 block text-xs font-medium text-ardoise";
const grilleLigne = "lg:grid-cols-[minmax(0,1.6fr)_6rem_minmax(0,1fr)_minmax(0,1fr)_8rem_1.5rem]";

function majEquipement(id: string, champs: Partial<Equipement>) {
  modifier((d) => ({ ...d, equipements: d.equipements.map((e) => (e.id === id ? { ...e, ...champs } : e)) }));
}

function majVerification(id: string, champs: Partial<Verification>) {
  modifier((d) => ({ ...d, verifications: d.verifications.map((v) => (v.id === id ? { ...v, ...champs } : v)) }));
}

const periodicites = [1, 3, 6, 12, 24, 36, 48, 60];
const libellePeriodicite = (mois: number) =>
  mois % 12 === 0 ? (mois === 12 ? "1 an" : `${mois / 12} ans`) : `${mois} mois`;

export default function PageVerifications() {
  // useSearchParams (équipement visé) doit être sous un Suspense avec le pré-rendu de Next.js.
  return (
    <Suspense fallback={<Chargement />}>
      <Verifications />
    </Suspense>
  );
}

function Verifications() {
  const donnees = useDonnees();
  const { role, entrepriseId } = useSession();
  const cible = useCible("equipement", !!donnees);
  const [ouvert, setOuvert] = useState(cible);
  const [famille, setFamille] = useState("");
  const [aTraiter, setATraiter] = useState(false);

  if (!donnees) return <Chargement />;
  const modifiable = peutModifier(role, "tout");
  const aujourdhui = dateDuJour();
  const { equipements, verifications } = donnees;
  const etat = (e: Equipement) => etatEquipement(verifications, e, aujourdhui);
  const ouvertes = observationsOuvertes(equipements, verifications, donnees.actions);
  const compter = (etats: EtatEquipement[]) => equipements.filter((e) => etats.includes(etat(e))).length;

  const liste = equipements.filter(
    (e) =>
      (!famille || typeEquipement(e.type).famille === famille) &&
      (!aTraiter || etat(e) !== "a-jour" || ouvertes.some((o) => o.equipement.id === e.id)),
  );

  const ajouter = () => {
    const e = nouvelEquipement();
    modifier((d) => ({ ...d, equipements: [...d.equipements, e] }));
    setFamille("");
    setATraiter(false);
    setOuvert(e.id);
  };

  const exporter = () =>
    telechargerCsv(`Verifications periodiques - ${donnees.entreprise} - ${aujourdhui}.csv`, [
      ["Équipement", "Type", "Localisation", "Référence", "Périodicité (mois)", "Date de vérification", "Vérificateur", "Résultat", "Prochaine vérification", "Observations", "Rapport joint"],
      ...[...verifications]
        .sort((a, b) => b.date.localeCompare(a.date))
        .flatMap((v) => {
          const e = equipements.find((x) => x.id === v.equipementId);
          if (!e) return [];
          return [[
            e.nom, typeEquipement(e.type).libelle, e.localisation, e.reference, e.periodicite, formaterDate(v.date), v.prestataire,
            resultats.find((r) => r.valeur === v.resultat)?.libelle ?? "", formaterDate(v.prochaine),
            v.observations.filter((o) => o.texte).map((o) => `${o.texte}${observationLevee(o, donnees.actions) ? " (levée)" : ""}`).join(" | "),
            v.rapport ? "Oui" : "Non",
          ]];
        }),
    ]);

  return (
    <div>
      <EnTetePage
        titre="Vérifications périodiques"
        description="Extincteurs, installation électrique, appareils de levage, portes automatiques… Frisk Plateforme propose la périodicité réglementaire, calcule la prochaine échéance et suit les observations des rapports jusqu'à leur levée."
        actions={
          <>
            <button type="button" className={classeBoutonSecondaire} onClick={() => telechargerRegistreSecurite(donnees)}>
              Registre de sécurité (PDF)
            </button>
            <button type="button" className={classeBoutonSecondaire} onClick={exporter}>
              Exporter (Excel)
            </button>
            {modifiable && (
              <button type="button" className={classeBouton} onClick={ajouter}>
                + Équipement
              </button>
            )}
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Indicateur
          libelle="En retard"
          valeur={compter(["en-retard"])}
          detail={`échéance dépassée${compter(["jamais"]) ? ` · ${compter(["jamais"])} jamais vérifié(s)` : ""}`}
          alerte={compter(["en-retard"]) > 0}
        />
        <Indicateur libelle="À prévoir" valeur={compter(["a-prevoir"])} detail="dans les 60 jours" />
        <Indicateur libelle="À jour" valeur={compter(["a-jour"])} detail={`sur ${equipements.length} équipement(s) suivi(s)`} />
        <Indicateur libelle="Observations à lever" valeur={ouvertes.length} detail="relevées lors de la dernière vérification" alerte={ouvertes.length > 0} />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <select aria-label="Filtrer par famille d’équipement" value={famille} onChange={(e) => setFamille(e.target.value)} className={`${classeChamp} max-w-64`}>
          <option value="">Toutes les familles</option>
          {familles.map((f) => (
            <option key={f.valeur} value={f.valeur}>{f.libelle}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-ardoise">
          <input type="checkbox" className="accent-bronze" checked={aTraiter} onChange={(e) => setATraiter(e.target.checked)} />
          À traiter seulement
        </label>
      </div>

      {liste.length === 0 ? (
        <p className="rounded-sm border border-pierre/70 bg-white p-6 text-center text-sm text-gris">
          {equipements.length
            ? "Aucun équipement ne correspond à ces critères."
            : "Aucun équipement suivi. Ajoutez vos extincteurs, votre installation électrique, vos chariots… avec la date de leur dernière vérification."}
        </p>
      ) : (
        <div className="space-y-4">
          {familles.map((f) => {
            const groupe = liste.filter((e) => typeEquipement(e.type).famille === f.valeur);
            if (!groupe.length) return null;
            return (
              <section key={f.valeur} className="rounded-sm border border-pierre/70 bg-white">
                <h2 className="border-b border-pierre/60 bg-marbre px-3 py-2 text-xs font-semibold uppercase tracking-wide text-ardoise">{f.libelle}</h2>
                <div className={`${grilleLigne} hidden gap-x-3 border-b border-pierre/60 px-3 py-1.5 text-xs text-gris lg:grid`}>
                  <span>Équipement</span>
                  <span>Périodicité</span>
                  <span>Dernière vérification</span>
                  <span>Prochaine</span>
                  <span>Observations</span>
                  <span />
                </div>
                <ul>
                  {groupe.map((e) => (
                    <li key={e.id} id={idCible(e.id)} className={`border-b border-pierre/60 last:border-b-0 ${e.id === cible ? classeCible : ""}`}>
                      <LigneEquipement
                        equipement={e}
                        donnees={donnees}
                        aujourdhui={aujourdhui}
                        ouvert={ouvert === e.id}
                        aLever={ouvertes.filter((o) => o.equipement.id === e.id).length}
                        onBasculer={() => setOuvert(ouvert === e.id ? "" : e.id)}
                      />
                      {ouvert === e.id && (
                        <div className="border-t border-pierre/60 bg-ivoire p-3 sm:p-4">
                          <FicheEquipement
                            equipement={e}
                            donnees={donnees}
                            aujourdhui={aujourdhui}
                            modifiable={modifiable}
                            entrepriseId={entrepriseId}
                            onFermer={() => setOuvert("")}
                          />
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PastilleResultat({ resultat }: { resultat: Verification["resultat"] }) {
  const r = resultats.find((x) => x.valeur === resultat)!;
  return <Pastille couleur={r.couleur} texte={r.texte}>{r.libelle}</Pastille>;
}

function LigneEquipement({
  equipement: e,
  donnees,
  aujourdhui,
  ouvert,
  aLever,
  onBasculer,
}: {
  equipement: Equipement;
  donnees: Donnees;
  aujourdhui: string;
  ouvert: boolean;
  aLever: number;
  onBasculer: () => void;
}) {
  const derniere = derniereVerification(donnees.verifications, e.id);
  const etat = etatsEquipement[etatEquipement(donnees.verifications, e, aujourdhui)];
  return (
    <button
      type="button"
      onClick={onBasculer}
      aria-expanded={ouvert}
      className={`${grilleLigne} grid w-full gap-x-3 gap-y-1.5 px-3 py-2.5 text-left text-sm hover:bg-marbre/40 ${ouvert ? "bg-marbre/40" : ""}`}
    >
      <span className="block">
        <span className="block font-medium">{e.nom || "Équipement sans nom"}</span>
        <span className="block text-xs text-gris">{[typeEquipement(e.type).libelle, e.localisation].filter(Boolean).join(" · ")}</span>
      </span>
      <span className="block text-ardoise">{libellePeriodicite(e.periodicite)}</span>
      <span className="block">
        {derniere ? (
          <>
            <span className="block tabular-nums">{formaterDate(derniere.date)}</span>
            <PastilleResultat resultat={derniere.resultat} />
          </>
        ) : (
          <span className="text-xs text-gris">Aucune</span>
        )}
      </span>
      <span className="block">
        {derniere?.prochaine && <span className="block tabular-nums">{formaterDate(derniere.prochaine)}</span>}
        <Pastille couleur={etat.couleur} texte={etat.texte}>{etat.libelle}</Pastille>
      </span>
      <span className={`block text-xs ${aLever ? "font-semibold text-[#b42318]" : "text-gris"}`}>
        {aLever ? `${aLever} à lever` : "—"}
      </span>
      <span className="hidden text-right text-bronze-fonce lg:block">{ouvert ? "▲" : "▼"}</span>
    </button>
  );
}

function FicheEquipement({
  equipement: e,
  donnees,
  aujourdhui,
  modifiable,
  entrepriseId,
  onFermer,
}: {
  equipement: Equipement;
  donnees: Donnees;
  aujourdhui: string;
  modifiable: boolean;
  entrepriseId: string;
  onFermer: () => void;
}) {
  const historique = donnees.verifications.filter((v) => v.equipementId === e.id).sort((a, b) => b.date.localeCompare(a.date));
  const type = typeEquipement(e.type);

  const ajouterVerification = () => {
    const precedente = historique[0];
    const v = nouvelleVerification(e, { date: aujourdhui, prestataire: precedente?.prestataire || e.prestataire });
    modifier((d) => ({ ...d, verifications: [...d.verifications, v] }));
  };
  const supprimer = () => {
    if (!confirm(`Supprimer « ${e.nom || "cet équipement"} » et ses ${historique.length} vérification(s) ?`)) return;
    modifier((d) => ({
      ...d,
      equipements: d.equipements.filter((x) => x.id !== e.id),
      verifications: d.verifications.filter((v) => v.equipementId !== e.id),
    }));
    historique.forEach((v) => v.rapport && void supprimerAttestation(v.rapport.chemin));
    onFermer();
  };
  // Changer de type propose la périodicité usuelle du nouveau type.
  const changerType = (code: string) => majEquipement(e.id, { type: code, periodicite: typeEquipement(code).periodicite });

  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <Carte titre="Équipement">
        <fieldset disabled={!modifiable} className="grid min-w-0 gap-3 sm:grid-cols-2">
          <label className="sm:col-span-2">
            <span className={libelle}>Type</span>
            <select value={e.type} onChange={(x) => changerType(x.target.value)} className={classeChamp}>
              {familles.map((f) => (
                <optgroup key={f.valeur} label={f.libelle}>
                  {typesEquipement.filter((t) => t.famille === f.valeur).map((t) => (
                    <option key={t.code} value={t.code}>{t.libelle}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <label className="sm:col-span-2">
            <span className={libelle}>Désignation</span>
            <input value={e.nom} placeholder="Chariot élévateur n° 1, parc d'extincteurs (18)…" onChange={(x) => majEquipement(e.id, { nom: x.target.value })} className={classeChamp} />
          </label>
          <label>
            <span className={libelle}>Localisation</span>
            <input value={e.localisation} onChange={(x) => majEquipement(e.id, { localisation: x.target.value })} className={classeChamp} />
          </label>
          <label>
            <span className={libelle}>Marque, n° de série ou d&apos;inventaire</span>
            <input value={e.reference} onChange={(x) => majEquipement(e.id, { reference: x.target.value })} className={classeChamp} />
          </label>
          <label>
            <span className={libelle}>Périodicité</span>
            <select value={e.periodicite} onChange={(x) => majEquipement(e.id, { periodicite: Number(x.target.value) })} className={classeChamp}>
              {[...new Set([...periodicites, e.periodicite])].sort((a, b) => a - b).map((m) => (
                <option key={m} value={m}>
                  {libellePeriodicite(m)}{m === type.periodicite ? " (usuelle)" : ""}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className={libelle}>Vérificateur habituel</span>
            <input value={e.prestataire} placeholder="Organisme ou entreprise" onChange={(x) => majEquipement(e.id, { prestataire: x.target.value })} className={classeChamp} />
          </label>
        </fieldset>
        <p className="mt-3 text-xs text-gris">{type.reference}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {modifiable && (
            <button type="button" onClick={supprimer} className={`${classeBoutonSecondaire} hover:text-[#b42318]`}>
              Supprimer l&apos;équipement
            </button>
          )}
          <button type="button" onClick={onFermer} className={classeBoutonSecondaire}>
            Fermer
          </button>
        </div>
      </Carte>

      <Carte
        titre="Vérifications"
        actions={
          modifiable && (
            <button type="button" onClick={ajouterVerification} className={classeBoutonSecondaire}>
              + Saisir une vérification
            </button>
          )
        }
      >
        {historique.length === 0 ? (
          <p className="text-sm text-gris">Aucune vérification enregistrée. Saisissez la dernière effectuée, avec son rapport.</p>
        ) : (
          <ol className="space-y-3">
            {historique.map((v, i) => (
              <FicheVerification
                key={v.id}
                verification={v}
                equipement={e}
                donnees={donnees}
                aujourdhui={aujourdhui}
                modifiable={modifiable}
                entrepriseId={entrepriseId}
                derniere={i === 0}
              />
            ))}
          </ol>
        )}
      </Carte>
    </div>
  );
}

function FicheVerification({
  verification: v,
  equipement: e,
  donnees,
  aujourdhui,
  modifiable,
  entrepriseId,
  derniere,
}: {
  verification: Verification;
  equipement: Equipement;
  donnees: Donnees;
  aujourdhui: string;
  modifiable: boolean;
  entrepriseId: string;
  derniere: boolean;
}) {
  const [envoi, setEnvoi] = useState("");
  const maj = (champs: Partial<Verification>) => majVerification(v.id, champs);
  const majObservation = (id: string, champs: Partial<Observation>) =>
    maj({ observations: v.observations.map((o) => (o.id === id ? { ...o, ...champs } : o)) });

  const deposer = async (fichier: File | undefined) => {
    if (!fichier) return;
    setEnvoi("en-cours");
    try {
      const rapport = await deposerAttestation(entrepriseId, v.id, fichier);
      const ancien = v.rapport?.chemin;
      maj({ rapport });
      if (ancien) void supprimerAttestation(ancien);
      setEnvoi("");
    } catch (erreur) {
      setEnvoi(erreur instanceof Error ? erreur.message : "L'envoi du fichier a échoué.");
    }
  };
  const retirerRapport = () => {
    if (!v.rapport || !confirm("Retirer le rapport joint ?")) return;
    const chemin = v.rapport.chemin;
    maj({ rapport: undefined });
    void supprimerAttestation(chemin);
  };
  const supprimer = () => {
    if (!confirm(`Supprimer la vérification du ${formaterDate(v.date) || "(sans date)"} ?`)) return;
    modifier((d) => ({ ...d, verifications: d.verifications.filter((x) => x.id !== v.id) }));
    if (v.rapport) void supprimerAttestation(v.rapport.chemin);
  };

  return (
    <li className={`rounded-sm border p-3 ${derniere ? "border-bronze/60 bg-white" : "border-pierre/60 bg-marbre/30"}`}>
      <fieldset disabled={!modifiable} className="grid min-w-0 gap-2 sm:grid-cols-2 2xl:grid-cols-4">
        <label>
          <span className={libelle}>Date</span>
          <input
            type="date"
            value={v.date}
            max={aujourdhui}
            onChange={(x) => maj({ date: x.target.value, prochaine: prochaineDate(x.target.value, e.periodicite) })}
            className={classeChamp}
          />
        </label>
        <label>
          <span className={libelle}>Vérificateur</span>
          <input value={v.prestataire} onChange={(x) => maj({ prestataire: x.target.value })} className={classeChamp} />
        </label>
        <label>
          <span className={libelle}>Résultat</span>
          <select value={v.resultat} onChange={(x) => maj({ resultat: x.target.value as Verification["resultat"] })} className={classeChamp}>
            {resultats.map((r) => (
              <option key={r.valeur} value={r.valeur}>{r.libelle}</option>
            ))}
          </select>
        </label>
        <label>
          <span className={libelle}>Prochaine vérification</span>
          <input type="date" value={v.prochaine} onChange={(x) => maj({ prochaine: x.target.value })} className={classeChamp} />
        </label>
      </fieldset>

      <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
        <span className="text-xs font-medium text-ardoise">Rapport :</span>
        {v.rapport ? (
          // Un lien plutôt qu'un bouton : il reste utilisable en lecture seule.
          <a
            href="#"
            onClick={(x) => {
              x.preventDefault();
              void ouvrirAttestation(v.rapport!.chemin);
            }}
            className="text-bronze-fonce underline"
          >
            📎 {v.rapport.nom}
          </a>
        ) : (
          <span className="text-xs text-gris">aucun</span>
        )}
        {modifiable && (
          <>
            <label className="cursor-pointer text-xs text-ardoise underline">
              {v.rapport ? "Remplacer" : "Joindre le rapport (PDF ou photo)"}
              <input
                type="file"
                accept={TYPES_ACCEPTES.join(",")}
                className="sr-only"
                onChange={(x) => {
                  void deposer(x.target.files?.[0]);
                  x.target.value = "";
                }}
              />
            </label>
            {v.rapport && (
              <button type="button" onClick={retirerRapport} className="text-xs text-ardoise underline">
                Retirer
              </button>
            )}
          </>
        )}
        {envoi === "en-cours" && <span className="text-xs text-gris">Envoi…</span>}
        {envoi && envoi !== "en-cours" && <span className="text-xs text-[#b42318]">{envoi}</span>}
      </div>

      {(v.resultat !== "conforme" || v.observations.length > 0) && (
        <Observations
          verification={v}
          equipement={e}
          donnees={donnees}
          aujourdhui={aujourdhui}
          modifiable={modifiable}
          onModifier={majObservation}
          onAjouter={() => maj({ observations: [...v.observations, nouvelleObservation()] })}
          onSupprimer={(id) => maj({ observations: v.observations.filter((o) => o.id !== id) })}
        />
      )}

      {modifiable && (
        <div className="mt-2 text-right">
          <button type="button" onClick={supprimer} className="text-xs text-ardoise underline hover:text-[#b42318]">
            Supprimer cette vérification
          </button>
        </div>
      )}
    </li>
  );
}

function Observations({
  verification: v,
  equipement: e,
  donnees,
  aujourdhui,
  modifiable,
  onModifier,
  onAjouter,
  onSupprimer,
}: {
  verification: Verification;
  equipement: Equipement;
  donnees: Donnees;
  aujourdhui: string;
  modifiable: boolean;
  onModifier: (id: string, champs: Partial<Observation>) => void;
  onAjouter: () => void;
  onSupprimer: (id: string) => void;
}) {
  // Lever une observation par le plan d'actions : l'action est rattachée au risque choisi du DUERP.
  const creerAction = (o: Observation, risqueId: string) => {
    if (!risqueId) return;
    const action = nouvelleAction(risqueId, {
      intitule: `${o.texte || "Observation"} (${e.nom || typeEquipement(e.type).libelle})`,
      echeance: aujourdhui,
    });
    modifier((d) => ({
      ...d,
      actions: [...d.actions, action],
      verifications: d.verifications.map((x) =>
        x.id === v.id ? { ...x, observations: x.observations.map((y) => (y.id === o.id ? { ...y, actionId: action.id } : y)) } : x,
      ),
    }));
  };

  return (
    <div className="mt-3 border-t border-pierre/60 pt-2">
      <p className={libelle}>Observations du rapport</p>
      <fieldset disabled={!modifiable} className="min-w-0">
        <ul className="space-y-2">
          {v.observations.map((o) => {
            const levee = observationLevee(o, donnees.actions);
            const action = o.actionId ? donnees.actions.find((a) => a.id === o.actionId) : undefined;
            return (
              <li key={o.id} className="grid gap-2 sm:grid-cols-[1fr_auto]">
                <input
                  value={o.texte}
                  placeholder="Observation relevée par le vérificateur"
                  onChange={(x) => onModifier(o.id, { texte: x.target.value })}
                  className={`${classeChamp} ${levee ? "text-gris line-through" : ""}`}
                />
                <span className="flex flex-wrap items-center gap-2 text-xs">
                  {levee ? (
                    <span className="text-[#0b6b0b]">
                      ✓ Levée{o.leveeLe ? ` le ${formaterDate(o.leveeLe)}` : " (action réalisée)"}
                      {o.leveeLe && (
                        <button type="button" onClick={() => onModifier(o.id, { leveeLe: "" })} className="ml-1 text-ardoise underline disabled:hidden">
                          annuler
                        </button>
                      )}
                    </span>
                  ) : (
                    <button type="button" onClick={() => onModifier(o.id, { leveeLe: aujourdhui })} className="rounded-sm border border-pierre px-2 py-1 hover:border-bronze disabled:hidden">
                      ✓ Levée
                    </button>
                  )}
                  {action ? (
                    <Link href={`/actions?risque=${action.risqueId}`} className="text-ardoise underline">
                      Action : {action.statut === "fait" ? "réalisée" : action.statut === "en-cours" ? "en cours" : "à faire"}
                    </Link>
                  ) : (
                    !levee &&
                    modifiable &&
                    donnees.duerp.length > 0 && (
                      <select
                        value=""
                        onChange={(x) => creerAction(o, x.target.value)}
                        className="max-w-44 rounded-sm border border-pierre bg-white px-1.5 py-1 text-xs"
                        title="Créer une action dans le plan d'actions, rattachée à un risque du DUERP"
                      >
                        <option value="">→ Plan d&apos;actions…</option>
                        {donnees.duerp.map((l) => (
                          <option key={l.id} value={l.id}>{l.unite} · {l.danger || l.activite || "Risque"}</option>
                        ))}
                      </select>
                    )
                  )}
                  <button type="button" title="Supprimer l'observation" onClick={() => onSupprimer(o.id)} className="px-1 text-ardoise hover:text-[#b42318] disabled:hidden">
                    ✕
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
        {modifiable && (
          <button type="button" onClick={onAjouter} className="mt-2 text-xs text-bronze-fonce underline">
            + Ajouter une observation
          </button>
        )}
      </fieldset>
    </div>
  );
}

