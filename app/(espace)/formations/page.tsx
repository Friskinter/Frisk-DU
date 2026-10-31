"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState, type ReactNode } from "react";
import { classeCible, idCible, useCible } from "@/lib/cible";
import {
  Chargement,
  EnTetePage,
  Indicateur,
  Pastille,
  classeBouton,
  classeBoutonSecondaire,
  classeChamp,
} from "@/components/ui";
import { deposerAttestation, ouvrirAttestation, supprimerAttestation, TYPES_ACCEPTES } from "@/lib/attestations";
import { dateDuJour, formaterDate, nouvelId, telechargerCsv } from "@/lib/calculs";
import {
  calculerExpiration,
  estRemplacee,
  etatFormation,
  etatsFormation,
  exigencesDuPoste,
  formationsEnVigueur,
  formationsManquantes,
  libelleFormation,
  nouvelleExigence,
  nouvelleFormation,
  postesConnus,
  typeFormation,
  typesFormation,
  DELAI_RENOUVELLEMENT,
} from "@/lib/formations";
import { telechargerEtatFormations } from "@/lib/pdf/telecharger";
import { modifier, peutModifier, useDonnees, useSession } from "@/lib/stockage";
import type { Donnees, Formation } from "@/lib/types";

type Onglet = "tableau" | "registre" | "postes";
type Edition = { formation: Formation; nouvelle: boolean } | { session: true } | null;

const onglets: { valeur: Onglet; libelle: string }[] = [
  { valeur: "tableau", libelle: "Tableau des habilitations" },
  { valeur: "registre", libelle: "Registre des formations" },
  { valeur: "postes", libelle: "Formations exigées par poste" },
];

const libelle = "mb-1 block text-xs font-medium text-ardoise";

function PastilleEtat({ formation, aujourdhui, children }: { formation: Formation; aujourdhui: string; children?: ReactNode }) {
  const etat = etatsFormation[etatFormation(formation, aujourdhui)];
  return (
    <Pastille couleur={etat.couleur} texte={etat.texte}>
      {children ?? etat.libelle}
    </Pastille>
  );
}

export default function PageFormations() {
  // useSearchParams (formation visée) doit être sous un Suspense avec le pré-rendu de Next.js.
  return (
    <Suspense fallback={<Chargement />}>
      <Formations />
    </Suspense>
  );
}

function Formations() {
  const donnees = useDonnees();
  const { role, entrepriseId } = useSession();
  // Formation visée par l'adresse : on ouvre directement le registre.
  const [onglet, setOnglet] = useState<Onglet>(useSearchParams().get("formation") ? "registre" : "tableau");
  const cible = useCible("formation", !!donnees && onglet === "registre");
  const [edition, setEdition] = useState<Edition>(null);

  if (!donnees) return <Chargement />;
  const modifiable = peutModifier(role, "tout");
  const aujourdhui = dateDuJour();
  const salaries = new Set(donnees.salaries.map((s) => s.id));
  const enVigueur = formationsEnVigueur(donnees.formations).filter((f) => salaries.has(f.salarieId));
  const manquantes = formationsManquantes(donnees, aujourdhui);
  const compter = (etats: string[]) => enVigueur.filter((f) => etats.includes(etatFormation(f, aujourdhui))).length;

  const ouvrir = (formation: Formation, nouvelle = false) => setEdition({ formation, nouvelle });

  return (
    <div>
      <EnTetePage
        titre="Formations et habilitations"
        description="CACES, SST, habilitation électrique… Frisk Plateforme calcule les dates d'expiration, vous prévient avant l'échéance et repère les salariés à qui il manque une formation exigée pour leur poste."
        actions={
          <>
            <button type="button" className={classeBoutonSecondaire} onClick={() => telechargerEtatFormations(donnees)}>
              État des habilitations (PDF)
            </button>
            <button type="button" className={classeBoutonSecondaire} onClick={() => exporter(donnees, aujourdhui)}>
              Exporter (Excel)
            </button>
            {modifiable && (
              <>
                <button type="button" className={classeBoutonSecondaire} onClick={() => setEdition({ session: true })}>
                  + Session collective
                </button>
                <button
                  type="button"
                  className={classeBouton}
                  onClick={() => ouvrir(nouvelleFormation({ salarieId: donnees.salaries[0]?.id ?? "", obtenueLe: aujourdhui }), true)}
                  disabled={!donnees.salaries.length}
                  title={donnees.salaries.length ? undefined : "Ajoutez d'abord les salariés dans la page « Salariés »"}
                >
                  + Formation
                </button>
              </>
            )}
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Indicateur libelle="Formations en cours de validité" valeur={compter(["valide", "permanente", "a-renouveler"])} detail={`pour ${donnees.salaries.length} salarié(s)`} />
        <Indicateur libelle="À renouveler" valeur={compter(["a-renouveler"])} detail={`expirent dans les ${DELAI_RENOUVELLEMENT} jours`} alerte={compter(["a-renouveler"]) > 0} />
        <Indicateur libelle="Expirées" valeur={compter(["expiree"])} detail="dernière session dépassée" alerte={compter(["expiree"]) > 0} />
        <Indicateur libelle="Manquantes pour le poste" valeur={manquantes.length} detail="exigées mais absentes ou expirées" alerte={manquantes.length > 0} />
      </div>

      <div className="mb-4 flex flex-wrap gap-1 border-b border-pierre/70">
        {onglets.map((o) => (
          <button
            key={o.valeur}
            type="button"
            aria-pressed={onglet === o.valeur}
            onClick={() => setOnglet(o.valeur)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${onglet === o.valeur ? "border-bronze font-medium text-encre" : "border-transparent text-ardoise hover:text-encre"}`}
          >
            {o.libelle}
          </button>
        ))}
      </div>

      {onglet === "tableau" && <Tableau donnees={donnees} aujourdhui={aujourdhui} modifiable={modifiable} onOuvrir={ouvrir} />}
      {onglet === "registre" && <Registre donnees={donnees} aujourdhui={aujourdhui} onOuvrir={ouvrir} cible={cible} />}
      {onglet === "postes" && <Postes donnees={donnees} modifiable={modifiable} />}

      {edition && "formation" in edition && (
        <FormulaireFormation
          key={edition.formation.id}
          initiale={edition.formation}
          nouvelle={edition.nouvelle}
          donnees={donnees}
          entrepriseId={entrepriseId}
          modifiable={modifiable}
          onFermer={() => setEdition(null)}
        />
      )}
      {edition && "session" in edition && <FormulaireSession donnees={donnees} aujourdhui={aujourdhui} onFermer={() => setEdition(null)} />}
    </div>
  );
}

function exporter(donnees: Donnees, aujourdhui: string) {
  const nom = new Map(donnees.salaries.map((s) => [s.id, s]));
  telechargerCsv(`Formations et habilitations - ${donnees.entreprise} - ${aujourdhui}.csv`, [
    ["Salarié", "Service", "Poste", "Formation", "Précision", "Obtenue le", "Expire le", "État", "Organisme", "Attestation"],
    ...donnees.formations
      .filter((f) => nom.has(f.salarieId))
      .map((f) => {
        const s = nom.get(f.salarieId)!;
        return [
          s.nom, s.service, s.poste, libelleFormation(f), f.type === "autre" ? "" : f.intitule,
          formaterDate(f.obtenueLe), formaterDate(f.expireLe),
          estRemplacee(f, donnees.formations) ? "Remplacée par un recyclage" : etatsFormation[etatFormation(f, aujourdhui)].libelle,
          f.organisme, f.attestation ? "Oui" : "Non",
        ];
      }),
  ]);
}

// ---------- Tableau des habilitations : un salarié par ligne, une formation par colonne ----------

function Tableau({
  donnees,
  aujourdhui,
  modifiable,
  onOuvrir,
}: {
  donnees: Donnees;
  aujourdhui: string;
  modifiable: boolean;
  onOuvrir: (f: Formation, nouvelle?: boolean) => void;
}) {
  const enVigueur = formationsEnVigueur(donnees.formations);
  const utilises = new Set([...donnees.formations.map((f) => f.type), ...donnees.exigences.map((e) => e.type)]);
  const colonnes = typesFormation.filter((t) => t.code !== "autre" && utilises.has(t.code));
  const salaries = [...donnees.salaries].sort((a, b) => a.service.localeCompare(b.service, "fr") || a.nom.localeCompare(b.nom, "fr"));

  if (!salaries.length) {
    return <p className="rounded-sm border border-pierre/70 bg-white p-6 text-center text-sm text-gris">Ajoutez d&apos;abord les salariés dans « Salariés &amp; réglages ».</p>;
  }
  if (!colonnes.length && !donnees.formations.length) {
    return (
      <p className="rounded-sm border border-pierre/70 bg-white p-6 text-center text-sm text-gris">
        Aucune formation enregistrée. Commencez par indiquer les formations exigées par poste (onglet « Formations exigées par
        poste »), puis enregistrez celles que vos salariés ont suivies.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-sm border border-pierre/70 bg-white">
      <table className="w-full border-separate border-spacing-0 text-sm">
        <thead className="bg-marbre text-left text-xs text-ardoise">
          <tr>
            <th className="sticky left-0 z-10 border-b border-pierre/60 bg-marbre px-3 py-2 uppercase tracking-wide">Salarié</th>
            {colonnes.map((t) => (
              <th key={t.code} title={t.libelle} className="border-b border-pierre/60 px-2 py-2 text-center font-semibold whitespace-nowrap">
                {t.court}
              </th>
            ))}
            <th className="border-b border-pierre/60 px-2 py-2 uppercase tracking-wide">Autres</th>
          </tr>
        </thead>
        <tbody>
          {salaries.map((s) => {
            const exigees = exigencesDuPoste(donnees.exigences, s.poste).map((e) => e.type);
            const autres = enVigueur.filter((f) => f.salarieId === s.id && f.type === "autre");
            return (
              <tr key={s.id} className="hover:bg-marbre/30">
                <td className="sticky left-0 z-10 border-b border-pierre/60 bg-white px-3 py-2 whitespace-nowrap">
                  <span className="font-medium">{s.nom || "Salarié sans nom"}</span>
                  <span className="block text-xs text-gris">{[s.service, s.poste].filter(Boolean).join(" · ")}</span>
                </td>
                {colonnes.map((t) => {
                  const f = enVigueur.find((x) => x.salarieId === s.id && x.type === t.code);
                  const exigee = exigees.includes(t.code);
                  return (
                    <td key={t.code} className="border-b border-pierre/60 px-2 py-2 text-center">
                      {f ? (
                        <button type="button" onClick={() => onOuvrir(f)} title={`${libelleFormation(f)}${f.intitule ? ` (${f.intitule})` : ""}`}>
                          <PastilleEtat formation={f} aujourdhui={aujourdhui}>
                            {f.expireLe ? formaterDate(f.expireLe) : "✓"}
                          </PastilleEtat>
                        </button>
                      ) : exigee ? (
                        <button
                          type="button"
                          disabled={!modifiable}
                          onClick={() => onOuvrir(nouvelleFormation({ salarieId: s.id, type: t.code, obtenueLe: aujourdhui }), true)}
                          title="Formation exigée pour ce poste : cliquez pour l'enregistrer"
                        >
                          <Pastille couleur="#fde8e6" texte="#b42318" icone="!">
                            Manquante
                          </Pastille>
                        </button>
                      ) : (
                        <span className="text-gris">·</span>
                      )}
                    </td>
                  );
                })}
                <td className="border-b border-pierre/60 px-2 py-2">
                  <span className="flex flex-wrap gap-1">
                    {autres.map((f) => (
                      <button key={f.id} type="button" onClick={() => onOuvrir(f)}>
                        <PastilleEtat formation={f} aujourdhui={aujourdhui}>{libelleFormation(f)}</PastilleEtat>
                      </button>
                    ))}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="flex flex-wrap gap-3 border-t border-pierre/60 px-3 py-2 text-xs text-gris">
        {Object.values(etatsFormation).map((e) => (
          <span key={e.libelle} className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: e.couleur }} /> {e.libelle}
          </span>
        ))}
        <span className="text-[#b42318]">! Manquante : exigée pour le poste</span>
        <span>· non exigée</span>
      </p>
    </div>
  );
}

// ---------- Registre : toutes les sessions, y compris celles remplacées par un recyclage ----------

function Registre({
  donnees,
  aujourdhui,
  onOuvrir,
  cible,
}: {
  donnees: Donnees;
  aujourdhui: string;
  onOuvrir: (f: Formation) => void;
  cible: string; // formation visée par l'adresse de la page
}) {
  const [salarie, setSalarie] = useState("");
  const [type, setType] = useState("");
  const [etat, setEtat] = useState("");
  const nom = new Map(donnees.salaries.map((s) => [s.id, s.nom || "Salarié sans nom"]));
  const lignes = donnees.formations
    .filter((f) => nom.has(f.salarieId))
    .filter((f) => (!salarie || f.salarieId === salarie) && (!type || f.type === type))
    .map((f) => ({ f, remplacee: estRemplacee(f, donnees.formations), etat: etatFormation(f, aujourdhui) }))
    .filter((l) => !etat || (etat === "remplacee" ? l.remplacee : !l.remplacee && l.etat === etat))
    .sort((a, b) => (nom.get(a.f.salarieId) ?? "").localeCompare(nom.get(b.f.salarieId) ?? "", "fr") || b.f.obtenueLe.localeCompare(a.f.obtenueLe));

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        <select value={salarie} onChange={(e) => setSalarie(e.target.value)} className={`${classeChamp} max-w-52`}>
          <option value="">Tous les salariés</option>
          {donnees.salaries.map((s) => (
            <option key={s.id} value={s.id}>{s.nom}</option>
          ))}
        </select>
        <select value={type} onChange={(e) => setType(e.target.value)} className={`${classeChamp} max-w-72`}>
          <option value="">Toutes les formations</option>
          {typesFormation.map((t) => (
            <option key={t.code} value={t.code}>{t.libelle}</option>
          ))}
        </select>
        <select value={etat} onChange={(e) => setEtat(e.target.value)} className={`${classeChamp} max-w-52`}>
          <option value="">Tous les états</option>
          {Object.entries(etatsFormation).map(([v, e]) => (
            <option key={v} value={v}>{e.libelle}</option>
          ))}
          <option value="remplacee">Remplacée par un recyclage</option>
        </select>
      </div>
      {lignes.length === 0 ? (
        <p className="rounded-sm border border-pierre/70 bg-white p-6 text-center text-sm text-gris">Aucune formation ne correspond à ces critères.</p>
      ) : (
        <div className="overflow-x-auto rounded-sm border border-pierre/70 bg-white">
          <table className="w-full min-w-[52rem] border-separate border-spacing-0 text-sm">
            <thead className="bg-marbre text-left text-xs uppercase tracking-wide text-ardoise">
              <tr>
                {["Salarié", "Formation", "Obtenue le", "Expire le", "État", "Organisme", "Attestation", ""].map((t) => (
                  <th key={t} className="border-b border-pierre/60 px-3 py-2">{t}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lignes.map(({ f, remplacee }) => (
                <tr key={f.id} id={idCible(f.id)} className={`${remplacee ? "text-gris" : ""} ${f.id === cible ? classeCible : ""}`}>
                  <td className="border-b border-pierre/60 px-3 py-2">{nom.get(f.salarieId)}</td>
                  <td className="border-b border-pierre/60 px-3 py-2">
                    {libelleFormation(f)}
                    {f.type !== "autre" && f.intitule && <span className="block text-xs text-gris">{f.intitule}</span>}
                  </td>
                  <td className="border-b border-pierre/60 px-3 py-2 tabular-nums">{formaterDate(f.obtenueLe)}</td>
                  <td className="border-b border-pierre/60 px-3 py-2 tabular-nums">{formaterDate(f.expireLe) || "—"}</td>
                  <td className="border-b border-pierre/60 px-3 py-2">
                    {remplacee ? <span className="text-xs">Remplacée par un recyclage</span> : <PastilleEtat formation={f} aujourdhui={aujourdhui} />}
                  </td>
                  <td className="border-b border-pierre/60 px-3 py-2">{f.organisme}</td>
                  <td className="border-b border-pierre/60 px-3 py-2">
                    {f.attestation ? (
                      <button type="button" onClick={() => ouvrirAttestation(f.attestation!.chemin)} className="text-bronze-fonce underline">
                        Ouvrir
                      </button>
                    ) : (
                      <span className="text-xs text-gris">—</span>
                    )}
                  </td>
                  <td className="border-b border-pierre/60 px-3 py-2 text-right">
                    <button type="button" onClick={() => onOuvrir(f)} className="text-xs text-ardoise underline">
                      Détails
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---------- Formations exigées par poste ----------

function Postes({ donnees, modifiable }: { donnees: Donnees; modifiable: boolean }) {
  const [nouveau, setNouveau] = useState("");
  const postes = postesConnus(donnees);
  const choix = typesFormation.filter((t) => t.code !== "autre");

  const basculer = (poste: string, type: string) =>
    modifier((d) => {
      const existante = exigencesDuPoste(d.exigences, poste).find((e) => e.type === type);
      return {
        ...d,
        exigences: existante ? d.exigences.filter((e) => e.id !== existante.id) : [...d.exigences, nouvelleExigence(poste, type)],
      };
    });

  return (
    <div>
      <p className="mb-4 max-w-3xl text-sm text-ardoise">
        Indiquez pour chaque poste les formations indispensables. Frisk Plateforme signale alors les salariés à qui il en manque une, ou
        dont la formation a expiré. Les postes sont ceux saisis dans la fiche de chaque salarié.
      </p>
      {postes.length === 0 && (
        <p className="mb-4 rounded-sm border border-pierre/70 bg-white p-6 text-center text-sm text-gris">
          Aucun poste renseigné : complétez le poste de vos salariés dans « Salariés &amp; réglages », ou ajoutez un poste ci-dessous.
        </p>
      )}
      <fieldset disabled={!modifiable} className="grid min-w-0 gap-3 lg:grid-cols-2">
        {postes.map((poste) => {
          const exigees = exigencesDuPoste(donnees.exigences, poste).map((e) => e.type);
          const effectif = donnees.salaries.filter((s) => s.poste.trim().toLowerCase() === poste.toLowerCase()).length;
          return (
            <section key={poste} className="rounded-sm border border-pierre/70 bg-white p-4">
              <h3 className="font-medium">
                {poste} <span className="text-xs font-normal text-gris">· {effectif} salarié(s)</span>
              </h3>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {choix.map((t) => {
                  const active = exigees.includes(t.code);
                  return (
                    <button
                      key={t.code}
                      type="button"
                      onClick={() => basculer(poste, t.code)}
                      title={t.libelle}
                      aria-pressed={active}
                      className={`rounded-full border px-2.5 py-1 text-xs transition-colors disabled:cursor-default ${
                        active ? "border-bronze bg-bronze text-encre" : "border-pierre text-ardoise hover:border-bronze"
                      }`}
                    >
                      {active ? "✓ " : "+ "}
                      {t.court}
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </fieldset>
      {modifiable && (
        <form
          className="mt-4 flex max-w-md gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const poste = nouveau.trim();
            if (!poste) return;
            // Un poste n'existe qu'à travers ses exigences : on le crée avec l'accueil sécurité, toujours dû.
            if (!postes.some((p) => p.toLowerCase() === poste.toLowerCase())) basculer(poste, "accueil-securite");
            setNouveau("");
          }}
        >
          <input required value={nouveau} onChange={(e) => setNouveau(e.target.value)} placeholder="Nouveau poste (ex. Cariste)" className={classeChamp} />
          <button type="submit" className={classeBoutonSecondaire}>Ajouter</button>
        </form>
      )}
    </div>
  );
}

// ---------- Fenêtres de saisie ----------

function Fenetre({ titre, children, onFermer }: { titre: string; children: ReactNode; onFermer: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-encre/50 p-4 sm:items-center" onClick={onFermer}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titre}
        className="w-full max-w-2xl rounded-sm bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-serif text-xl">{titre}</h2>
          <button type="button" onClick={onFermer} className="rounded-sm px-2 py-1 text-ardoise hover:bg-marbre" aria-label="Fermer">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ChampsCommuns({
  formation: f,
  donnees,
  onChange,
}: {
  formation: Pick<Formation, "type" | "intitule" | "obtenueLe" | "expireLe" | "organisme" | "actionId">;
  donnees: Donnees;
  onChange: (champs: Partial<Formation>) => void;
}) {
  const type = typeFormation(f.type);
  const actionsFormation = donnees.actions.filter((a) => a.principe === "formation");
  // Changer de type ou de date recalcule l'expiration ; elle reste modifiable (la date de l'attestation fait foi).
  const changerDate = (champs: Partial<Formation>) => {
    const suivant = { ...f, ...champs };
    onChange({ ...champs, expireLe: calculerExpiration(suivant.type, suivant.obtenueLe) || (suivant.type === "autre" ? f.expireLe : "") });
  };
  return (
    <>
      <label className="sm:col-span-2">
        <span className={libelle}>Formation ou habilitation</span>
        <select value={f.type} onChange={(e) => changerDate({ type: e.target.value })} className={classeChamp}>
          {typesFormation.map((t) => (
            <option key={t.code} value={t.code}>{t.libelle}</option>
          ))}
        </select>
        <span className="mt-1 block text-xs text-gris">{type.aide}</span>
      </label>
      {(type.precision || f.type === "autre") && (
        <label className="sm:col-span-2">
          <span className={libelle}>{f.type === "autre" ? "Intitulé" : "Précision"}</span>
          <input value={f.intitule} placeholder={type.precision} onChange={(e) => onChange({ intitule: e.target.value })} className={classeChamp} />
        </label>
      )}
      <label>
        <span className={libelle}>Obtenue le</span>
        <input type="date" value={f.obtenueLe} onChange={(e) => changerDate({ obtenueLe: e.target.value })} className={classeChamp} />
      </label>
      <label>
        <span className={libelle}>Expire le {type.validite ? `(${type.validite / 12} an${type.validite > 12 ? "s" : ""} en général)` : "(si applicable)"}</span>
        <input type="date" value={f.expireLe} onChange={(e) => onChange({ expireLe: e.target.value })} className={classeChamp} />
      </label>
      <label>
        <span className={libelle}>Organisme</span>
        <input value={f.organisme} onChange={(e) => onChange({ organisme: e.target.value })} className={classeChamp} />
      </label>
      <label>
        <span className={libelle}>Action du plan de prévention</span>
        <select value={f.actionId ?? ""} onChange={(e) => onChange({ actionId: e.target.value || undefined })} className={classeChamp}>
          <option value="">Aucune</option>
          {actionsFormation.map((a) => (
            <option key={a.id} value={a.id}>{a.intitule || "Action sans intitulé"}</option>
          ))}
        </select>
      </label>
    </>
  );
}

function FormulaireFormation({
  initiale,
  nouvelle,
  donnees,
  entrepriseId,
  modifiable,
  onFermer,
}: {
  initiale: Formation;
  nouvelle: boolean;
  donnees: Donnees;
  entrepriseId: string;
  modifiable: boolean;
  onFermer: () => void;
}) {
  const [f, setF] = useState(initiale);
  const [envoi, setEnvoi] = useState<"" | "en-cours" | string>("");
  const maj = (champs: Partial<Formation>) => setF((x) => ({ ...x, ...champs }));
  // Fichiers déposés pendant cette saisie : supprimés si elle est abandonnée.
  const [deposes, setDeposes] = useState<string[]>([]);

  const annuler = () => {
    deposes.forEach((chemin) => void supprimerAttestation(chemin));
    onFermer();
  };
  const enregistrer = () => {
    modifier((d) => ({
      ...d,
      formations: nouvelle ? [...d.formations, f] : d.formations.map((x) => (x.id === f.id ? f : x)),
    }));
    // L'ancienne attestation remplacée n'est plus utile.
    if (initiale.attestation && initiale.attestation.chemin !== f.attestation?.chemin) void supprimerAttestation(initiale.attestation.chemin);
    deposes.filter((c) => c !== f.attestation?.chemin).forEach((c) => void supprimerAttestation(c));
    onFermer();
  };
  const supprimer = () => {
    if (!confirm(`Supprimer « ${libelleFormation(f)} » du registre ?`)) return;
    modifier((d) => ({ ...d, formations: d.formations.filter((x) => x.id !== f.id) }));
    [initiale.attestation?.chemin, ...deposes].forEach((c) => c && void supprimerAttestation(c));
    onFermer();
  };
  const deposer = async (fichier: File | undefined) => {
    if (!fichier) return;
    setEnvoi("en-cours");
    try {
      const attestation = await deposerAttestation(entrepriseId, f.id, fichier);
      setDeposes((x) => [...x, attestation.chemin]);
      maj({ attestation });
      setEnvoi("");
    } catch (e) {
      setEnvoi(e instanceof Error ? e.message : "L'envoi du fichier a échoué.");
    }
  };

  return (
    <Fenetre titre={nouvelle ? "Nouvelle formation" : libelleFormation(initiale)} onFermer={annuler}>
      <fieldset disabled={!modifiable} className="grid min-w-0 gap-3 sm:grid-cols-2">
        <label className="sm:col-span-2">
          <span className={libelle}>Salarié</span>
          <select value={f.salarieId} onChange={(e) => maj({ salarieId: e.target.value })} className={classeChamp}>
            {donnees.salaries.map((s) => (
              <option key={s.id} value={s.id}>{s.nom || "Salarié sans nom"}{s.poste ? ` · ${s.poste}` : ""}</option>
            ))}
          </select>
        </label>
        <ChampsCommuns formation={f} donnees={donnees} onChange={maj} />
      </fieldset>
      <div className="mt-3">
        <span className={libelle}>Attestation (PDF ou photo, 5 Mo au plus)</span>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          {!f.attestation && !modifiable && <span className="text-xs text-gris">Aucune attestation jointe.</span>}
          {f.attestation && (
            <>
              <button type="button" onClick={() => ouvrirAttestation(f.attestation!.chemin)} className="text-bronze-fonce underline">
                📎 {f.attestation.nom}
              </button>
              <button type="button" onClick={() => maj({ attestation: undefined })} className={`text-xs text-ardoise underline ${modifiable ? "" : "hidden"}`}>
                Retirer
              </button>
            </>
          )}
          <label className={`${classeBoutonSecondaire} cursor-pointer ${modifiable ? "" : "hidden"}`}>
            {f.attestation ? "Remplacer" : "Joindre un fichier"}
            <input
              type="file"
              accept={TYPES_ACCEPTES.join(",")}
              className="sr-only"
              onChange={(e) => {
                void deposer(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
          {envoi === "en-cours" && <span className="text-xs text-gris">Envoi…</span>}
          {envoi && envoi !== "en-cours" && <span className="text-xs text-[#b42318]">{envoi}</span>}
        </div>
      </div>
      <div className="mt-5 flex flex-wrap justify-between gap-2">
        {modifiable && !nouvelle ? (
          <button type="button" onClick={supprimer} className={`${classeBoutonSecondaire} hover:text-[#b42318]`}>
            Supprimer
          </button>
        ) : (
          <span />
        )}
        <span className="flex gap-2">
          <button type="button" onClick={annuler} className={classeBoutonSecondaire}>
            {modifiable ? "Annuler" : "Fermer"}
          </button>
          {modifiable && (
            <button type="button" onClick={enregistrer} disabled={envoi === "en-cours" || !f.salarieId} className={`${classeBouton} disabled:opacity-50`}>
              Enregistrer
            </button>
          )}
        </span>
      </div>
    </Fenetre>
  );
}

// Session suivie par plusieurs salariés : une formation est enregistrée pour chacun.
function FormulaireSession({ donnees, aujourdhui, onFermer }: { donnees: Donnees; aujourdhui: string; onFermer: () => void }) {
  const [modele, setModele] = useState(() => nouvelleFormation({ obtenueLe: aujourdhui }));
  const [choisis, setChoisis] = useState<string[]>([]);
  const maj = (champs: Partial<Formation>) => setModele((x) => ({ ...x, ...champs }));
  const enVigueur = formationsEnVigueur(donnees.formations);
  // Salariés concernés en premier : formation exigée pour leur poste, absente ou bientôt expirée.
  const concernes = (salarieId: string, poste: string) => {
    const exigee = exigencesDuPoste(donnees.exigences, poste).some((e) => e.type === modele.type);
    const actuelle = enVigueur.find((f) => f.salarieId === salarieId && f.type === modele.type);
    if (actuelle && etatFormation(actuelle, aujourdhui) !== "valide" && etatFormation(actuelle, aujourdhui) !== "permanente") {
      return etatsFormation[etatFormation(actuelle, aujourdhui)].libelle.toLowerCase();
    }
    return exigee && !actuelle ? "exigée pour le poste" : "";
  };
  const salaries = [...donnees.salaries].sort((a, b) => Number(!!concernes(b.id, b.poste)) - Number(!!concernes(a.id, a.poste)));

  const enregistrer = () => {
    const nouvelles = choisis.map((salarieId) => ({ ...modele, id: nouvelId(), salarieId }));
    modifier((d) => ({ ...d, formations: [...d.formations, ...nouvelles] }));
    onFermer();
  };

  return (
    <Fenetre titre="Session de formation collective" onFermer={onFermer}>
      <div className="grid gap-3 sm:grid-cols-2">
        <ChampsCommuns formation={modele} donnees={donnees} onChange={maj} />
      </div>
      <div className="mt-4">
        <p className={libelle}>Participants ({choisis.length})</p>
        <ul className="max-h-64 space-y-1 overflow-y-auto rounded-sm border border-pierre/70 p-2">
          {salaries.map((s) => {
            const motif = concernes(s.id, s.poste);
            return (
              <li key={s.id}>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="accent-bronze"
                    checked={choisis.includes(s.id)}
                    onChange={(e) => setChoisis((x) => (e.target.checked ? [...x, s.id] : x.filter((y) => y !== s.id)))}
                  />
                  {s.nom || "Salarié sans nom"}
                  <span className="text-xs text-gris">{s.poste}</span>
                  {motif && <span className="text-xs text-[#b42318]">· {motif}</span>}
                </label>
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-xs text-gris">Les attestations individuelles se joignent ensuite depuis le registre.</p>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" onClick={onFermer} className={classeBoutonSecondaire}>Annuler</button>
        <button type="button" onClick={enregistrer} disabled={!choisis.length || !modele.obtenueLe} className={`${classeBouton} disabled:opacity-50`}>
          Enregistrer pour {choisis.length} salarié{choisis.length > 1 ? "s" : ""}
        </button>
      </div>
    </Fenetre>
  );
}
