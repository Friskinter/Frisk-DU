"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Carte, Chargement, EnTetePage, Indicateur, Pastille, classeBouton, classeBoutonSecondaire, classeChamp } from "@/components/ui";
import { deposerAttestation, liensPhotos, ouvrirAttestation, supprimerAttestation } from "@/lib/attestations";
import { dateDuJour, decalerJours, formaterDate, nouvelId, telechargerCsv } from "@/lib/calculs";
import { telechargerRapportVisite } from "@/lib/pdf/telecharger";
import { statutsAction } from "@/lib/referentiel";
import { modifier, peutModifier, useDonnees, useSession } from "@/lib/stockage";
import type { Donnees, GrilleAudit, ReponseVisite, ResultatPoint, Visite } from "@/lib/types";
import {
  actionPourNonConformite,
  bilanVisite,
  copierGrille,
  grillesModeles,
  grouperParTheme,
  nonConformitesOuvertes,
  nouvelleGrille,
  nouvelleVisite,
  resultatsPoint,
  sansAction,
} from "@/lib/visites";

const libelle = "mb-1 block text-xs font-medium text-ardoise";
const grilleLigne = "lg:grid-cols-[7rem_minmax(0,2fr)_minmax(0,1fr)_8rem_8rem_1.5rem]";

function majVisite(id: string, champs: Partial<Visite>) {
  modifier((d) => ({ ...d, visites: d.visites.map((v) => (v.id === id ? { ...v, ...champs } : v)) }));
}

function majReponse(visiteId: string, reponseId: string, champs: Partial<ReponseVisite>) {
  modifier((d) => ({
    ...d,
    visites: d.visites.map((v) => (v.id === visiteId ? { ...v, reponses: v.reponses.map((r) => (r.id === reponseId ? { ...r, ...champs } : r)) } : v)),
  }));
}

function majGrille(id: string, champs: Partial<GrilleAudit>) {
  modifier((d) => ({ ...d, grilles: d.grilles.map((g) => (g.id === id ? { ...g, ...champs } : g)) }));
}

function couleurTaux(taux: number | null) {
  if (taux === null) return { couleur: "#ece6dc", texte: "#3a3530" };
  if (taux >= 90) return { couleur: "#0ca30c", texte: "#0b0b0b" };
  if (taux >= 70) return { couleur: "#fab219", texte: "#0b0b0b" };
  return { couleur: "#d03b3b", texte: "#ffffff" };
}

type Onglet = "visites" | "grilles";

export default function PageVisites() {
  // useSearchParams doit être sous un Suspense avec le pré-rendu de Next.js.
  return (
    <Suspense fallback={<Chargement />}>
      <Visites />
    </Suspense>
  );
}

function Visites() {
  const donnees = useDonnees();
  const { role } = useSession();
  const parametres = useSearchParams();
  const [onglet, setOnglet] = useState<Onglet>("visites");
  const [ouvert, setOuvert] = useState(parametres.get("visite") ?? "");

  if (!donnees) return <Chargement />;
  const modifiable = peutModifier(role, "tout");

  const commencer = (grille: GrilleAudit) => {
    const v = nouvelleVisite(grille, dateDuJour());
    modifier((d) => ({ ...d, visites: [v, ...d.visites] }));
    setOnglet("visites");
    setOuvert(v.id);
  };

  return (
    <div>
      <EnTetePage
        titre="Visites et audits"
        description="Faites le tour du terrain avec une grille de contrôle, sur tablette ou téléphone : chaque point est conforme, non conforme ou sans objet, avec un commentaire et une photo. Une non-conformité devient une action du plan en un clic."
      />
      <div className="mb-6 flex gap-1 overflow-x-auto border-b border-pierre" role="tablist">
        {(
          [
            { valeur: "visites", libelle: "Visites" },
            { valeur: "grilles", libelle: "Grilles de contrôle" },
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
      {onglet === "visites" ? (
        <ListeVisites donnees={donnees} modifiable={modifiable} ouvert={ouvert} setOuvert={setOuvert} onCommencer={commencer} />
      ) : (
        <Grilles donnees={donnees} modifiable={modifiable} onCommencer={commencer} />
      )}
    </div>
  );
}

function ListeVisites({
  donnees,
  modifiable,
  ouvert,
  setOuvert,
  onCommencer,
}: {
  donnees: Donnees;
  modifiable: boolean;
  ouvert: string;
  setOuvert: (id: string) => void;
  onCommencer: (g: GrilleAudit) => void;
}) {
  const [choix, setChoix] = useState("");
  const aujourdhui = dateDuJour();
  const { visites, actions } = donnees;
  const toutesGrilles = [...donnees.grilles, ...grillesModeles];
  const recentes = visites.filter((v) => v.date >= decalerJours(aujourdhui, -365));
  const taux = recentes.map((v) => bilanVisite(v).taux).filter((t): t is number => t !== null);
  const ouvertes = nonConformitesOuvertes(visites, actions);
  const sans = sansAction(visites, actions);
  const liste = [...visites].sort((a, b) => b.date.localeCompare(a.date));

  const exporter = () =>
    telechargerCsv(`Visites et audits - ${donnees.entreprise} - ${aujourdhui}.csv`, [
      ["Date", "Grille", "Lieu", "Réalisée par", "Thème", "Point contrôlé", "Résultat", "Commentaire", "Action", "Statut de l'action"],
      ...liste.flatMap((v) =>
        v.reponses.map((r) => {
          const a = r.actionId ? actions.find((x) => x.id === r.actionId) : undefined;
          return [
            formaterDate(v.date), v.grille, v.unite, v.auditeur, r.theme, r.question,
            resultatsPoint.find((x) => x.valeur === r.resultat)?.libelle ?? "Non évalué", r.commentaire,
            a?.intitule ?? "", a ? statutsAction.find((s) => s.valeur === a.statut)?.libelle ?? "" : "",
          ];
        }),
      ),
    ]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        {modifiable ? (
          <div className="flex flex-wrap items-end gap-2">
            <label>
              <span className={libelle}>Nouvelle visite avec la grille</span>
              <select value={choix} onChange={(e) => setChoix(e.target.value)} className={`${classeChamp} max-w-80`}>
                <option value="">Choisir une grille…</option>
                {donnees.grilles.length > 0 && (
                  <optgroup label="Vos grilles">
                    {donnees.grilles.map((g) => (
                      <option key={g.id} value={g.id}>{g.nom || "Grille sans nom"}</option>
                    ))}
                  </optgroup>
                )}
                <optgroup label="Bibliothèque Frisk">
                  {grillesModeles.map((g) => (
                    <option key={g.id} value={g.id}>{g.nom}</option>
                  ))}
                </optgroup>
              </select>
            </label>
            <button
              type="button"
              className={`${classeBouton} disabled:opacity-50`}
              disabled={!choix}
              onClick={() => {
                const g = toutesGrilles.find((x) => x.id === choix);
                if (g) onCommencer(g);
                setChoix("");
              }}
            >
              Commencer la visite
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
        <Indicateur libelle="Visites (12 mois)" valeur={recentes.length} detail={recentes[0] ? `dernière le ${formaterDate([...recentes].sort((a, b) => b.date.localeCompare(a.date))[0].date)}` : "aucune visite"} />
        <Indicateur
          libelle="Conformité moyenne"
          valeur={taux.length ? `${Math.round(taux.reduce((t, x) => t + x, 0) / taux.length)} %` : "—"}
          detail="points conformes sur points évalués, 12 mois"
        />
        <Indicateur libelle="Non-conformités ouvertes" valeur={ouvertes.length} detail="action non réalisée ou à créer" alerte={ouvertes.length > 0} />
        <Indicateur libelle="Sans action" valeur={sans.length} detail="non-conformités à confier au plan" alerte={sans.length > 0} />
      </div>

      {liste.length === 0 ? (
        <p className="rounded-sm border border-pierre/70 bg-white p-6 text-center text-sm text-gris">
          Aucune visite. Choisissez une grille ci-dessus et commencez votre première visite du terrain.
        </p>
      ) : (
        <section className="rounded-sm border border-pierre/70 bg-white">
          <div className={`${grilleLigne} hidden gap-x-3 border-b border-pierre/60 bg-marbre px-3 py-1.5 text-xs text-ardoise lg:grid`}>
            <span>Date</span>
            <span>Grille et lieu</span>
            <span>Réalisée par</span>
            <span>Conformité</span>
            <span>Avancement</span>
            <span />
          </div>
          <ul>
            {liste.map((v) => {
              const b = bilanVisite(v);
              const t = couleurTaux(b.taux);
              return (
                <li key={v.id} className="border-b border-pierre/60 last:border-b-0">
                  <button
                    type="button"
                    onClick={() => setOuvert(ouvert === v.id ? "" : v.id)}
                    aria-expanded={ouvert === v.id}
                    className={`${grilleLigne} grid w-full gap-x-3 gap-y-1.5 px-3 py-2.5 text-left text-sm hover:bg-marbre/40 ${ouvert === v.id ? "bg-marbre/40" : ""}`}
                  >
                    <span className="block tabular-nums">{formaterDate(v.date)}</span>
                    <span className="block min-w-0">
                      <span className="block font-medium">{v.grille}</span>
                      <span className="block truncate text-xs text-gris">{v.unite || "Lieu à préciser"}</span>
                    </span>
                    <span className="block text-ardoise">{v.auditeur || "—"}</span>
                    <span className="flex flex-wrap items-center gap-1.5">
                      <Pastille couleur={t.couleur} texte={t.texte}>{b.taux === null ? "—" : `${b.taux} %`}</Pastille>
                      {b.nonConformes > 0 && <span className="text-xs text-[#b42318]">{b.nonConformes} non conforme(s)</span>}
                    </span>
                    <span className="block text-xs text-ardoise">
                      {v.clotureeLe ? "Clôturée" : `En cours · ${b.total - b.restants}/${b.total}`}
                    </span>
                    <span className="hidden text-right text-bronze-fonce lg:block">{ouvert === v.id ? "▲" : "▼"}</span>
                  </button>
                  {ouvert === v.id && (
                    <div className="border-t border-pierre/60 bg-ivoire p-3 sm:p-4">
                      <FicheVisite visite={v} donnees={donnees} modifiable={modifiable} onFermer={() => setOuvert("")} />
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

function FicheVisite({ visite: v, donnees, modifiable, onFermer }: { visite: Visite; donnees: Donnees; modifiable: boolean; onFermer: () => void }) {
  const aujourdhui = dateDuJour();
  const b = bilanVisite(v);
  const unites = [...new Set([...donnees.unites, ...donnees.duerp.map((l) => l.unite)].filter(Boolean))];

  const cloturer = () => {
    if (b.restants && !confirm(`${b.restants} point(s) ne sont pas évalués. Clôturer quand même la visite ?`)) return;
    majVisite(v.id, { clotureeLe: aujourdhui });
  };
  const supprimer = () => {
    if (!confirm("Supprimer cette visite ? Les actions déjà créées restent dans le plan d'actions.")) return;
    modifier((d) => ({ ...d, visites: d.visites.filter((x) => x.id !== v.id) }));
    v.reponses.forEach((r) => r.photo && void supprimerAttestation(r.photo.chemin));
    onFermer();
  };

  return (
    <div className="space-y-3">
      <fieldset disabled={!modifiable} className="min-w-0 space-y-3">
        {v.clotureeLe && (
          <p className="rounded-sm border border-pierre/70 bg-white p-3 text-sm text-ardoise">
            Visite clôturée le {formaterDate(v.clotureeLe)} : les constats ne sont plus modifiables. Vous pouvez toujours confier une non-conformité au plan
            d&apos;actions{modifiable ? ", ou rouvrir la visite pour la corriger" : ""}.
          </p>
        )}
        <Carte titre="La visite">
          <fieldset disabled={!!v.clotureeLe} className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label>
              <span className={libelle}>Date</span>
              <input type="date" value={v.date} max={aujourdhui} onChange={(e) => majVisite(v.id, { date: e.target.value })} className={classeChamp} />
            </label>
            <label>
              <span className={libelle}>Lieu ou unité de travail</span>
              <input list="liste-unites-visite" value={v.unite} onChange={(e) => majVisite(v.id, { unite: e.target.value })} className={classeChamp} />
              <datalist id="liste-unites-visite">
                {unites.map((u) => <option key={u} value={u} />)}
              </datalist>
            </label>
            <label>
              <span className={libelle}>Réalisée par</span>
              <input value={v.auditeur} onChange={(e) => majVisite(v.id, { auditeur: e.target.value })} className={classeChamp} />
            </label>
            <label>
              <span className={libelle}>Participants</span>
              <input value={v.participants} placeholder="Salariés, CSE, encadrement…" onChange={(e) => majVisite(v.id, { participants: e.target.value })} className={classeChamp} />
            </label>
          </fieldset>
          <div className="mt-3">
            <div className="flex justify-between text-xs text-ardoise">
              <span>{b.total - b.restants} point(s) évalué(s) sur {b.total}</span>
              <span>{b.taux === null ? "" : `Conformité : ${b.taux} %`}</span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-marbre" aria-hidden>
              <div className="h-full bg-bronze" style={{ width: `${b.total ? ((b.total - b.restants) / b.total) * 100 : 0}%` }} />
            </div>
          </div>
        </Carte>

        {grouperParTheme(v.reponses).map(({ theme, elements }) => (
          <Carte key={theme} titre={theme}>
            <ul className="divide-y divide-pierre/60">
              {elements.map((r) => (
                <PointVisite key={r.id} visite={v} reponse={r} donnees={donnees} verrouille={!!v.clotureeLe} />
              ))}
            </ul>
          </Carte>
        ))}

        <Carte titre="Synthèse">
          <textarea
            rows={3}
            disabled={!!v.clotureeLe}
            value={v.synthese}
            aria-label="Synthèse de la visite"
            placeholder="Points forts, points à améliorer, suites prévues…"
            onChange={(e) => majVisite(v.id, { synthese: e.target.value })}
            className={`${classeChamp} resize-y`}
          />
        </Carte>
      </fieldset>

      <div className="flex flex-wrap justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <button type="button" className={classeBouton} onClick={() => telechargerRapportVisite(donnees, v.id)}>
            ⬇ Rapport de visite (PDF)
          </button>
          {modifiable &&
            (v.clotureeLe ? (
              <button type="button" className={classeBoutonSecondaire} onClick={() => majVisite(v.id, { clotureeLe: "" })}>
                Rouvrir la visite
              </button>
            ) : (
              <button type="button" className={classeBoutonSecondaire} onClick={cloturer}>
                Clôturer la visite
              </button>
            ))}
        </div>
        {modifiable && (
          <button type="button" className={`${classeBoutonSecondaire} hover:text-[#b42318]`} onClick={supprimer}>
            Supprimer la visite
          </button>
        )}
      </div>
    </div>
  );
}

function PointVisite({ visite: v, reponse: r, donnees, verrouille }: { visite: Visite; reponse: ReponseVisite; donnees: Donnees; verrouille: boolean }) {
  const { entrepriseId } = useSession();
  const [lienPhoto, setLienPhoto] = useState("");
  const [erreur, setErreur] = useState("");
  const [details, setDetails] = useState(false);
  const action = r.actionId ? donnees.actions.find((a) => a.id === r.actionId) : undefined;
  const chemin = r.photo?.chemin ?? "";

  useEffect(() => {
    if (!chemin) return;
    let actif = true;
    void liensPhotos([chemin]).then((l) => actif && setLienPhoto(l[chemin] ?? ""));
    return () => {
      actif = false;
    };
  }, [chemin]);

  const choisir = (resultat: ResultatPoint) => majReponse(v.id, r.id, { resultat: r.resultat === resultat ? "" : resultat });

  const creerAction = () => {
    const a = actionPourNonConformite(v, r, dateDuJour());
    modifier((d) => ({
      ...d,
      actions: [...d.actions, a],
      visites: d.visites.map((x) => (x.id === v.id ? { ...x, reponses: x.reponses.map((y) => (y.id === r.id ? { ...y, actionId: a.id } : y)) } : x)),
    }));
  };

  const ajouterPhoto = async (fichier: File | undefined) => {
    if (!fichier) return;
    setErreur("");
    try {
      const photo = await deposerAttestation(entrepriseId, v.id, fichier);
      if (r.photo) void supprimerAttestation(r.photo.chemin);
      majReponse(v.id, r.id, { photo });
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "L'envoi de la photo a échoué.");
    }
  };

  return (
    <li className="py-3">
      <p className="text-sm">{r.question}</p>
      <fieldset disabled={verrouille} className="mt-2 flex min-w-0 flex-wrap gap-2" role="group" aria-label={`Résultat : ${r.question}`}>
        {resultatsPoint.map((x) => (
          <button
            key={x.valeur}
            type="button"
            aria-pressed={r.resultat === x.valeur}
            onClick={() => choisir(x.valeur)}
            className="min-w-28 rounded-sm border px-3 py-2 text-sm font-medium transition-colors disabled:opacity-60"
            style={r.resultat === x.valeur ? { background: x.couleur, color: x.texte, borderColor: x.couleur } : { borderColor: "#d9cfc1", background: "#ffffff" }}
          >
            {x.court} {x.libelle}
          </button>
        ))}
      </fieldset>
      {(details || r.resultat === "non-conforme" || r.commentaire || r.photo) && (
        <fieldset disabled={verrouille} className="mt-2 grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
          <input
            value={r.commentaire}
            aria-label={`Commentaire : ${r.question}`}
            placeholder={r.resultat === "non-conforme" ? "Ce qui ne va pas, où exactement…" : "Commentaire"}
            onChange={(e) => majReponse(v.id, r.id, { commentaire: e.target.value })}
            className={classeChamp}
          />
          <label className={`${classeBoutonSecondaire} cursor-pointer justify-center has-[:disabled]:hidden`}>
            📷 {r.photo ? "Remplacer la photo" : "Photo"}
            <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => { void ajouterPhoto(e.target.files?.[0]); e.target.value = ""; }} />
          </label>
        </fieldset>
      )}
      {!verrouille && !details && r.resultat !== "non-conforme" && !r.commentaire && !r.photo && (
        <button type="button" className="mt-1 text-xs text-ardoise underline disabled:hidden" onClick={() => setDetails(true)}>
          + Commentaire ou photo
        </button>
      )}
      {erreur && <p role="alert" className="mt-1 text-sm text-[#b42318]">{erreur}</p>}
      {r.photo && (
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            void ouvrirAttestation(r.photo!.chemin);
          }}
          className="mt-2 block h-20 w-20 overflow-hidden rounded-sm border border-pierre/70 bg-marbre"
          aria-label={`Ouvrir la photo : ${r.question}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- lien temporaire du stockage privé */}
          {lienPhoto && <img src={lienPhoto} alt="" className="h-full w-full object-cover" />}
        </a>
      )}
      {r.resultat === "non-conforme" && (
        <div className="mt-2 text-sm">
          {action ? (
            <Link href="/actions" className="text-ardoise underline">
              ✓ Action : {action.intitule || "sans intitulé"} · {statutsAction.find((s) => s.valeur === action.statut)?.libelle}
              {action.echeance ? ` · échéance ${formaterDate(action.echeance)}` : ""}
            </Link>
          ) : (
            <button type="button" className="text-bronze-fonce underline disabled:hidden" onClick={creerAction}>
              → Créer une action dans le plan
            </button>
          )}
        </div>
      )}
    </li>
  );
}

function Grilles({ donnees, modifiable, onCommencer }: { donnees: Donnees; modifiable: boolean; onCommencer: (g: GrilleAudit) => void }) {
  const [ouverte, setOuverte] = useState("");

  const ajouter = (g: GrilleAudit) => {
    modifier((d) => ({ ...d, grilles: [...d.grilles, g] }));
    setOuverte(g.id);
  };
  const supprimer = (g: GrilleAudit) => {
    if (!confirm(`Supprimer la grille « ${g.nom || "sans nom"} » ? Les visites déjà faites ne changent pas.`)) return;
    modifier((d) => ({ ...d, grilles: d.grilles.filter((x) => x.id !== g.id) }));
  };

  return (
    <div className="space-y-6">
      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-serif text-xl">Vos grilles</h2>
          {modifiable && (
            <button type="button" className={classeBoutonSecondaire} onClick={() => ajouter(nouvelleGrille({ nom: "Nouvelle grille", points: [{ id: nouvelId(), theme: "Général", question: "" }] }))}>
              + Nouvelle grille
            </button>
          )}
        </div>
        {donnees.grilles.length === 0 ? (
          <p className="rounded-sm border border-pierre/70 bg-white p-4 text-sm text-gris">
            Aucune grille propre à l&apos;entreprise. Utilisez la bibliothèque ci-dessous telle quelle, ou copiez une grille pour l&apos;adapter à vos locaux.
          </p>
        ) : (
          <ul className="space-y-3">
            {donnees.grilles.map((g) => (
              <li key={g.id} className="rounded-sm border border-pierre/70 bg-white">
                <div className="flex flex-wrap items-center justify-between gap-2 p-3">
                  <button type="button" aria-expanded={ouverte === g.id} onClick={() => setOuverte(ouverte === g.id ? "" : g.id)} className="text-left">
                    <span className="block font-medium">{g.nom || "Grille sans nom"}</span>
                    <span className="block text-xs text-gris">{g.points.length} point(s) · {ouverte === g.id ? "▲ fermer" : "▼ modifier"}</span>
                  </button>
                  {modifiable && (
                    <button type="button" className={classeBouton} onClick={() => onCommencer(g)} disabled={!g.points.some((p) => p.question.trim())}>
                      Commencer une visite
                    </button>
                  )}
                </div>
                {ouverte === g.id && <EditeurGrille grille={g} modifiable={modifiable} onSupprimer={() => supprimer(g)} />}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-serif text-xl">Bibliothèque Frisk</h2>
        <ul className="grid gap-3 md:grid-cols-2">
          {grillesModeles.map((g) => (
            <li key={g.id} className="flex flex-col rounded-sm border border-pierre/70 bg-white p-4">
              <p className="font-medium">{g.nom}</p>
              <p className="mt-1 flex-1 text-sm text-ardoise">{g.description}</p>
              <p className="mt-1 text-xs text-gris">
                {g.points.length} points · {[...new Set(g.points.map((p) => p.theme))].join(", ")}
              </p>
              {modifiable && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" className={classeBouton} onClick={() => onCommencer(g)}>
                    Commencer une visite
                  </button>
                  <button type="button" className={classeBoutonSecondaire} onClick={() => ajouter({ ...copierGrille(g), nom: `${g.nom} (adaptée)` })}>
                    Copier pour l&apos;adapter
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function EditeurGrille({ grille: g, modifiable, onSupprimer }: { grille: GrilleAudit; modifiable: boolean; onSupprimer: () => void }) {
  const majPoint = (id: string, champs: Partial<GrilleAudit["points"][number]>) =>
    majGrille(g.id, { points: g.points.map((p) => (p.id === id ? { ...p, ...champs } : p)) });
  const themes = [...new Set(g.points.map((p) => p.theme).filter(Boolean))];

  return (
    <fieldset disabled={!modifiable} className="min-w-0 border-t border-pierre/60 bg-ivoire p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label>
          <span className={libelle}>Nom de la grille</span>
          <input value={g.nom} onChange={(e) => majGrille(g.id, { nom: e.target.value })} className={classeChamp} />
        </label>
        <label>
          <span className={libelle}>Description</span>
          <input value={g.description} onChange={(e) => majGrille(g.id, { description: e.target.value })} className={classeChamp} />
        </label>
      </div>
      <datalist id={`themes-${g.id}`}>
        {themes.map((t) => <option key={t} value={t} />)}
      </datalist>
      <ul className="mt-3 space-y-2">
        {g.points.map((p, n) => (
          <li key={p.id} className="grid gap-2 sm:grid-cols-[12rem_minmax(0,1fr)_auto]">
            <input list={`themes-${g.id}`} aria-label={`Thème du point ${n + 1}`} value={p.theme} onChange={(e) => majPoint(p.id, { theme: e.target.value })} className={classeChamp} />
            <input aria-label={`Point ${n + 1} à contrôler`} value={p.question} placeholder="Ce qu'il faut vérifier" onChange={(e) => majPoint(p.id, { question: e.target.value })} className={classeChamp} />
            <button type="button" title="Supprimer ce point" onClick={() => majGrille(g.id, { points: g.points.filter((x) => x.id !== p.id) })} className="px-2 text-gris hover:text-[#b42318]">
              ✕
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap justify-between gap-2">
        <button
          type="button"
          className={classeBoutonSecondaire}
          onClick={() => majGrille(g.id, { points: [...g.points, { id: nouvelId(), theme: g.points.at(-1)?.theme ?? "Général", question: "" }] })}
        >
          + Point à contrôler
        </button>
        <button type="button" className={`${classeBoutonSecondaire} hover:text-[#b42318]`} onClick={onSupprimer}>
          Supprimer la grille
        </button>
      </div>
    </fieldset>
  );
}
