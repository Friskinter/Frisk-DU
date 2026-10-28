"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Carte, Chargement, EnTetePage, PastilleCriticite, classeBouton, classeBoutonSecondaire, classeChamp } from "@/components/ui";
import { risqueResiduel, telechargerCsv } from "@/lib/calculs";
import {
  champsDuerp,
  champsSalaries,
  construireDuerp,
  construireSalaries,
  definitions,
  devinerCorrespondance,
  devinerEchelle,
  echelles,
  lireCsv,
  modeles,
  normaliser,
  texte,
  trouverEntete,
  type Champ,
  type Correspondance,
  type Echelle,
  type Tableau,
  type TypeImport,
} from "@/lib/import";
import { modifier, peutModifier, useDonnees, useSession } from "@/lib/stockage";

type Feuille = { nom: string; tableau: Tableau };

const libelle = "mb-1 block text-xs font-medium text-ardoise";

// Feuille la plus probable : celle dont l'en-tête reconnaît le plus de colonnes.
function meilleureFeuille(feuilles: Feuille[], type: TypeImport) {
  let meilleure = 0;
  let meilleurNombre = -1;
  feuilles.forEach((f, i) => {
    const entete = trouverEntete(f.tableau, type);
    const nombre = Object.values(devinerCorrespondance(f.tableau[entete] ?? [], type)).filter(Boolean).length;
    if (nombre > meilleurNombre) {
      meilleurNombre = nombre;
      meilleure = i;
    }
  });
  return meilleure;
}

async function lireFichier(fichier: File): Promise<Feuille[]> {
  const nom = fichier.name.toLowerCase();
  if (nom.endsWith(".csv") || nom.endsWith(".txt")) return [{ nom: fichier.name, tableau: lireCsv(await fichier.text()) }];
  if (nom.endsWith(".xls")) throw new Error("Ancien format Excel (.xls) : ouvrez le fichier dans Excel et enregistrez-le au format .xlsx.");
  if (!nom.endsWith(".xlsx") && !nom.endsWith(".xlsm")) throw new Error("Format non reconnu : choisissez un fichier Excel (.xlsx) ou CSV.");
  // La bibliothèque de lecture d'Excel n'est chargée qu'à la demande.
  const { default: lireClasseur } = await import("read-excel-file/universal");
  const feuilles = await lireClasseur(await fichier.arrayBuffer());
  return feuilles.map((f) => ({ nom: f.sheet, tableau: f.data as Tableau }));
}

export default function PageImport() {
  // useSearchParams doit être sous un Suspense avec le pré-rendu de Next.js.
  return (
    <Suspense fallback={<Chargement />}>
      <Import />
    </Suspense>
  );
}

function Import() {
  const donnees = useDonnees();
  const { role } = useSession();
  const [type, setType] = useState<TypeImport>(useSearchParams().get("type") === "salaries" ? "salaries" : "duerp");
  const [fichier, setFichier] = useState("");
  const [feuilles, setFeuilles] = useState<Feuille[]>([]);
  const [feuille, setFeuille] = useState(0);
  const [entete, setEntete] = useState(0);
  const [correspondance, setCorrespondance] = useState<Correspondance>({});
  const [echelleGravite, setEchelleGravite] = useState<Echelle>(4);
  const [echelleFrequence, setEchelleFrequence] = useState<Echelle>(4);
  const [recopierUnites, setRecopierUnites] = useState(true);
  const [mode, setMode] = useState<"ajouter" | "remplacer">("ajouter");
  const [erreur, setErreur] = useState("");
  const [lecture, setLecture] = useState(false);
  const [termine, setTermine] = useState<{ nombre: number; actions: number } | null>(null);

  if (!donnees) return <Chargement />;
  if (!peutModifier(role, "tout")) {
    return (
      <div>
        <EnTetePage titre="Importer depuis Excel" />
        <p className="rounded-sm border border-pierre/70 bg-white p-6 text-sm text-ardoise">L&apos;import est réservé aux responsables de l&apos;espace.</p>
      </div>
    );
  }

  const tableau = feuilles[feuille]?.tableau ?? [];
  const entetes = tableau[entete] ?? [];
  const nbColonnes = Math.max(0, ...tableau.slice(entete, entete + 50).map((l) => l.length));
  const champs = definitions[type] as Record<Champ, { libelle: string }>;

  // Recalcule l'en-tête, les colonnes et les échelles pour une feuille donnée.
  const preparer = (liste: Feuille[], index: number, t: TypeImport, ligneEntete?: number) => {
    const tab = liste[index]?.tableau ?? [];
    const e = ligneEntete ?? trouverEntete(tab, t);
    const c = devinerCorrespondance(tab[e] ?? [], t);
    const colonne = (champ: Champ) => Number(Object.entries(c).find(([, x]) => x === champ)?.[0] ?? -1);
    const valeurs = (champ: Champ) => (colonne(champ) < 0 ? [] : tab.slice(e + 1).map((l) => l[colonne(champ)]));
    setFeuille(index);
    setEntete(e);
    setCorrespondance(c);
    setEchelleGravite(devinerEchelle(valeurs("gravite")));
    setEchelleFrequence(devinerEchelle(valeurs("frequence")));
  };

  const choisirFichier = async (f: File | undefined) => {
    if (!f) return;
    setErreur("");
    setTermine(null);
    setLecture(true);
    try {
      const liste = (await lireFichier(f)).filter((x) => x.tableau.some((l) => l.some((c) => texte(c))));
      if (!liste.length) throw new Error("Le fichier est vide.");
      setFichier(f.name);
      setFeuilles(liste);
      preparer(liste, meilleureFeuille(liste, type), type);
    } catch (e) {
      setFeuilles([]);
      setErreur(e instanceof Error && e.message ? e.message : "Impossible de lire ce fichier. Vérifiez qu'il s'agit bien d'un fichier Excel (.xlsx) ou CSV.");
    } finally {
      setLecture(false);
    }
  };

  const changerType = (t: TypeImport) => {
    setType(t);
    setTermine(null);
    if (feuilles.length) preparer(feuilles, meilleureFeuille(feuilles, t), t);
  };

  const mettreChamp = (colonne: number, champ: Champ | "") =>
    setCorrespondance((c) => {
      // Un champ ne peut venir que d'une colonne : on le retire de l'ancienne.
      const suivant = Object.fromEntries(Object.entries(c).map(([k, v]) => [k, champ && v === champ ? "" : v])) as Correspondance;
      return { ...suivant, [colonne]: champ };
    });

  const lignesDuerp =
    type === "duerp" && feuilles.length ? construireDuerp(tableau, entete, correspondance, { echelleGravite, echelleFrequence, recopierUnites }) : [];
  const nomsExistants = new Set(donnees.salaries.map((s) => normaliser(s.nom)));
  const salaries =
    type === "salaries" && feuilles.length
      ? construireSalaries(tableau, entete, correspondance).map((s) =>
          nomsExistants.has(normaliser(s.salarie.nom)) ? { ...s, doublon: true } : { ...s, doublon: false },
        )
      : [];
  const nbLignes = type === "duerp" ? lignesDuerp.length : salaries.filter((s) => !s.doublon).length;
  const nbAvertissements =
    type === "duerp" ? lignesDuerp.filter((l) => l.avertissements.length).length : salaries.filter((s) => s.avertissements.length).length;
  const champsUtilises = new Set(Object.values(correspondance).filter(Boolean));
  const obligatoire = type === "duerp" ? champsUtilises.has("danger") || champsUtilises.has("risque") || champsUtilises.has("activite") : champsUtilises.has("nom");

  const importer = () => {
    if (type === "duerp") {
      if (mode === "remplacer" && donnees.duerp.length && !confirm(`Remplacer les ${donnees.duerp.length} lignes actuelles du DUERP (et leurs actions) par les ${lignesDuerp.length} lignes du fichier ?`)) return;
      const lignes = lignesDuerp.map((l) => l.ligne);
      const actions = lignesDuerp.flatMap((l) => (l.action ? [l.action] : []));
      modifier((d) => {
        const anciens = new Set(d.duerp.map((l) => l.id));
        const unites = [...new Set([...d.unites, ...lignes.map((l) => l.unite).filter(Boolean)])];
        return mode === "remplacer"
          ? { ...d, unites, duerp: lignes, actions: [...d.actions.filter((a) => !anciens.has(a.risqueId)), ...actions] }
          : { ...d, unites, duerp: [...d.duerp, ...lignes], actions: [...d.actions, ...actions] };
      });
      setTermine({ nombre: lignes.length, actions: actions.length });
    } else {
      const nouveaux = salaries.filter((s) => !s.doublon).map((s) => s.salarie);
      modifier((d) => ({
        ...d,
        services: [...new Set([...d.services, ...nouveaux.map((s) => s.service).filter(Boolean)])],
        salaries: [...d.salaries, ...nouveaux],
      }));
      setTermine({ nombre: nouveaux.length, actions: 0 });
    }
    setFeuilles([]);
    setFichier("");
  };

  const modele = () => telechargerCsv(type === "duerp" ? "Modele import DUERP.csv" : "Modele import salaries.csv", modeles[type]);

  return (
    <div className="space-y-4">
      <EnTetePage
        titre="Importer depuis Excel"
        description="Reprenez un document unique ou une liste de salariés existants : Frisk DU reconnaît les colonnes, convertit les cotations sur sa grille et vous montre le résultat avant d'enregistrer."
      />

      <Carte titre="1. Fichier">
        <div className="flex flex-wrap gap-2">
          {(["duerp", "salaries"] as const).map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={type === t}
              onClick={() => changerType(t)}
              className={`rounded-sm border px-4 py-2 text-sm ${type === t ? "border-bronze bg-bronze/15 font-medium" : "border-pierre bg-white hover:border-bronze"}`}
            >
              {t === "duerp" ? "Un DUERP existant" : "Une liste de salariés"}
            </button>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label className={`${classeBouton} cursor-pointer`}>
            {fichier ? "Choisir un autre fichier" : "Choisir le fichier (.xlsx ou .csv)"}
            <input
              type="file"
              accept=".xlsx,.xlsm,.csv,.txt"
              className="sr-only"
              onChange={(e) => {
                void choisirFichier(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
          {fichier && <span className="text-sm text-ardoise">{fichier}</span>}
          {lecture && <span className="text-sm text-gris">Lecture du fichier…</span>}
          <button type="button" onClick={modele} className="text-xs text-ardoise underline">
            Télécharger un modèle à remplir
          </button>
        </div>
        {erreur && <p className="mt-3 text-sm text-[#b42318]">{erreur}</p>}
        <p className="mt-3 text-xs text-gris">
          Le fichier est lu dans votre navigateur : seules les lignes que vous importez sont enregistrées dans Frisk DU.
        </p>
      </Carte>

      {termine && (
        <div className="rounded-sm border border-[#0ca30c] bg-[#0ca30c]/10 p-4 text-sm">
          <p className="font-medium text-[#0b6b0b]">
            ✓ {termine.nombre} {type === "duerp" ? "ligne(s) ajoutée(s) au DUERP" : "salarié(s) ajouté(s)"}
            {termine.actions ? ` et ${termine.actions} action(s) au plan d'actions` : ""}.
          </p>
          <p className="mt-1 text-ardoise">
            {type === "duerp"
              ? "Relisez les cotations, surtout celles signalées, et complétez le type de chaque action dans le plan d'actions."
              : "Complétez si besoin les tailles d'EPI de chaque salarié."}{" "}
            <Link href={type === "duerp" ? "/duerp" : "/reglages"} className="text-bronze underline">
              {type === "duerp" ? "Ouvrir le DUERP" : "Voir les salariés"}
            </Link>
          </p>
        </div>
      )}

      {feuilles.length > 0 && (
        <>
          <Carte titre="2. Colonnes">
            <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {feuilles.length > 1 && (
                <label>
                  <span className={libelle}>Feuille</span>
                  <select value={feuille} onChange={(e) => preparer(feuilles, Number(e.target.value), type)} className={classeChamp}>
                    {feuilles.map((f, i) => (
                      <option key={f.nom} value={i}>{f.nom}</option>
                    ))}
                  </select>
                </label>
              )}
              <label>
                <span className={libelle}>Ligne des titres de colonnes</span>
                <select value={entete} onChange={(e) => preparer(feuilles, feuille, type, Number(e.target.value))} className={classeChamp}>
                  {tableau.slice(0, 20).map((l, i) => (
                    <option key={i} value={i}>
                      Ligne {i + 1} : {l.map(texte).filter(Boolean).slice(0, 3).join(" · ").slice(0, 60) || "(vide)"}
                    </option>
                  ))}
                </select>
              </label>
              {type === "duerp" && champsUtilises.has("gravite") && (
                <label>
                  <span className={libelle}>Échelle de gravité du fichier</span>
                  <select value={echelleGravite} onChange={(e) => setEchelleGravite(Number(e.target.value) as Echelle)} className={classeChamp}>
                    {echelles.map((n) => (
                      <option key={n} value={n}>de 1 à {n}{n === 4 ? " (comme Frisk)" : ""}</option>
                    ))}
                  </select>
                </label>
              )}
              {type === "duerp" && champsUtilises.has("frequence") && (
                <label>
                  <span className={libelle}>Échelle de fréquence du fichier</span>
                  <select value={echelleFrequence} onChange={(e) => setEchelleFrequence(Number(e.target.value) as Echelle)} className={classeChamp}>
                    {echelles.map((n) => (
                      <option key={n} value={n}>de 1 à {n}{n === 4 ? " (comme Frisk)" : ""}</option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            {type === "duerp" && (
              <label className="mb-4 flex items-center gap-2 text-sm text-ardoise">
                <input type="checkbox" className="accent-bronze" checked={recopierUnites} onChange={(e) => setRecopierUnites(e.target.checked)} />
                Cellules fusionnées : une unité ou une activité vide reprend celle de la ligne du dessus
              </label>
            )}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[40rem] text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-ardoise">
                  <tr>
                    <th className="border-b border-pierre/60 px-2 py-2">Colonne du fichier</th>
                    <th className="border-b border-pierre/60 px-2 py-2">Exemples</th>
                    <th className="border-b border-pierre/60 px-2 py-2">Devient dans Frisk DU</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: nbColonnes }, (_, i) => i)
                    .filter((i) => texte(entetes[i]) || tableau.slice(entete + 1).some((l) => texte(l[i])))
                    .map((i) => {
                      const exemples = tableau.slice(entete + 1).map((l) => texte(l[i])).filter(Boolean).slice(0, 3);
                      return (
                        <tr key={i} className={correspondance[i] ? "" : "text-gris"}>
                          <td className="border-b border-pierre/60 px-2 py-1.5 font-medium">{texte(entetes[i]) || `Colonne ${i + 1}`}</td>
                          <td className="max-w-80 border-b border-pierre/60 px-2 py-1.5 text-xs">
                            <span className="line-clamp-2">{exemples.join(" · ") || "—"}</span>
                          </td>
                          <td className="border-b border-pierre/60 px-2 py-1.5">
                            <select
                              value={correspondance[i] ?? ""}
                              onChange={(e) => mettreChamp(i, e.target.value as Champ | "")}
                              className={`${classeChamp} max-w-72 ${correspondance[i] ? "border-bronze" : ""}`}
                            >
                              <option value="">— Ne pas importer —</option>
                              {Object.entries(champs).map(([c, d]) => (
                                <option key={c} value={c}>{d.libelle}</option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
            {!obligatoire && (
              <p className="mt-3 text-sm text-[#b42318]">
                {type === "duerp"
                  ? "Indiquez au moins la colonne du danger, du risque ou de l'activité."
                  : "Indiquez la colonne du nom des salariés."}
              </p>
            )}
          </Carte>

          {obligatoire && (
            <Carte titre={`3. Aperçu : ${nbLignes} ${type === "duerp" ? "ligne(s)" : "salarié(s)"} à importer`}>
              {nbAvertissements > 0 && (
                <p className="mb-3 text-sm text-[#8a2c0d]">
                  ⚠ {nbAvertissements} ligne(s) à vérifier après l&apos;import (détail dans la dernière colonne).
                </p>
              )}
              {type === "duerp" ? <ApercuDuerp lignes={lignesDuerp} /> : <ApercuSalaries salaries={salaries} />}

              <div className="mt-4 flex flex-wrap items-center gap-4">
                {type === "duerp" && donnees.duerp.length > 0 && (
                  <div className="flex flex-wrap gap-4 text-sm">
                    <label className="flex items-center gap-2">
                      <input type="radio" className="accent-bronze" checked={mode === "ajouter"} onChange={() => setMode("ajouter")} />
                      Ajouter aux {donnees.duerp.length} lignes actuelles
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="radio" className="accent-bronze" checked={mode === "remplacer"} onChange={() => setMode("remplacer")} />
                      Remplacer le DUERP actuel
                    </label>
                  </div>
                )}
                <button type="button" onClick={importer} disabled={!nbLignes} className={`${classeBouton} disabled:opacity-50`}>
                  Importer {nbLignes} {type === "duerp" ? "ligne(s)" : "salarié(s)"}
                </button>
                <button type="button" onClick={() => { setFeuilles([]); setFichier(""); }} className={classeBoutonSecondaire}>
                  Annuler
                </button>
              </div>
              {type === "duerp" && (
                <p className="mt-3 text-xs text-gris">
                  Les versions figées du DUERP ne changent pas : figez une nouvelle version une fois les lignes importées relues.
                </p>
              )}
            </Carte>
          )}
        </>
      )}
    </div>
  );
}

function ApercuDuerp({ lignes }: { lignes: ReturnType<typeof construireDuerp> }) {
  return (
    <div className="max-h-[32rem] overflow-auto rounded-sm border border-pierre/70">
      <table className="w-full min-w-[60rem] text-sm">
        <thead className="sticky top-0 bg-marbre text-left text-xs uppercase tracking-wide text-ardoise">
          <tr>
            {["Ligne", champsDuerp.unite.libelle, "Danger et risque", "G", "F", "Résiduel", "Action", "À vérifier"].map((t) => (
              <th key={t} className="border-b border-pierre/60 px-2 py-2">{t}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lignes.slice(0, 200).map(({ numero, ligne: l, action, avertissements }) => (
            <tr key={l.id} className={avertissements.length ? "bg-[#fab219]/10" : ""}>
              <td className="border-b border-pierre/60 px-2 py-1.5 text-xs text-gris tabular-nums">{numero}</td>
              <td className="border-b border-pierre/60 px-2 py-1.5">{l.unite || <span className="text-[#b42318]">?</span>}</td>
              <td className="border-b border-pierre/60 px-2 py-1.5">
                <span className="font-medium">{l.danger || l.activite}</span>
                {l.risque && <span className="block text-xs text-gris">{l.risque}</span>}
              </td>
              <td className="border-b border-pierre/60 px-2 py-1.5 tabular-nums">{l.gravite}</td>
              <td className="border-b border-pierre/60 px-2 py-1.5 tabular-nums">{l.frequence}</td>
              <td className="border-b border-pierre/60 px-2 py-1.5"><PastilleCriticite score={risqueResiduel(l)} /></td>
              <td className="border-b border-pierre/60 px-2 py-1.5 text-xs">{action?.intitule}</td>
              <td className="border-b border-pierre/60 px-2 py-1.5 text-xs text-[#8a2c0d]">{avertissements.join(" ; ")}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {lignes.length > 200 && <p className="p-2 text-xs text-gris">… et {lignes.length - 200} autres lignes.</p>}
    </div>
  );
}

function ApercuSalaries({ salaries }: { salaries: (ReturnType<typeof construireSalaries>[number] & { doublon: boolean })[] }) {
  return (
    <div className="max-h-[32rem] overflow-auto rounded-sm border border-pierre/70">
      <table className="w-full min-w-[40rem] text-sm">
        <thead className="sticky top-0 bg-marbre text-left text-xs uppercase tracking-wide text-ardoise">
          <tr>
            {["Ligne", champsSalaries.nom.libelle, champsSalaries.service.libelle, champsSalaries.poste.libelle, "Tailles", "À vérifier"].map((t) => (
              <th key={t} className="border-b border-pierre/60 px-2 py-2">{t}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {salaries.map(({ numero, salarie: s, avertissements, doublon }) => (
            <tr key={s.id} className={doublon ? "text-gris line-through" : avertissements.length ? "bg-[#fab219]/10" : ""}>
              <td className="border-b border-pierre/60 px-2 py-1.5 text-xs text-gris tabular-nums">{numero}</td>
              <td className="border-b border-pierre/60 px-2 py-1.5">{s.nom}</td>
              <td className="border-b border-pierre/60 px-2 py-1.5">{s.service}</td>
              <td className="border-b border-pierre/60 px-2 py-1.5">{s.poste}</td>
              <td className="border-b border-pierre/60 px-2 py-1.5 text-xs">{Object.entries(s.tailles).map(([k, v]) => `${k} : ${v}`).join(" · ")}</td>
              <td className="border-b border-pierre/60 px-2 py-1.5 text-xs text-[#8a2c0d]">
                {doublon ? "déjà dans la liste, ignoré" : avertissements.join(" ; ")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
