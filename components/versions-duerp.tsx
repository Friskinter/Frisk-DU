"use client";

import Link from "next/link";
import { useState } from "react";
import { classeBouton, classeBoutonSecondaire, classeChamp } from "@/components/ui";
import { formaterDate } from "@/lib/calculs";
import { telechargerDocumentUnique } from "@/lib/pdf/telecharger";
import { peutModifier, useSession } from "@/lib/stockage";
import type { Donnees } from "@/lib/types";
import { figerVersion, motifsVersion, useVersions, type VersionDuerp } from "@/lib/versions";

export function VersionsDuerp({ donnees, onFermer }: { donnees: Donnees; onFermer: () => void }) {
  const session = useSession();
  const { versions, chargement, erreur, recharger } = useVersions(session.entrepriseId);
  const [motif, setMotif] = useState(motifsVersion[0]);
  const [precision, setPrecision] = useState("");
  const [auteur, setAuteur] = useState(donnees.fiche?.responsable || session.email);
  const [etat, setEtat] = useState<"pret" | "envoi" | "erreur">("pret");
  const [telechargement, setTelechargement] = useState("");

  const figer = async (e: React.FormEvent) => {
    e.preventDefault();
    const detail = precision.trim();
    const libelle = motif === "Autre" ? detail : detail ? `${motif} : ${detail}` : motif;
    if (!libelle) return;
    if (!confirm("Figer cette version ? Elle sera conservée telle quelle et ne pourra plus être modifiée ni supprimée.")) return;
    setEtat("envoi");
    try {
      await figerVersion(session.entrepriseId, donnees, libelle, auteur.trim());
      setPrecision("");
      setEtat("pret");
      recharger();
    } catch {
      setEtat("erreur");
    }
  };

  const telecharger = async (v: VersionDuerp) => {
    setTelechargement(v.id);
    try {
      const historique = versions
        .filter((x) => x.numero <= v.numero)
        .map((x) => ({ numero: x.numero, date: x.created_at.slice(0, 10), motif: x.motif, auteur: x.auteur }));
      await telechargerDocumentUnique({ ...v.contenu, identite: donnees.identite }, { numero: v.numero, date: v.created_at.slice(0, 10), historique });
    } finally {
      setTelechargement("");
    }
  };

  const derniere = versions[0];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-encre/60 p-4 sm:p-8" role="dialog" aria-modal="true" aria-label="Versions du document unique">
      <div className="w-full max-w-3xl rounded-sm bg-ivoire shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-pierre/70 p-5">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-bronze-fonce">Historique</p>
            <h2 className="mt-1 font-serif text-2xl">Versions du document unique</h2>
            <p className="mt-1 text-sm text-ardoise">
              Chaque mise à jour du DUERP doit être conservée au moins 40 ans. Figer une version l&apos;enregistre telle
              quelle, datée, sans possibilité de modification.
            </p>
          </div>
          <button type="button" onClick={onFermer} aria-label="Fermer" className="text-xl text-gris hover:text-encre">
            ✕
          </button>
        </div>

        {session.abonnement.acces === "essai" ? (
          <p className="border-b border-pierre/70 p-5 text-sm text-ardoise">
            🔒 La version officielle, datée et conservée 40 ans, se fige avec l&apos;abonnement. Pendant l&apos;essai, vous pouvez
            préparer votre document unique et le télécharger en version d&apos;essai.{" "}
            {session.roleCompte === "responsable" && <Link href="/abonnement" className="text-bronze-fonce underline">Choisir mon abonnement</Link>}
          </p>
        ) : !peutModifier(session.role, "tout") ? (
          <p className="border-b border-pierre/70 p-5 text-sm text-ardoise">
            Seul un responsable de l&apos;entreprise peut figer une nouvelle version.
          </p>
        ) : (
          <form onSubmit={figer} className="space-y-3 border-b border-pierre/70 p-5">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-ardoise">Figer la version actuelle</h3>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="block text-sm">
                Motif de la mise à jour
                <select value={motif} onChange={(e) => setMotif(e.target.value)} className={`${classeChamp} mt-1`}>
                  {motifsVersion.map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                Établie par
                <input required value={auteur} onChange={(e) => setAuteur(e.target.value)} className={`${classeChamp} mt-1`} />
              </label>
            </div>
            <label className="block text-sm">
              Précision {motif === "Autre" ? "" : <span className="text-gris">(facultatif)</span>}
              <input
                required={motif === "Autre"}
                value={precision}
                onChange={(e) => setPrecision(e.target.value)}
                placeholder="Ex. : installation d'une nouvelle machine dans l'atelier"
                className={`${classeChamp} mt-1`}
              />
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <button type="submit" disabled={etat === "envoi" || !donnees.duerp.length} className={`${classeBouton} disabled:opacity-50`}>
                {etat === "envoi" ? "Enregistrement…" : `🗄 Figer la version ${derniere ? derniere.numero + 1 : 1}`}
              </button>
              <span className="text-xs text-gris">
                {donnees.duerp.length} risque{donnees.duerp.length > 1 ? "s" : ""} seront enregistrés.
              </span>
              {etat === "erreur" && <span className="text-sm text-[#b42318]">La version n&apos;a pas pu être enregistrée. Réessayez.</span>}
            </div>
          </form>
        )}

        <div className="p-5">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ardoise">Versions enregistrées</h3>
          {chargement ? (
            <p className="text-sm text-gris">Chargement…</p>
          ) : erreur ? (
            <p className="text-sm text-[#b42318]">
              L&apos;historique n&apos;a pas pu être chargé. Si c&apos;est la première fois, la table des versions n&apos;est
              peut-être pas encore créée dans Supabase.
            </p>
          ) : versions.length === 0 ? (
            <p className="text-sm text-gris">Aucune version figée pour l&apos;instant.</p>
          ) : (
            <ul className="divide-y divide-pierre/60 rounded-sm border border-pierre/70 bg-white">
              {versions.map((v) => (
                <li key={v.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium">
                      Version {v.numero} · {formaterDate(v.created_at.slice(0, 10))}
                    </p>
                    <p className="text-ardoise">{v.motif}</p>
                    <p className="text-xs text-gris">
                      {v.contenu.duerp.length} risques{v.auteur && ` · établie par ${v.auteur}`}
                    </p>
                  </div>
                  <button
                    type="button"
                    className={`${classeBoutonSecondaire} disabled:opacity-60`}
                    disabled={telechargement === v.id}
                    onClick={() => telecharger(v)}
                  >
                    {telechargement === v.id ? "Création du PDF…" : "⬇ PDF"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
