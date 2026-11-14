"use client";

import { useState } from "react";
import { classeBoutonSecondaire, classeChamp } from "@/components/ui";
import type { FicheOfficielle } from "@/lib/fiche-officielle";
import { modifier } from "@/lib/stockage";
import type { FicheEntreprise } from "@/lib/types";

const ficheVide: FicheEntreprise = { siret: "", adresse: "", activite: "", effectif: "", responsable: "" };

// Remplit la fiche de l'entreprise avec sa fiche officielle (INSEE), retrouvée par SIRET, SIREN ou nom.
// Seules les informations trouvées remplacent celles saisies ; les heures travaillées et le profil restent.
export function RechercheFicheOfficielle() {
  const [recherche, setRecherche] = useState("");
  const [etat, setEtat] = useState<"attente" | "recherche" | "resultats" | "rempli">("attente");
  const [entreprises, setEntreprises] = useState<FicheOfficielle[]>([]);
  const [erreur, setErreur] = useState("");

  const rechercher = async (e: React.FormEvent) => {
    e.preventDefault();
    setErreur("");
    setEtat("recherche");
    try {
      const reponse = await fetch("/api/entreprise", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ recherche }) });
      const corps = (await reponse.json()) as { entreprises?: FicheOfficielle[]; erreur?: string };
      if (!reponse.ok) throw new Error(corps.erreur);
      setEntreprises(corps.entreprises ?? []);
      setEtat("resultats");
    } catch (x) {
      setErreur(x instanceof Error && x.message ? x.message : "La recherche n'a pas abouti. Réessayez dans un instant.");
      setEtat("attente");
    }
  };

  const remplir = (f: FicheOfficielle) => {
    modifier((d) => {
      const fiche = { ...ficheVide, ...d.fiche };
      for (const cle of ["siret", "adresse", "activite", "effectif", "responsable"] as const) if (f[cle]) fiche[cle] = f[cle];
      return { ...d, entreprise: f.raisonSociale || d.entreprise, fiche };
    });
    setEtat("rempli");
    setEntreprises([]);
  };

  return (
    <div className="mb-5 rounded-sm border border-pierre bg-ivoire p-4">
      <form onSubmit={rechercher} className="flex flex-wrap items-end gap-2">
        <label className="min-w-0 flex-1 text-sm" htmlFor="recherche-fiche-officielle">
          <span className="font-medium">Remplir avec la fiche officielle de l&apos;entreprise</span>
          <span id="aide-fiche-officielle" className="mb-1 block text-xs text-gris">
            SIRET, SIREN ou nom : les informations du répertoire de l&apos;INSEE remplissent la fiche, que vous pouvez ensuite modifier.
          </span>
          <input
            id="recherche-fiche-officielle"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="123 456 789 00012"
            aria-describedby="aide-fiche-officielle"
            className={`${classeChamp} min-w-48`}
          />
        </label>
        <button type="submit" disabled={etat === "recherche" || !recherche.trim()} className={classeBoutonSecondaire}>
          {etat === "recherche" ? "Recherche…" : "Trouver la fiche"}
        </button>
      </form>

      {erreur && <p role="alert" className="mt-2 text-sm text-[#b42318]">{erreur}</p>}
      {etat === "rempli" && (
        <p role="status" className="mt-2 text-sm text-ardoise">
          ✓ Fiche remplie avec les informations officielles. Vérifiez-les ci-dessous : vous pouvez les modifier.
        </p>
      )}
      {etat === "resultats" &&
        (entreprises.length ? (
          <ul className="mt-3 divide-y divide-pierre/60 rounded-sm border border-pierre bg-white">
            {entreprises.map((f) => (
              <li key={f.siret || f.siren} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm">
                <span className="min-w-0">
                  <span className="block font-medium">{f.raisonSociale}</span>
                  <span className="block text-xs text-gris">{[f.siret && `SIRET ${f.siret}`, f.ville, f.activite].filter(Boolean).join(" · ")}</span>
                </span>
                <button type="button" onClick={() => remplir(f)} className={classeBoutonSecondaire} aria-label={`Remplir avec la fiche de ${f.raisonSociale}`}>
                  Remplir avec cette fiche
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-ardoise">Aucune entreprise en activité ne correspond. Vérifiez le numéro, ou remplissez la fiche à la main.</p>
        ))}
    </div>
  );
}
