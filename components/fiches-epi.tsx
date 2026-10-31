"use client";

import { useState } from "react";
import { PaveSignature } from "@/components/signature";
import { Carte, classeBouton, classeBoutonSecondaire, classeChamp } from "@/components/ui";
import { dateDuJour, formaterDate, nouvelId } from "@/lib/calculs";
import { telechargerFicheEpi } from "@/lib/pdf/telecharger";
import { modifier } from "@/lib/stockage";
import type { Donnees } from "@/lib/types";

export function FichesSalaries({ donnees, peutSigner }: { donnees: Donnees; peutSigner: boolean }) {
  const [salarieId, setSalarieId] = useState(donnees.salaries[0]?.id ?? "");
  const [recherche, setRecherche] = useState("");
  const [signer, setSigner] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);
  const [pdf, setPdf] = useState<"pret" | "generation" | "erreur">("pret");

  const remisesDe = (id: string) =>
    donnees.mouvements.filter((m) => m.type === "sortie" && m.salarieId === id).sort((a, b) => (a.date < b.date ? 1 : -1));

  const terme = recherche.trim().toLowerCase();
  const salaries = donnees.salaries.filter(
    (s) => !terme || `${s.nom} ${s.service} ${s.poste}`.toLowerCase().includes(terme),
  );
  const salarie = donnees.salaries.find((s) => s.id === salarieId);
  const remises = salarie ? remisesDe(salarie.id) : [];
  const nonSignees = remises.filter((m) => !m.signatureId);
  const nomArticle = (id: string) => donnees.articles.find((a) => a.id === id)?.nom ?? "Article supprimé";

  const validerSignature = () => {
    if (!signature) return;
    if (!salarie) return;
    const ids = new Set(nonSignees.map((m) => m.id));
    const signatureId = nouvelId();
    modifier((d) => ({
      ...d,
      signatures: { ...d.signatures, [signatureId]: { image: signature, date: dateDuJour(), salarieId: salarie.id } },
      mouvements: d.mouvements.map((m) => (ids.has(m.id) ? { ...m, signatureId } : m)),
    }));
    setSigner(false);
    setSignature(null);
  };

  const telecharger = async () => {
    if (!salarie) return;
    setPdf("generation");
    try {
      await telechargerFicheEpi(donnees, salarie.id);
      setPdf("pret");
    } catch {
      setPdf("erreur");
    }
  };

  if (!donnees.salaries.length) {
    return <p className="text-sm text-gris">Ajoutez d&apos;abord vos salariés dans la page « Salariés ».</p>;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
      <div>
        <input
          type="search"
          placeholder="Rechercher un salarié…"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          className={`${classeChamp} mb-2`}
        />
        <ul className="max-h-[60vh] overflow-y-auto rounded-sm border border-pierre/70 bg-white">
          {salaries.map((s) => {
            const aSigner = remisesDe(s.id).filter((m) => !m.signatureId).length;
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSalarieId(s.id);
                    setSigner(false);
                  }}
                  className={`flex w-full items-center justify-between gap-2 border-b border-pierre/40 px-3 py-2 text-left text-sm ${
                    s.id === salarieId ? "bg-bronze/15" : "hover:bg-ivoire"
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{s.nom || "Sans nom"}</span>
                    <span className="block truncate text-xs text-gris">{s.service} · {s.poste}</span>
                  </span>
                  {aSigner > 0 && (
                    <span className="shrink-0 rounded-full bg-[#fab219] px-2 py-0.5 text-xs text-[#0b0b0b]" title="Remises non signées">
                      {aSigner} à signer
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {salarie && (
        <div className="space-y-4">
          <Carte>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-serif text-2xl">{salarie.nom}</h2>
                <p className="text-sm text-ardoise">{salarie.service} · {salarie.poste}</p>
                <p className="mt-1 text-xs text-gris">
                  {remises.length} remise{remises.length > 1 ? "s" : ""} ·{" "}
                  {nonSignees.length ? `${nonSignees.length} non signée${nonSignees.length > 1 ? "s" : ""}` : "toutes signées"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={`${classeBoutonSecondaire} disabled:opacity-60`} onClick={telecharger} disabled={pdf === "generation" || !remises.length}>
                  {pdf === "generation" ? "Création du PDF…" : pdf === "erreur" ? "⚠ Réessayer le PDF" : "⬇ Fiche EPI (PDF)"}
                </button>
                {nonSignees.length > 0 && peutSigner && (
                  <button type="button" className={classeBouton} onClick={() => setSigner(true)}>
                    ✍ Faire signer ({nonSignees.length})
                  </button>
                )}
              </div>
            </div>

            {signer && (
              <div className="mt-4 rounded-sm border border-bronze/60 bg-ivoire p-4">
                <p className="text-sm font-medium">Signature de {salarie.nom}</p>
                <p className="mt-1 text-sm text-ardoise">
                  Je reconnais avoir reçu les {nonSignees.length} équipement{nonSignees.length > 1 ? "s" : ""} de protection
                  individuelle listé{nonSignees.length > 1 ? "s" : ""} ci-dessous comme non signé
                  {nonSignees.length > 1 ? "s" : ""}, avoir été informé(e) de leurs conditions d&apos;utilisation, et
                  m&apos;engage à les porter et à signaler toute détérioration.
                </p>
                <div className="mt-3 max-w-lg">
                  <PaveSignature onChange={setSignature} />
                </div>
                <div className="mt-3 flex gap-2">
                  <button type="button" className={`${classeBouton} disabled:opacity-50`} disabled={!signature} onClick={validerSignature}>
                    Valider la signature
                  </button>
                  <button type="button" className={classeBoutonSecondaire} onClick={() => { setSigner(false); setSignature(null); }}>
                    Annuler
                  </button>
                </div>
              </div>
            )}
          </Carte>

          {remises.length === 0 ? (
            <p className="text-sm text-gris">Aucun équipement remis à ce salarié pour l&apos;instant.</p>
          ) : (
            <div className="overflow-x-auto rounded-sm border border-pierre/70 bg-white">
              <table className="w-full min-w-[40rem] text-sm">
                <thead className="bg-marbre text-left text-xs uppercase tracking-wide text-ardoise">
                  <tr>
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Équipement</th>
                    <th className="px-3 py-2">Taille</th>
                    <th className="px-3 py-2 text-right">Qté</th>
                    <th className="px-3 py-2">Motif</th>
                    <th className="px-3 py-2">Signature</th>
                  </tr>
                </thead>
                <tbody>
                  {remises.map((m) => (
                    <tr key={m.id} className="border-t border-pierre/60">
                      <td className="px-3 py-2 whitespace-nowrap">{formaterDate(m.date)}</td>
                      <td className="px-3 py-2">{nomArticle(m.articleId)}</td>
                      <td className="px-3 py-2">{m.taille}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{m.quantite}</td>
                      <td className="px-3 py-2 text-ardoise">{m.motif}</td>
                      <td className="px-3 py-2">
                        {m.signatureId && donnees.signatures?.[m.signatureId] ? (
                          <span className="flex items-center gap-2">
                            {/* eslint-disable-next-line @next/next/no-img-element -- image générée localement (data URL) */}
                            <img src={donnees.signatures[m.signatureId].image} alt={`Signature de ${salarie.nom}`} className="h-8 w-auto" />
                            <span className="text-xs text-gris">{formaterDate(donnees.signatures[m.signatureId].date)}</span>
                          </span>
                        ) : (
                          <span className="text-xs text-[#b42318]">Non signée</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
