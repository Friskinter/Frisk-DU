"use client";

import { useState } from "react";
import { classeBouton, classeBoutonSecondaire, classeChamp } from "@/components/ui";
import type { FicheOfficielle } from "@/lib/fiche-officielle";
import type { ChampsFiche } from "@/lib/lecture-fiche";
import { modifier } from "@/lib/stockage";
import type { FicheEntreprise } from "@/lib/types";

const ficheVide: FicheEntreprise = { siret: "", adresse: "", activite: "", effectif: "", responsable: "" };

const champs: { cle: keyof ChampsFiche; libelle: string }[] = [
  { cle: "raisonSociale", libelle: "Raison sociale" },
  { cle: "siret", libelle: "SIRET" },
  { cle: "adresse", libelle: "Adresse" },
  { cle: "activite", libelle: "Activité (et code NAF)" },
  { cle: "effectif", libelle: "Effectif" },
  { cle: "responsable", libelle: "Responsable du document" },
];

type Ligne = { cle: keyof ChampsFiche; valeur: string; source: "document" | "repertoire"; garder: boolean };

// Import de la fiche que l'entreprise a déjà (Kbis, avis de situation de l'INSEE, fiche interne en PDF,
// Word ou Excel). Le document est lu par le serveur sans être conservé ; ce qu'il ne dit pas est complété
// par la fiche officielle quand il donne un SIRET ou un SIREN. Rien n'est enregistré avant d'avoir relu.
export function ImportFiche() {
  const [etat, setEtat] = useState<"attente" | "lecture" | "relecture" | "rempli">("attente");
  const [lignes, setLignes] = useState<Ligne[]>([]);
  const [nomFichier, setNomFichier] = useState("");
  const [erreur, setErreur] = useState("");

  const importer = async (fichier: File | undefined) => {
    if (!fichier) return;
    setErreur("");
    setNomFichier(fichier.name);
    setEtat("lecture");
    try {
      const envoi = new FormData();
      envoi.append("document", fichier);
      const reponse = await fetch("/api/entreprise/document", { method: "POST", body: envoi });
      const corps = (await reponse.json()) as { document?: ChampsFiche; officielle?: FicheOfficielle | null; erreur?: string };
      if (!reponse.ok) throw new Error(corps.erreur);
      // Ce que dit le document d'abord ; le répertoire officiel seulement pour ce qui manque.
      const trouvees = champs.flatMap(({ cle }): Ligne[] => {
        const duDocument = corps.document?.[cle]?.trim();
        if (duDocument) return [{ cle, valeur: duDocument, source: "document", garder: true }];
        const duRepertoire = corps.officielle?.[cle]?.trim();
        return duRepertoire ? [{ cle, valeur: duRepertoire, source: "repertoire", garder: true }] : [];
      });
      if (!trouvees.length) throw new Error("Aucune information d'entreprise n'a été trouvée dans ce document. Essayez un extrait Kbis ou un avis de situation de l'INSEE, ou la recherche par SIRET.");
      setLignes(trouvees);
      setEtat("relecture");
    } catch (x) {
      setErreur(x instanceof Error && x.message ? x.message : "L'import n'a pas abouti. Réessayez dans un instant.");
      setEtat("attente");
    }
  };

  const changer = (cle: keyof ChampsFiche, maj: Partial<Ligne>) => setLignes((l) => l.map((x) => (x.cle === cle ? { ...x, ...maj } : x)));

  const remplir = () => {
    const retenues = lignes.filter((l) => l.garder && l.valeur.trim());
    modifier((d) => {
      const fiche = { ...ficheVide, ...d.fiche };
      let entreprise = d.entreprise;
      for (const { cle, valeur } of retenues) {
        if (cle === "raisonSociale") entreprise = valeur.trim();
        else fiche[cle] = valeur.trim();
      }
      return { ...d, entreprise, fiche };
    });
    setEtat("rempli");
  };

  return (
    <div className="mb-4 rounded-sm border border-pierre bg-ivoire p-4">
      <p className="text-sm font-medium">Importer votre fiche d&apos;entreprise</p>
      <p className="mb-2 text-xs text-gris">
        Extrait Kbis, avis de situation de l&apos;INSEE ou votre propre fiche, en PDF, Word ou Excel : ses informations remplissent la fiche,
        après votre relecture. Le document n&apos;est pas conservé.
      </p>
      <label className={`${classeBoutonSecondaire} cursor-pointer has-focus-visible:outline-2 has-focus-visible:outline-bronze`}>
        {etat === "lecture" ? `Lecture de ${nomFichier}…` : "Choisir le document…"}
        <input
          type="file"
          accept=".pdf,.docx,.xlsx,.txt,.csv,application/pdf"
          className="sr-only"
          disabled={etat === "lecture"}
          onChange={(e) => {
            void importer(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </label>

      {erreur && <p role="alert" className="mt-2 text-sm text-[#b42318]">{erreur}</p>}
      {etat === "rempli" && (
        <p role="status" className="mt-2 text-sm text-ardoise">
          ✓ Fiche remplie avec les informations de votre document. Vous pouvez encore les modifier ci-dessous.
        </p>
      )}

      {etat === "relecture" && (
        <div className="mt-3 rounded-sm border border-pierre bg-white p-3">
          <p className="mb-2 text-sm">
            Informations trouvées dans <strong>{nomFichier}</strong>. Relisez-les, corrigez si besoin, puis remplissez la fiche.
          </p>
          <ul className="space-y-2">
            {lignes.map((l) => {
              const libelle = champs.find((c) => c.cle === l.cle)!.libelle;
              return (
                <li key={l.cle} className="grid items-center gap-x-3 gap-y-1 text-sm sm:grid-cols-[1.5rem_11rem_1fr]">
                  <input type="checkbox" checked={l.garder} onChange={(e) => changer(l.cle, { garder: e.target.checked })} aria-label={`Utiliser : ${libelle}`} className="size-4 accent-bronze" />
                  <span>
                    {libelle}
                    <span className="block text-xs text-gris">{l.source === "document" ? "Votre document" : "Répertoire officiel (INSEE)"}</span>
                  </span>
                  <input value={l.valeur} onChange={(e) => changer(l.cle, { valeur: e.target.value })} aria-label={libelle} className={classeChamp} />
                </li>
              );
            })}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={remplir} className={classeBouton} disabled={!lignes.some((l) => l.garder)}>
              Remplir la fiche avec ces informations
            </button>
            <button type="button" onClick={() => setEtat("attente")} className={classeBoutonSecondaire}>
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
