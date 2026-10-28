"use client";

import { useEffect, useState } from "react";
import { Carte, Chargement, EnTetePage, Indicateur, PastilleCriticite, classeBoutonSecondaire } from "@/components/ui";
import { dateDuJour, decalerJours, formatNombre, formaterDate, telechargerCsv } from "@/lib/calculs";
import { indicateursSite, risquesPrioritaires, totaliser, type IndicateursSite } from "@/lib/consolidation";
import { normaliser } from "@/lib/donnees";
import { etablissementsDuGroupe, ouvrirEntreprise, useSession } from "@/lib/stockage";
import { supabaseNavigateur } from "@/lib/supabase/client";
import type { Donnees } from "@/lib/types";

type Site = { id: string; nom: string; contenu: Donnees; indicateurs: IndicateursSite };

// Colonnes du tableau : `alerte` colore en rouge une valeur non nulle.
const colonnes: { cle: keyof IndicateursSite; titre: string; aide: string; alerte?: boolean }[] = [
  { cle: "prioritaires", titre: "Risques prioritaires", aide: "Risque résiduel important ou critique" },
  { cle: "actionsRetard", titre: "Actions en retard", aide: "Actions du plan dont l'échéance est dépassée", alerte: true },
  { cle: "accidentsArret", titre: "Accidents avec arrêt", aide: "Accidents du travail avec arrêt sur 12 mois", alerte: true },
  { cle: "presqueAccidents", titre: "Presque-accidents", aide: "Presque-accidents et situations dangereuses signalés sur 12 mois" },
  { cle: "formationsManquantes", titre: "Formations manquantes", aide: "Formations exigées pour le poste, absentes ou expirées", alerte: true },
  { cle: "verificationsRetard", titre: "Vérifications en retard", aide: "Équipements en retard de vérification ou jamais vérifiés", alerte: true },
  { cle: "cmr", titre: "Produits CMR", aide: "Produits cancérogènes, mutagènes ou toxiques pour la reproduction utilisés" },
  { cle: "alertesUrgentes", titre: "Points urgents", aide: "Alertes urgentes à traiter", alerte: true },
];

export default function PageGroupe() {
  const session = useSession();
  const etablissements = etablissementsDuGroupe(session);
  const [sites, setSites] = useState<Site[] | null>(null);
  const [erreur, setErreur] = useState(false);
  const ids = etablissements.map((e) => e.id).join(",");

  useEffect(() => {
    if (!ids) return;
    let actif = true;
    const aujourdhui = dateDuJour();
    const liste = ids.split(",");
    const supabase = supabaseNavigateur();
    Promise.all([
      supabase.from("espaces").select("entreprise_id, contenu").in("entreprise_id", liste),
      supabase.from("versions").select("entreprise_id, created_at").in("entreprise_id", liste),
    ]).then(([espaces, versions]) => {
      if (!actif) return;
      if (espaces.error || versions.error) {
        setErreur(true);
        return;
      }
      const derniere = new Map<string, string>();
      for (const v of (versions.data ?? []) as { entreprise_id: string; created_at: string }[]) {
        const date = v.created_at.slice(0, 10);
        if (date > (derniere.get(v.entreprise_id) ?? "")) derniere.set(v.entreprise_id, date);
      }
      const contenus = new Map(((espaces.data ?? []) as { entreprise_id: string; contenu: Donnees }[]).map((e) => [e.entreprise_id, e.contenu]));
      setSites(
        etablissementsDuGroupe(session).map((e) => {
          // Un établissement jamais ouvert n'a pas encore de contenu.
          const contenu = normaliser(contenus.get(e.id) ?? ({ version: 1, entreprise: e.nom, services: [], unites: [], duerp: [], salaries: [], articles: [], mouvements: [] } as unknown as Donnees));
          return { id: e.id, nom: e.nom, contenu, indicateurs: indicateursSite(contenu, aujourdhui, derniere.get(e.id) ?? null) };
        }),
      );
    });
    return () => {
      actif = false;
    };
    // `session` change à chaque enregistrement : seule la liste des établissements compte ici.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids]);

  if (session.statut !== "pret") return <Chargement />;
  if (etablissements.length < 2) {
    return (
      <div>
        <EnTetePage titre="Vue d'ensemble" />
        <p className="rounded-sm border border-pierre/70 bg-white p-6 text-sm text-ardoise">
          Cette vue réunit plusieurs établissements d&apos;un même groupe. Votre compte n&apos;a accès qu&apos;à un seul établissement.
        </p>
      </div>
    );
  }
  if (erreur) return <p className="p-6 text-sm text-[#b42318]">Impossible de charger les établissements. Réessayez dans un instant.</p>;
  if (!sites) return <Chargement />;

  const aujourdhui = dateDuJour();
  const totaux = totaliser(sites.map((s) => s.indicateurs));
  const prioritaires = risquesPrioritaires(sites);
  const versionsAnciennes = sites.filter((s) => !s.indicateurs.derniereVersion || s.indicateurs.derniereVersion < decalerJours(aujourdhui, -365));

  const exporter = () =>
    telechargerCsv(`Vue d'ensemble - ${session.groupe?.nom ?? "groupe"} - ${aujourdhui}.csv`, [
      ["Établissement", "Risques", ...colonnes.map((c) => c.titre), "Actions réalisées", "Jours d'arrêt", "Observations à lever", "FDS manquantes", "Dernière version du DUERP"],
      ...sites.map((s) => [
        s.nom, s.indicateurs.risques, ...colonnes.map((c) => s.indicateurs[c.cle] as number),
        `${s.indicateurs.actionsFaites}/${s.indicateurs.actions}`, s.indicateurs.joursArret, s.indicateurs.observations, s.indicateurs.fdsManquantes,
        s.indicateurs.derniereVersion ? formaterDate(s.indicateurs.derniereVersion) : "aucune",
      ]),
      ["Total", totaux.risques, ...colonnes.map((c) => totaux[c.cle as keyof typeof totaux] as number), `${totaux.actionsFaites}/${totaux.actions}`, totaux.joursArret, totaux.observations, totaux.fdsManquantes, ""],
    ]);

  return (
    <div>
      <EnTetePage
        titre={`Vue d'ensemble${session.groupe?.nom ? ` · ${session.groupe.nom}` : ""}`}
        description={`Prévention dans les ${sites.length} établissements auxquels vous avez accès. Chaque établissement garde son propre document unique ; cliquez sur un nom pour l'ouvrir.`}
        actions={
          <button type="button" className={classeBoutonSecondaire} onClick={exporter}>
            Exporter (Excel)
          </button>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Indicateur libelle="Risques prioritaires" valeur={totaux.prioritaires} detail={`dont ${totaux.critiques} critique(s), sur ${totaux.risques} risques évalués`} alerte={totaux.critiques > 0} />
        <Indicateur
          libelle="Actions réalisées"
          valeur={totaux.actions ? `${Math.round((totaux.actionsFaites / totaux.actions) * 100)} %` : "—"}
          detail={`${totaux.actionsRetard} en retard`}
          alerte={totaux.actionsRetard > 0}
        />
        <Indicateur
          libelle="Taux de fréquence du groupe"
          valeur={totaux.tauxFrequence === null ? "—" : formatNombre.format(totaux.tauxFrequence)}
          detail={
            totaux.tauxFrequence === null
              ? "heures travaillées ou effectifs à renseigner"
              : `taux de gravité ${formatNombre.format(totaux.tauxGravite ?? 0)}${totaux.sitesSansHeures ? ` · ${totaux.sitesSansHeures} site(s) sans heures exclus` : ""}`
          }
        />
        <Indicateur libelle="Points urgents" valeur={totaux.alertesUrgentes} detail={`${totaux.alertes} point(s) à traiter au total`} alerte={totaux.alertesUrgentes > 0} />
      </div>

      <div className="mb-6 overflow-x-auto rounded-sm border border-pierre/70 bg-white">
        <table className="w-full min-w-[60rem] text-sm">
          <thead className="bg-marbre text-left text-xs text-ardoise">
            <tr>
              <th className="sticky left-0 border-b border-pierre/60 bg-marbre px-3 py-2 uppercase tracking-wide">Établissement</th>
              {colonnes.map((c) => (
                <th key={c.cle} title={c.aide} className="border-b border-pierre/60 px-2 py-2 text-center font-semibold">{c.titre}</th>
              ))}
              <th className="border-b border-pierre/60 px-2 py-2 text-center font-semibold">DUERP figé le</th>
            </tr>
          </thead>
          <tbody>
            {sites.map((s) => (
              <tr key={s.id} className="hover:bg-marbre/30">
                <td className="sticky left-0 border-b border-pierre/60 bg-white px-3 py-2">
                  <button type="button" onClick={() => ouvrirEntreprise(s.id)} className="text-left font-medium text-encre underline decoration-pierre hover:decoration-bronze">
                    {s.nom}
                  </button>
                  {s.id === session.entrepriseId && <span className="ml-2 text-xs text-gris">(ouvert)</span>}
                  <span className="block text-xs text-gris">{s.indicateurs.risques} risque(s) évalué(s)</span>
                </td>
                {colonnes.map((c) => {
                  const valeur = s.indicateurs[c.cle] as number;
                  return (
                    <td key={c.cle} className={`border-b border-pierre/60 px-2 py-2 text-center tabular-nums ${c.alerte && valeur > 0 ? "font-semibold text-[#b42318]" : ""}`}>
                      {valeur}
                    </td>
                  );
                })}
                <td className={`border-b border-pierre/60 px-2 py-2 text-center tabular-nums ${versionsAnciennes.includes(s) ? "font-semibold text-[#b42318]" : ""}`}>
                  {s.indicateurs.derniereVersion ? formaterDate(s.indicateurs.derniereVersion) : "jamais"}
                </td>
              </tr>
            ))}
            <tr className="bg-ivoire font-semibold">
              <td className="sticky left-0 bg-ivoire px-3 py-2">Total du groupe</td>
              {colonnes.map((c) => (
                <td key={c.cle} className="px-2 py-2 text-center tabular-nums">{totaux[c.cle as keyof typeof totaux] as number}</td>
              ))}
              <td className="px-2 py-2 text-center text-xs font-normal text-gris">
                {versionsAnciennes.length ? `${versionsAnciennes.length} à mettre à jour` : "à jour"}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <Carte titre="Risques les plus élevés, tous établissements confondus">
        {prioritaires.length === 0 ? (
          <p className="text-sm text-gris">Aucun risque important ou critique.</p>
        ) : (
          <ul className="divide-y divide-pierre/60">
            {prioritaires.map(({ site, ligne, score }) => (
              <li key={`${site.id}-${ligne.id}`} className="flex flex-wrap items-center justify-between gap-3 py-2.5 text-sm">
                <span className="min-w-0">
                  <span className="font-medium">{ligne.danger || ligne.activite || "Risque"}</span>
                  <span className="text-gris"> · {ligne.unite}</span>
                  <span className="block text-xs text-ardoise">{site.nom}{ligne.risque ? ` · ${ligne.risque}` : ""}</span>
                </span>
                <PastilleCriticite score={score} />
              </li>
            ))}
          </ul>
        )}
      </Carte>
    </div>
  );
}
