"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Chargement, EnTetePage, classeBoutonSecondaire, classeChamp } from "@/components/ui";
import { telechargerCsv } from "@/lib/calculs";
import { detailsChangement, libelleElement, zones, type EntreeJournal } from "@/lib/journal";
import { useDonnees, useSession } from "@/lib/stockage";
import { supabaseNavigateur } from "@/lib/supabase/client";

const PAR_PAGE = 100;

const actions: Record<EntreeJournal["action"], { libelle: string; couleur: string }> = {
  ajout: { libelle: "Ajout", couleur: "#0ca30c" },
  modification: { libelle: "Modification", couleur: "#b08d57" },
  suppression: { libelle: "Suppression", couleur: "#d03b3b" },
};

const dateHeure = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" });

export default function PageJournal() {
  // useSearchParams doit être sous un Suspense avec le pré-rendu de Next.js.
  return (
    <Suspense fallback={<Chargement />}>
      <Journal />
    </Suspense>
  );
}

function Journal() {
  const donnees = useDonnees();
  const { entrepriseId } = useSession();
  const element = useSearchParams().get("element") ?? "";
  const [zone, setZone] = useState("");
  const [auteur, setAuteur] = useState("");
  const [limite, setLimite] = useState(PAR_PAGE);
  const [etat, setEtat] = useState<{ entrees: EntreeJournal[]; chargement: boolean; erreur: boolean; fin: boolean }>({
    entrees: [],
    chargement: true,
    erreur: false,
    fin: false,
  });

  useEffect(() => {
    if (!entrepriseId) return;
    let actif = true;
    let requete = supabaseNavigateur()
      .from("journal")
      .select("id, created_at, auteur, collection, element_id, action, avant, apres")
      .eq("entreprise_id", entrepriseId)
      .order("id", { ascending: false })
      .limit(limite);
    if (zone) requete = requete.eq("collection", zone);
    if (auteur) requete = requete.eq("auteur", auteur);
    if (element) requete = requete.eq("element_id", element);
    requete.then(({ data, error }: { data: unknown[] | null; error: unknown }) => {
      if (!actif) return;
      const entrees = (data ?? []) as EntreeJournal[];
      setEtat({ entrees, chargement: false, erreur: !!error, fin: entrees.length < limite });
    });
    return () => {
      actif = false;
    };
  }, [entrepriseId, zone, auteur, element, limite]);

  if (!donnees) return <Chargement />;

  const auteurs = [...new Set(etat.entrees.map((e) => e.auteur).filter(Boolean))];
  const exporter = () =>
    telechargerCsv(`Journal - ${donnees.entreprise}.csv`, [
      ["Date", "Auteur", "Zone", "Élément", "Action", "Détail"],
      ...etat.entrees.map((e) => [
        dateHeure.format(new Date(e.created_at)),
        e.auteur,
        zones[e.collection] ?? e.collection,
        libelleElement(e, donnees),
        actions[e.action].libelle,
        detailsChangement(e).map((d) => `${d.champ} : ${d.avant} → ${d.apres}`).join(" ; "),
      ]),
    ]);

  return (
    <div>
      <EnTetePage
        titre="Journal des modifications"
        description="Toutes les modifications enregistrées : qui, quand, quoi, avec l'ancienne et la nouvelle valeur. Le journal ne peut être ni modifié ni effacé."
        actions={
          <button type="button" className={classeBoutonSecondaire} onClick={exporter} disabled={!etat.entrees.length}>
            Exporter (Excel)
          </button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select value={zone} onChange={(e) => setZone(e.target.value)} className={`${classeChamp} max-w-52`}>
          <option value="">Toutes les zones</option>
          {Object.entries(zones).map(([cle, libelle]) => (
            <option key={cle} value={cle}>
              {libelle}
            </option>
          ))}
        </select>
        <select value={auteur} onChange={(e) => setAuteur(e.target.value)} className={`${classeChamp} max-w-64`}>
          <option value="">Toutes les personnes</option>
          {[...new Set([auteur, ...auteurs].filter(Boolean))].map((a) => (
            <option key={a}>{a}</option>
          ))}
        </select>
        {element && (
          <Link href="/journal" className="rounded-full bg-bronze/15 px-3 py-1 text-xs">
            Historique d&apos;un seul élément ✕
          </Link>
        )}
      </div>

      {etat.chargement ? (
        <Chargement />
      ) : etat.erreur ? (
        <p className="text-sm text-[#b42318]">
          Le journal n&apos;a pas pu être chargé. S&apos;il s&apos;agit de la première utilisation, la mise à jour de la base
          (migration 003) n&apos;a peut-être pas encore été appliquée.
        </p>
      ) : etat.entrees.length === 0 ? (
        <p className="text-sm text-gris">Aucune modification enregistrée pour ces critères.</p>
      ) : (
        <ul className="divide-y divide-pierre/60 rounded-sm border border-pierre/70 bg-white">
          {etat.entrees.map((e) => {
            const a = actions[e.action];
            const details = detailsChangement(e);
            return (
              <li key={e.id} className="flex flex-wrap gap-x-4 gap-y-1 px-4 py-3 text-sm">
                <span className="w-32 shrink-0 text-xs text-gris tabular-nums">{dateHeure.format(new Date(e.created_at))}</span>
                <span className="min-w-0 flex-1">
                  <span className="font-medium" style={{ color: a.couleur }}>{a.libelle}</span>
                  <span className="text-gris"> · {zones[e.collection] ?? e.collection} · </span>
                  <span className="font-medium">{libelleElement(e, donnees)}</span>
                  {details.length > 0 && (
                    <span className="mt-1 block space-y-0.5 text-ardoise">
                      {details.map((d) => (
                        <span key={d.champ} className="block">
                          {d.champ} : <span className="text-gris line-through">{d.avant}</span> → {d.apres}
                        </span>
                      ))}
                    </span>
                  )}
                </span>
                <span className="w-full text-xs text-gris sm:w-56 sm:text-right">{e.auteur || "—"}</span>
              </li>
            );
          })}
        </ul>
      )}

      {!etat.chargement && !etat.fin && (
        <button type="button" className={`${classeBoutonSecondaire} mt-4`} onClick={() => setLimite((l) => l + PAR_PAGE)}>
          Afficher plus
        </button>
      )}
    </div>
  );
}
