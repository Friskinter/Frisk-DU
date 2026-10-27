"use client";

import { useState } from "react";
import {
  BarresHorizontales,
  Carte,
  Chargement,
  Colonnes,
  EnTetePage,
  Indicateur,
  classeBoutonSecondaire,
  classeChamp,
  type Barre,
} from "@/components/ui";
import {
  dateDuJour,
  decalerJours,
  formatEuros,
  formatNombre,
  formaterDate,
  telechargerCsv,
} from "@/lib/calculs";
import { useDonnees } from "@/lib/stockage";
import type { Mouvement } from "@/lib/types";

const periodes = [
  { valeur: "30", libelle: "30 derniers jours" },
  { valeur: "90", libelle: "3 derniers mois" },
  { valeur: "365", libelle: "12 derniers mois" },
  { valeur: "annee", libelle: "Année en cours" },
  { valeur: "tout", libelle: "Tout l'historique" },
];

const moisCourts = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

type Filtres = { service: string; articleId: string; taille: string; categorie: string; salarieId: string };
const filtresVides: Filtres = { service: "", articleId: "", taille: "", categorie: "", salarieId: "" };

export default function PageBilans() {
  const donnees = useDonnees();
  const [periode, setPeriode] = useState("365");
  const [mesure, setMesure] = useState<"quantite" | "cout">("quantite");
  const [filtres, setFiltres] = useState<Filtres>(filtresVides);

  if (!donnees) return <Chargement />;

  const aujourdhui = dateDuJour();
  const debut =
    periode === "tout"
      ? "0000-00-00"
      : periode === "annee"
        ? `${aujourdhui.slice(0, 4)}-01-01`
        : decalerJours(aujourdhui, -Number(periode));

  const article = (id: string) => donnees.articles.find((a) => a.id === id);
  const salarie = (id: string) => donnees.salaries.find((s) => s.id === id);
  const valeur = (m: Mouvement) => (mesure === "quantite" ? m.quantite : m.quantite * (article(m.articleId)?.prix ?? 0));
  const format = (v: number) => (mesure === "quantite" ? formatNombre.format(Math.round(v)) : formatEuros.format(v));

  const sorties = donnees.mouvements.filter(
    (m) =>
      m.type === "sortie" &&
      m.date >= debut &&
      m.date <= aujourdhui &&
      (!filtres.service || m.service === filtres.service) &&
      (!filtres.articleId || m.articleId === filtres.articleId) &&
      (!filtres.taille || m.taille === filtres.taille) &&
      (!filtres.salarieId || m.salarieId === filtres.salarieId) &&
      (!filtres.categorie || article(m.articleId)?.categorie === filtres.categorie),
  );

  const grouper = (cleDe: (m: Mouvement) => string, libelleDe: (k: string) => string): Barre[] => {
    const totaux = new Map<string, number>();
    for (const m of sorties) totaux.set(cleDe(m), (totaux.get(cleDe(m)) ?? 0) + valeur(m));
    return [...totaux.entries()]
      .map(([k, v]) => ({ cle: k, libelle: libelleDe(k), valeur: v }))
      .sort((a, b) => b.valeur - a.valeur);
  };

  const parArticle = grouper((m) => m.articleId, (k) => article(k)?.nom ?? "Article supprimé");
  const parService = grouper((m) => m.service || "Sans service", (k) => k);
  const parTaille = grouper((m) => m.taille, (k) => (filtres.articleId ? `Taille ${k}` : k));
  const parMotif = grouper((m) => m.motif, (k) => k);
  const parSalarie = grouper((m) => m.salarieId, (k) => salarie(k)?.nom ?? "—");

  // Évolution sur 12 mois glissants (ou depuis le début de la période si plus courte).
  const mois: Barre[] = [];
  const fin = new Date(`${aujourdhui}T12:00:00`);
  for (let i = 11; i >= 0; i--) {
    const d = new Date(fin.getFullYear(), fin.getMonth() - i, 1);
    const cleMois = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    mois.push({ cle: cleMois, libelle: `${moisCourts[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`, valeur: 0 });
  }
  for (const m of sorties) {
    const b = mois.find((x) => x.cle === m.date.slice(0, 7));
    if (b) b.valeur += valeur(m);
  }

  const total = sorties.reduce((t, m) => t + m.quantite, 0);
  const cout = sorties.reduce((t, m) => t + m.quantite * (article(m.articleId)?.prix ?? 0), 0);
  const equipes = new Set(sorties.map((m) => m.salarieId)).size;

  const basculer = (champ: keyof Filtres) => (cle: string) =>
    setFiltres((f) => ({ ...f, [champ]: f[champ] === cle ? "" : cle }));

  const puces = [
    filtres.service && { champ: "service", libelle: `Service : ${filtres.service}` },
    filtres.categorie && { champ: "categorie", libelle: `Catégorie : ${filtres.categorie}` },
    filtres.articleId && { champ: "articleId", libelle: `Article : ${article(filtres.articleId)?.nom}` },
    filtres.taille && { champ: "taille", libelle: `Taille : ${filtres.taille}` },
    filtres.salarieId && { champ: "salarieId", libelle: `Salarié : ${salarie(filtres.salarieId)?.nom}` },
  ].filter(Boolean) as { champ: keyof Filtres; libelle: string }[];

  const exporter = () =>
    telechargerCsv(`Bilan-EPI-${aujourdhui}.csv`, [
      ["Date", "Article", "Catégorie", "Taille", "Quantité", "Coût HT", "Salarié", "Service", "Motif"],
      ...sorties.map((m) => {
        const a = article(m.articleId);
        return [
          formaterDate(m.date), a?.nom ?? "", a?.categorie ?? "", m.taille, m.quantite,
          ((a?.prix ?? 0) * m.quantite).toFixed(2).replace(".", ","), salarie(m.salarieId)?.nom ?? "", m.service, m.motif,
        ];
      }),
    ]);

  return (
    <div>
      <EnTetePage
        titre="Bilans de consommation"
        description="Combien d'EPI ont été consommés, par qui, dans quel service et dans quelles tailles. Cliquez sur une barre pour filtrer tout le rapport."
        actions={
          <button type="button" className={classeBoutonSecondaire} onClick={exporter}>
            Exporter les données (Excel)
          </button>
        }
      />

      {/* Barre de filtres façon Power BI */}
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-sm border border-pierre/70 bg-white p-3">
        <select value={periode} onChange={(e) => setPeriode(e.target.value)} className={`${classeChamp} max-w-48`}>
          {periodes.map((p) => (
            <option key={p.valeur} value={p.valeur}>{p.libelle}</option>
          ))}
        </select>
        <select value={filtres.service} onChange={(e) => setFiltres({ ...filtres, service: e.target.value })} className={`${classeChamp} max-w-44`}>
          <option value="">Tous les services</option>
          {donnees.services.map((s) => <option key={s}>{s}</option>)}
        </select>
        <select value={filtres.categorie} onChange={(e) => setFiltres({ ...filtres, categorie: e.target.value })} className={`${classeChamp} max-w-44`}>
          <option value="">Toutes catégories</option>
          {[...new Set(donnees.articles.map((a) => a.categorie))].map((c) => <option key={c}>{c}</option>)}
        </select>
        <select value={filtres.articleId} onChange={(e) => setFiltres({ ...filtres, articleId: e.target.value, taille: "" })} className={`${classeChamp} max-w-56`}>
          <option value="">Tous les articles</option>
          {donnees.articles.map((a) => <option key={a.id} value={a.id}>{a.nom}</option>)}
        </select>
        <select value={filtres.salarieId} onChange={(e) => setFiltres({ ...filtres, salarieId: e.target.value })} className={`${classeChamp} max-w-44`}>
          <option value="">Tous les salariés</option>
          {donnees.salaries.map((s) => <option key={s.id} value={s.id}>{s.nom}</option>)}
        </select>
        <div className="ml-auto flex overflow-hidden rounded-sm border border-pierre text-sm">
          {(["quantite", "cout"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMesure(m)}
              className={`px-3 py-1.5 ${mesure === m ? "bg-encre text-marbre" : "bg-white text-ardoise"}`}
            >
              {m === "quantite" ? "Quantités" : "Coûts €"}
            </button>
          ))}
        </div>
      </div>

      {puces.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {puces.map((p) => (
            <button
              key={p.champ}
              type="button"
              onClick={() => setFiltres({ ...filtres, [p.champ]: "" })}
              className="rounded-full bg-bronze/15 px-3 py-1 text-xs text-encre hover:bg-bronze/25"
            >
              {p.libelle} ✕
            </button>
          ))}
          <button type="button" onClick={() => setFiltres(filtresVides)} className="text-xs text-gris underline">
            Tout effacer
          </button>
        </div>
      )}

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Indicateur libelle="EPI distribués" valeur={formatNombre.format(total)} detail={`${sorties.length} remises`} />
        <Indicateur libelle="Coût total" valeur={formatEuros.format(cout)} detail="HT, au prix d'achat" />
        <Indicateur libelle="Salariés équipés" valeur={equipes} detail={`sur ${donnees.salaries.length} salariés`} />
        <Indicateur
          libelle="Coût moyen par salarié"
          valeur={equipes ? formatEuros.format(cout / equipes) : "—"}
          detail="sur la période"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Carte titre={`Évolution mensuelle — ${mesure === "quantite" ? "quantités" : "coûts"}`} className="lg:col-span-2">
          <Colonnes donnees={mois} format={format} />
        </Carte>
        <Carte titre="Par article">
          <BarresHorizontales donnees={parArticle} format={format} actif={filtres.articleId} onSelection={basculer("articleId")} />
        </Carte>
        <Carte titre="Par service">
          <BarresHorizontales donnees={parService} format={format} actif={filtres.service} onSelection={basculer("service")} />
        </Carte>
        <Carte titre={filtres.articleId ? `Par taille — ${article(filtres.articleId)?.nom}` : "Par taille (tous articles)"}>
          <BarresHorizontales donnees={parTaille} format={format} actif={filtres.taille} onSelection={basculer("taille")} />
          {!filtres.articleId && (
            <p className="mt-3 text-xs text-gris">Astuce : cliquez sur un article pour voir la répartition de ses tailles.</p>
          )}
        </Carte>
        <Carte titre="Par motif">
          <BarresHorizontales donnees={parMotif} format={format} />
        </Carte>
        <Carte titre="Par salarié" className="lg:col-span-2">
          <BarresHorizontales donnees={parSalarie.slice(0, 15)} format={format} actif={filtres.salarieId} onSelection={basculer("salarieId")} />
        </Carte>
      </div>
    </div>
  );
}
