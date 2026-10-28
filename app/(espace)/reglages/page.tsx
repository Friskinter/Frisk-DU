"use client";

import { useState } from "react";
import {
  Carte,
  Chargement,
  EnTetePage,
  classeBouton,
  classeBoutonSecondaire,
  classeChamp,
} from "@/components/ui";
import { dateDuJour, nouvelId, telecharger } from "@/lib/calculs";
import { donneesDemo, donneesVides } from "@/lib/demo";
import { modifier, remplacer, useDonnees } from "@/lib/stockage";
import type { Donnees, FicheEntreprise, Salarie } from "@/lib/types";

const categoriesTailles = ["Mains", "Pieds", "Corps", "Haute visibilité"];

const ficheVide: FicheEntreprise = { siret: "", adresse: "", activite: "", effectif: "", responsable: "" };

const champsFiche: { cle: keyof FicheEntreprise; libelle: string; exemple: string }[] = [
  { cle: "siret", libelle: "SIRET", exemple: "123 456 789 00012" },
  { cle: "adresse", libelle: "Adresse", exemple: "12 rue des Lilas, 69000 Lyon" },
  { cle: "activite", libelle: "Activité (et code NAF)", exemple: "Entreposage et stockage (52.10B)" },
  { cle: "effectif", libelle: "Effectif", exemple: "14 salariés" },
  { cle: "responsable", libelle: "Responsable du document", exemple: "Nom et fonction de l'employeur" },
];

export default function PageReglages() {
  const donnees = useDonnees();
  if (!donnees) return <Chargement />;

  const majSalarie = (id: string, champs: Partial<Salarie>) =>
    modifier((d) => ({ ...d, salaries: d.salaries.map((s) => (s.id === id ? { ...s, ...champs } : s)) }));

  const ajouterSalarie = () =>
    modifier((d) => ({
      ...d,
      salaries: [...d.salaries, { id: nouvelId(), nom: "", service: d.services[0] ?? "", poste: "", tailles: {} }],
    }));

  const supprimerSalarie = (s: Salarie) => {
    if (confirm(`Supprimer ${s.nom || "ce salarié"} ? Son historique d'EPI sera conservé.`)) {
      modifier((d) => ({ ...d, salaries: d.salaries.filter((x) => x.id !== s.id) }));
    }
  };

  const sauvegarder = () =>
    telecharger(
      `Frisk-sauvegarde-${dateDuJour()}.json`,
      JSON.stringify(donnees, null, 2),
      "application/json",
    );

  const restaurer = async (fichier: File) => {
    try {
      const contenu = JSON.parse(await fichier.text()) as Donnees;
      if (contenu.version !== 1 || !Array.isArray(contenu.duerp)) throw new Error();
      remplacer(contenu);
      alert("Sauvegarde restaurée.");
    } catch {
      alert("Ce fichier n'est pas une sauvegarde Frisk valide.");
    }
  };

  return (
    <div className="space-y-6">
      <EnTetePage titre="Salariés & réglages" description="Les listes utilisées dans tout Frisk DU." />

      <Carte titre="Entreprise">
        <p className="mb-4 text-sm text-ardoise">Ces informations figurent sur la page de garde du document unique.</p>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm">
            Raison sociale
            <input
              value={donnees.entreprise}
              onChange={(e) => modifier((d) => ({ ...d, entreprise: e.target.value }))}
              className={`${classeChamp} mt-1`}
            />
          </label>
          {champsFiche.map((c) => (
            <label key={c.cle} className="block text-sm">
              {c.libelle}
              <input
                value={donnees.fiche?.[c.cle] ?? ""}
                placeholder={c.exemple}
                onChange={(e) =>
                  modifier((d) => ({ ...d, fiche: { ...ficheVide, ...d.fiche, [c.cle]: e.target.value } }))
                }
                className={`${classeChamp} mt-1`}
              />
            </label>
          ))}
        </div>
      </Carte>

      <div className="grid gap-6 lg:grid-cols-2">
        <Liste
          titre="Services"
          aide="Utilisés pour les salariés et les bilans d'EPI."
          valeurs={donnees.services}
          onChange={(services) => modifier((d) => ({ ...d, services }))}
        />
        <Liste
          titre="Unités de travail"
          aide="Proposées dans la première colonne du DUERP."
          valeurs={donnees.unites}
          onChange={(unites) => modifier((d) => ({ ...d, unites }))}
        />
      </div>

      <Carte titre={`Salariés (${donnees.salaries.length})`}>
        <p className="mb-3 text-sm text-ardoise">
          Les tailles renseignées ici sont proposées automatiquement lors de la remise d&apos;un EPI.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[56rem] text-sm">
            <thead className="bg-marbre text-left text-xs uppercase tracking-wide text-ardoise">
              <tr>
                <th className="px-2 py-2">Nom</th>
                <th className="px-2 py-2">Service</th>
                <th className="px-2 py-2">Poste</th>
                {categoriesTailles.map((c) => (
                  <th key={c} className="px-2 py-2">Taille {c.toLowerCase()}</th>
                ))}
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {donnees.salaries.map((s) => (
                <tr key={s.id} className="border-t border-pierre/60">
                  <td className="px-2 py-1.5"><input value={s.nom} placeholder="Nom" onChange={(e) => majSalarie(s.id, { nom: e.target.value })} className={classeChamp} /></td>
                  <td className="px-2 py-1.5">
                    <select value={s.service} onChange={(e) => majSalarie(s.id, { service: e.target.value })} className={classeChamp}>
                      <option value="">—</option>
                      {donnees.services.map((x) => <option key={x}>{x}</option>)}
                    </select>
                  </td>
                  <td className="px-2 py-1.5"><input value={s.poste} onChange={(e) => majSalarie(s.id, { poste: e.target.value })} className={classeChamp} /></td>
                  {categoriesTailles.map((c) => (
                    <td key={c} className="px-2 py-1.5">
                      <input
                        value={s.tailles[c] ?? ""}
                        onChange={(e) => majSalarie(s.id, { tailles: { ...s.tailles, [c]: e.target.value } })}
                        className={`${classeChamp} w-20`}
                      />
                    </td>
                  ))}
                  <td className="px-2 py-1.5 text-right">
                    <button type="button" onClick={() => supprimerSalarie(s)} title="Supprimer" className="text-gris hover:text-[#b42318]">✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button type="button" className={`${classeBoutonSecondaire} mt-3`} onClick={ajouterSalarie}>
          + Ajouter un salarié
        </button>
      </Carte>

      <Carte titre="Données">
        <p className="mb-4 text-sm text-ardoise">
          Vos données sont enregistrées automatiquement en ligne et accessibles depuis n&apos;importe quel ordinateur.
          Vous pouvez aussi en télécharger une copie de sauvegarde à tout moment.
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={classeBouton} onClick={sauvegarder}>
            Télécharger une sauvegarde
          </button>
          <label className={`${classeBoutonSecondaire} cursor-pointer`}>
            Restaurer une sauvegarde
            <input
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && restaurer(e.target.files[0])}
            />
          </label>
          <button
            type="button"
            className={classeBoutonSecondaire}
            onClick={() => confirm("Remplacer toutes les données de l'entreprise par l'exemple de démonstration ?") && remplacer(donneesDemo(dateDuJour()))}
          >
            Recharger la démonstration
          </button>
          <button
            type="button"
            className={`${classeBoutonSecondaire} hover:border-[#b42318] hover:text-[#b42318]`}
            onClick={() => confirm("Tout effacer et repartir de zéro ? Cette action est irréversible.") && remplacer(donneesVides())}
          >
            Repartir de zéro
          </button>
        </div>
      </Carte>
    </div>
  );
}

function Liste({
  titre,
  aide,
  valeurs,
  onChange,
}: {
  titre: string;
  aide: string;
  valeurs: string[];
  onChange: (valeurs: string[]) => void;
}) {
  const [nouveau, setNouveau] = useState("");
  const ajouter = (e: React.FormEvent) => {
    e.preventDefault();
    const v = nouveau.trim();
    if (v && !valeurs.includes(v)) onChange([...valeurs, v]);
    setNouveau("");
  };
  return (
    <Carte titre={titre}>
      <p className="mb-3 text-sm text-ardoise">{aide}</p>
      <ul className="mb-3 flex flex-wrap gap-2">
        {valeurs.map((v) => (
          <li key={v} className="flex items-center gap-1 rounded-full bg-marbre px-3 py-1 text-sm">
            {v}
            <button type="button" aria-label={`Retirer ${v}`} onClick={() => onChange(valeurs.filter((x) => x !== v))} className="text-gris hover:text-[#b42318]">
              ✕
            </button>
          </li>
        ))}
      </ul>
      <form onSubmit={ajouter} className="flex gap-2">
        <input value={nouveau} onChange={(e) => setNouveau(e.target.value)} placeholder="Ajouter…" className={`${classeChamp} max-w-xs`} />
        <button type="submit" className={classeBoutonSecondaire}>Ajouter</button>
      </form>
    </Carte>
  );
}
