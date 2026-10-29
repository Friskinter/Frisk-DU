"use client";

import Link from "next/link";
import { BoutonDocumentUnique } from "@/components/bouton-document-unique";
import { actionEnRetard, actionsDuRisque } from "@/lib/actions";
import { Alertes } from "@/components/alertes";
import {
  BarresHorizontales,
  Carte,
  Chargement,
  EnTetePage,
  Indicateur,
  PastilleCriticite,
  classeBouton,
} from "@/components/ui";
import {
  calculerStocks,
  dateDuJour,
  formaterDate,
  niveauDe,
  risqueResiduel,
} from "@/lib/calculs";
import { calculerIndicateurs, estClos } from "@/lib/evenements";
import { etatFormation, formationsEnVigueur, formationsManquantes } from "@/lib/formations";
import { classementCmr, estCmr, etatFds } from "@/lib/produits";
import { grilleFrequence, grilleGravite, niveauxCriticite } from "@/lib/referentiel";
import { etatEquipement, observationsOuvertes } from "@/lib/verifications";
import { useDonnees } from "@/lib/stockage";

export default function TableauDeBord() {
  const donnees = useDonnees();
  if (!donnees) return <Chargement />;

  const aujourdhui = dateDuJour();
  const risques = donnees.duerp;
  const prioritaires = risques.filter((l) => ["important", "critique"].includes(niveauDe(risqueResiduel(l)).code));
  const actions = donnees.actions;
  const realisees = actions.filter((a) => a.statut === "fait");
  const enRetard = actions.filter((a) => actionEnRetard(a, aujourdhui));
  // Prochaine action à mener sur un risque : la plus proche échéance parmi celles non réalisées.
  const prochaineAction = (l: (typeof risques)[number]) =>
    actionsDuRisque(actions, l)
      .filter((a) => a.statut !== "fait")
      .sort((a, b) => (a.echeance || "9999").localeCompare(b.echeance || "9999"))[0];
  const stocks = calculerStocks(donnees, aujourdhui);
  const aCommander = stocks.filter((s) => s.aCommander > 0);

  const accidents = calculerIndicateurs(donnees, aujourdhui);
  const evenementsATraiter = donnees.evenements.filter((e) => !estClos(e, actions)).length;
  const salariesActuels = new Set(donnees.salaries.map((s) => s.id));
  const etatsFormations = formationsEnVigueur(donnees.formations)
    .filter((f) => salariesActuels.has(f.salarieId))
    .map((f) => etatFormation(f, aujourdhui));
  const formationsAManquer = formationsManquantes(donnees, aujourdhui).length;
  const etatsEquipements = donnees.equipements.map((e) => etatEquipement(donnees.verifications, e, aujourdhui));
  const produitsActifs = donnees.produits.filter((p) => p.actif);
  const observationsALever = observationsOuvertes(donnees.equipements, donnees.verifications, actions).length;

  const parNiveau = niveauxCriticite.map((n) => ({
    ...n,
    nombre: risques.filter((l) => niveauDe(risqueResiduel(l)).code === n.code).length,
  }));

  const parUnite = [...new Set(risques.map((l) => l.unite))]
    .map((u) => {
      const lignes = risques.filter((l) => l.unite === u);
      return {
        cle: u,
        libelle: u || "Sans unité",
        valeur: Math.max(...lignes.map(risqueResiduel)),
        detail: `${lignes.length} risque(s)`,
      };
    })
    .sort((a, b) => b.valeur - a.valeur);

  // Risques encore à traiter : une action en attente, ou aucune action alors que le risque n'est pas faible.
  const top = [...risques]
    .filter((l) => prochaineAction(l) || (!actionsDuRisque(actions, l).length && risqueResiduel(l) >= 4))
    .sort((a, b) => risqueResiduel(b) - risqueResiduel(a))
    .slice(0, 5);

  return (
    <div>
      <EnTetePage
        titre="Tableau de bord"
        description={`Vue d'ensemble de la prévention chez ${donnees.entreprise}.`}
        actions={
          <>
            <BoutonDocumentUnique donnees={donnees} />
            <Link href="/duerp" className={classeBouton}>
              Ouvrir le DUERP
            </Link>
          </>
        }
      />

      <Alertes donnees={donnees} aujourdhui={aujourdhui} />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Indicateur libelle="Risques évalués" valeur={risques.length} detail={`${new Set(risques.map((l) => l.unite)).size} unités de travail`} />
        <Indicateur
          libelle="Risques prioritaires"
          valeur={prioritaires.length}
          detail="niveau important ou critique"
          alerte={prioritaires.length > 0}
        />
        <Indicateur
          libelle="Actions réalisées"
          valeur={actions.length ? `${Math.round((realisees.length / actions.length) * 100)} %` : "—"}
          detail={`${realisees.length} sur ${actions.length} actions`}
        />
        <Indicateur
          libelle="Actions en retard"
          valeur={enRetard.length}
          detail="échéance dépassée"
          alerte={enRetard.length > 0}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Carte titre="Matrice des risques (criticité brute)">
          <p className="mb-3 text-xs text-gris">Nombre de risques dans chaque case Gravité × Fréquence.</p>
          <div className="grid grid-cols-[auto_repeat(4,1fr)] gap-[2px] text-center text-sm">
            <span />
            {grilleFrequence.map((f) => (
              <span key={f.valeur} className="pb-1 text-xs text-gris">F{f.valeur}</span>
            ))}
            {[...grilleGravite].reverse().map((g) => (
              <div key={g.valeur} className="contents">
                <span className="flex items-center pr-2 text-xs text-gris">G{g.valeur} {g.libelle}</span>
                {grilleFrequence.map((f) => {
                  const n = niveauDe(g.valeur * f.valeur);
                  const nb = risques.filter((l) => l.gravite === g.valeur && l.frequence === f.valeur).length;
                  return (
                    <span
                      key={f.valeur}
                      title={`G${g.valeur} × F${f.valeur} = ${g.valeur * f.valeur} (${n.libelle}) : ${nb} risque(s)`}
                      className="rounded-[4px] py-3 font-semibold"
                      style={{ background: n.couleur, color: n.texte, opacity: nb ? 1 : 0.25 }}
                    >
                      {nb || ""}
                    </span>
                  );
                })}
              </div>
            ))}
          </div>
        </Carte>

        <Carte titre="Répartition par niveau (risque résiduel)">
          <ul className="space-y-3">
            {parNiveau.map((n) => (
              <li key={n.code} className="grid grid-cols-[7rem_1fr_2rem] items-center gap-3 text-sm">
                <span className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full" style={{ background: n.couleur }} />
                  {n.libelle}
                </span>
                <span className="h-4">
                  <span
                    className="block h-full rounded-r-[4px]"
                    style={{
                      width: `${risques.length ? Math.max((n.nombre / risques.length) * 100, 1) : 0}%`,
                      background: n.couleur,
                    }}
                  />
                </span>
                <span className="text-right tabular-nums">{n.nombre}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-gris">
            Le risque résiduel tient compte des mesures de prévention déjà en place.
          </p>
        </Carte>

        <Carte
          titre="Priorités d'action"
          actions={<Link href="/actions" className="text-xs text-bronze-fonce underline">Plan d&apos;actions</Link>}
        >
          {top.length === 0 ? (
            <p className="text-sm text-gris">Aucune action en attente.</p>
          ) : (
            <ul className="divide-y divide-pierre/60">
              {top.map((l) => {
                const a = prochaineAction(l);
                const retard = a ? actionEnRetard(a, aujourdhui) : false;
                return (
                  <li key={l.id} className="flex items-start justify-between gap-3 py-2.5 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium">{l.danger || "Danger non précisé"} — {l.unite}</p>
                      <p className="truncate text-ardoise">{a ? a.intitule || "Action sans intitulé" : "Aucune action définie"}</p>
                      {a?.echeance && (
                        <p className={`text-xs ${retard ? "text-[#b42318]" : "text-gris"}`}>
                          Échéance : {formaterDate(a.echeance)}{retard ? " · en retard" : ""}
                        </p>
                      )}
                    </div>
                    <PastilleCriticite score={risqueResiduel(l)} />
                  </li>
                );
              })}
            </ul>
          )}
        </Carte>

        <Carte titre="Risque résiduel le plus élevé par unité">
          <BarresHorizontales donnees={parUnite} />
        </Carte>

        <Carte
          titre="Produits chimiques"
          actions={<Link href="/produits" className="text-xs text-bronze-fonce underline">Inventaire</Link>}
          className="lg:col-span-2"
        >
          <dl className="grid gap-3 text-sm sm:grid-cols-4">
            {[
              { libelle: "Produits utilisés", valeur: produitsActifs.length, alerte: false },
              { libelle: "CMR", valeur: produitsActifs.filter(estCmr).length, alerte: true },
              { libelle: "CMR suspectés", valeur: produitsActifs.filter((p) => classementCmr(p)?.categorie === 2).length, alerte: false },
              { libelle: "FDS manquantes", valeur: produitsActifs.filter((p) => etatFds(p, aujourdhui) === "manquante").length, alerte: true },
            ].map((x) => (
              <div key={x.libelle} className="rounded-sm bg-marbre/60 px-3 py-2">
                <dt className="text-xs text-gris">{x.libelle}</dt>
                <dd className={`text-xl font-semibold tabular-nums ${x.alerte && x.valeur > 0 ? "text-[#b42318]" : ""}`}>{x.valeur}</dd>
              </div>
            ))}
          </dl>
        </Carte>

        <Carte
          titre="Vérifications périodiques"
          actions={<Link href="/verifications" className="text-xs text-bronze-fonce underline">Équipements</Link>}
          className="lg:col-span-2"
        >
          <dl className="grid gap-3 text-sm sm:grid-cols-4">
            {[
              { libelle: "Équipements suivis", valeur: etatsEquipements.length, alerte: false },
              { libelle: "En retard ou jamais vérifiés", valeur: etatsEquipements.filter((e) => e === "en-retard" || e === "jamais").length, alerte: true },
              { libelle: "À prévoir (60 jours)", valeur: etatsEquipements.filter((e) => e === "a-prevoir").length, alerte: false },
              { libelle: "Observations à lever", valeur: observationsALever, alerte: true },
            ].map((x) => (
              <div key={x.libelle} className="rounded-sm bg-marbre/60 px-3 py-2">
                <dt className="text-xs text-gris">{x.libelle}</dt>
                <dd className={`text-xl font-semibold tabular-nums ${x.alerte && x.valeur > 0 ? "text-[#b42318]" : ""}`}>{x.valeur}</dd>
              </div>
            ))}
          </dl>
        </Carte>

        <Carte
          titre="Formations et habilitations"
          actions={<Link href="/formations" className="text-xs text-bronze-fonce underline">Tableau des habilitations</Link>}
          className="lg:col-span-2"
        >
          <dl className="grid gap-3 text-sm sm:grid-cols-4">
            {[
              { libelle: "En cours de validité", valeur: etatsFormations.filter((e) => e !== "expiree").length, alerte: false },
              { libelle: "À renouveler (3 mois)", valeur: etatsFormations.filter((e) => e === "a-renouveler").length, alerte: false },
              { libelle: "Expirées", valeur: etatsFormations.filter((e) => e === "expiree").length, alerte: true },
              { libelle: "Manquantes pour le poste", valeur: formationsAManquer, alerte: true },
            ].map((x) => (
              <div key={x.libelle} className="rounded-sm bg-marbre/60 px-3 py-2">
                <dt className="text-xs text-gris">{x.libelle}</dt>
                <dd className={`text-xl font-semibold tabular-nums ${x.alerte && x.valeur > 0 ? "text-[#b42318]" : ""}`}>{x.valeur}</dd>
              </div>
            ))}
          </dl>
        </Carte>

        <Carte
          titre="Accidents et presque-accidents"
          actions={<Link href="/accidents" className="text-xs text-bronze-fonce underline">Registre</Link>}
          className="lg:col-span-2"
        >
          <dl className="grid gap-3 text-sm sm:grid-cols-4">
            {[
              { libelle: "Jours sans accident avec arrêt", valeur: accidents.joursSansAccident ?? "—" },
              { libelle: "Accidents avec arrêt (12 mois)", valeur: accidents.accidentsAvecArret },
              { libelle: "Presque-accidents signalés (12 mois)", valeur: accidents.presqueAccidents },
              { libelle: "Événements à traiter", valeur: evenementsATraiter },
            ].map((x) => (
              <div key={x.libelle} className="rounded-sm bg-marbre/60 px-3 py-2">
                <dt className="text-xs text-gris">{x.libelle}</dt>
                <dd className="text-xl font-semibold tabular-nums">{x.valeur}</dd>
              </div>
            ))}
          </dl>
        </Carte>

        <Carte
          titre="EPI à commander"
          actions={<Link href="/epi" className="text-xs text-bronze-fonce underline">Gérer les stocks</Link>}
          className="lg:col-span-2"
        >
          {aCommander.length === 0 ? (
            <p className="text-sm text-gris">Tous les stocks sont au-dessus du stock tampon.</p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {aCommander.map((s) => (
                <li key={`${s.article.id}-${s.taille}`} className="flex justify-between gap-3 rounded-sm bg-marbre/60 px-3 py-2 text-sm">
                  <span>
                    {s.article.nom} <span className="text-gris">({s.taille})</span>
                    <span className="block text-xs text-gris">Stock {s.actuel} · tampon {s.tampon}</span>
                  </span>
                  <span className="font-semibold tabular-nums">{s.aCommander}</span>
                </li>
              ))}
            </ul>
          )}
        </Carte>
      </div>
    </div>
  );
}
