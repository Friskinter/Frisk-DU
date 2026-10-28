"use client";

import { useState } from "react";
import { FichesSalaries } from "@/components/fiches-epi";
import { PaveSignature } from "@/components/signature";
import {
  Carte,
  Chargement,
  EnTetePage,
  Indicateur,
  Pastille,
  classeBouton,
  classeBoutonSecondaire,
  classeChamp,
} from "@/components/ui";
import {
  calculerStocks,
  dateDuJour,
  etatsStock,
  formatEuros,
  formatNombre,
  formaterDate,
  nouvelId,
  telechargerCsv,
} from "@/lib/calculs";
import { categoriesEpi } from "@/lib/referentiel";
import { modifier, useDonnees } from "@/lib/stockage";
import type { Article, Donnees, Mouvement } from "@/lib/types";

type Onglet = "stocks" | "saisie" | "fiches" | "historique" | "catalogue";

const onglets: { valeur: Onglet; libelle: string }[] = [
  { valeur: "stocks", libelle: "Stocks & commandes" },
  { valeur: "saisie", libelle: "Saisir une sortie / entrée" },
  { valeur: "fiches", libelle: "Fiches salariés" },
  { valeur: "historique", libelle: "Historique" },
  { valeur: "catalogue", libelle: "Catalogue d'articles" },
];

function ajouterMouvement(m: Omit<Mouvement, "id">, signature?: string) {
  modifier((d) => {
    if (!signature) return { ...d, mouvements: [{ id: nouvelId(), ...m }, ...d.mouvements] };
    const signatureId = nouvelId();
    return {
      ...d,
      signatures: { ...d.signatures, [signatureId]: { image: signature, date: dateDuJour(), salarieId: m.salarieId } },
      mouvements: [{ id: nouvelId(), ...m, signatureId }, ...d.mouvements],
    };
  });
}

export default function PageEpi() {
  const donnees = useDonnees();
  const [onglet, setOnglet] = useState<Onglet>("stocks");
  if (!donnees) return <Chargement />;

  return (
    <div>
      <EnTetePage
        titre="EPI & stocks"
        description="Suivez les équipements de protection individuelle remis à chaque salarié, votre stock par taille et ce qu'il faut commander."
      />
      <div className="mb-6 flex gap-1 overflow-x-auto border-b border-pierre" role="tablist">
        {onglets.map((o) => (
          <button
            key={o.valeur}
            type="button"
            role="tab"
            aria-selected={onglet === o.valeur}
            onClick={() => setOnglet(o.valeur)}
            className={`-mb-px shrink-0 border-b-2 px-4 py-2.5 text-sm transition-colors ${
              onglet === o.valeur ? "border-bronze font-medium text-encre" : "border-transparent text-gris hover:text-encre"
            }`}
          >
            {o.libelle}
          </button>
        ))}
      </div>
      {onglet === "stocks" && <Stocks donnees={donnees} />}
      {onglet === "saisie" && <Saisie donnees={donnees} />}
      {onglet === "fiches" && <FichesSalaries donnees={donnees} />}
      {onglet === "historique" && <Historique donnees={donnees} />}
      {onglet === "catalogue" && <Catalogue donnees={donnees} />}
    </div>
  );
}

// ---------- Stocks & commandes ----------

function Stocks({ donnees }: { donnees: Donnees }) {
  const [categorie, setCategorie] = useState("");
  const [seulementACommander, setSeulementACommander] = useState(false);
  const aujourdhui = dateDuJour();
  const stocks = calculerStocks(donnees, aujourdhui);
  const lignes = stocks.filter(
    (s) => (!categorie || s.article.categorie === categorie) && (!seulementACommander || s.aCommander > 0),
  );
  const aCommander = stocks.filter((s) => s.aCommander > 0);
  const montant = aCommander.reduce((t, s) => t + s.aCommander * s.article.prix, 0);
  const valeurStock = stocks.reduce((t, s) => t + Math.max(0, s.actuel) * s.article.prix, 0);

  const changerTampon = (article: Article, taille: string, valeur: number) =>
    modifier((d) => ({
      ...d,
      articles: d.articles.map((a) =>
        a.id === article.id ? { ...a, tampons: { ...a.tampons, [taille]: Math.max(0, valeur) } } : a,
      ),
    }));

  const exporterCommande = () =>
    telechargerCsv(`Commande-EPI-${aujourdhui}.csv`, [
      ["Article", "Catégorie", "Taille", "Stock actuel", "Stock tampon", "Quantité à commander", "Prix unitaire HT", "Total HT"],
      ...aCommander.map((s) => [
        s.article.nom, s.article.categorie, s.taille, s.actuel, s.tampon, s.aCommander,
        s.article.prix.toFixed(2).replace(".", ","), (s.aCommander * s.article.prix).toFixed(2).replace(".", ","),
      ]),
    ]);

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Indicateur
          libelle="Références à commander"
          valeur={aCommander.length}
          detail={`sur ${stocks.length} références (article × taille)`}
          alerte={aCommander.length > 0}
        />
        <Indicateur libelle="Montant estimé" valeur={formatEuros.format(montant)} detail="HT, commande proposée" />
        <Indicateur
          libelle="En rupture"
          valeur={stocks.filter((s) => s.etat === "rupture").length}
          alerte={stocks.some((s) => s.etat === "rupture")}
          detail="références à 0 en stock"
        />
        <Indicateur libelle="Valeur du stock" valeur={formatEuros.format(valeurStock)} detail="HT, au prix d'achat" />
      </div>

      <details className="rounded-sm border border-pierre/70 bg-white p-4 text-sm text-ardoise">
        <summary className="cursor-pointer font-medium text-encre">Comment est calculée la quantité à commander ?</summary>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <p>
            <strong>Stock tampon</strong> : la quantité minimale que vous voulez toujours avoir en réserve pour ne
            jamais manquer. Vous la réglez directement dans le tableau.
          </p>
          <p>
            <strong>Besoin pendant la livraison</strong> : ce qui sera consommé le temps que le fournisseur livre,
            d&apos;après la consommation moyenne des 90 derniers jours et le délai de livraison de l&apos;article.
          </p>
          <p>
            <strong>À commander</strong> = stock tampon + besoin pendant la livraison − stock actuel, arrondi au
            conditionnement du fournisseur (par 10, par 12…). Si le résultat est négatif, rien à commander.
          </p>
        </div>
      </details>

      <div className="flex flex-wrap items-center gap-3">
        <select value={categorie} onChange={(e) => setCategorie(e.target.value)} className={`${classeChamp} max-w-52`}>
          <option value="">Toutes les catégories</option>
          {[...new Set(donnees.articles.map((a) => a.categorie))].map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-ardoise">
          <input
            type="checkbox"
            className="accent-bronze"
            checked={seulementACommander}
            onChange={(e) => setSeulementACommander(e.target.checked)}
          />
          Seulement ce qui est à commander
        </label>
        <button type="button" className={`${classeBouton} ml-auto`} onClick={exporterCommande} disabled={!aCommander.length}>
          Bon de commande (Excel)
        </button>
      </div>

      <div className="overflow-x-auto rounded-sm border border-pierre/70 bg-white">
        <table className="w-full min-w-[56rem] text-sm">
          <thead className="bg-marbre text-left text-xs uppercase tracking-wide text-ardoise">
            <tr>
              <th className="px-3 py-2">Article</th>
              <th className="px-3 py-2">Taille</th>
              <th className="px-3 py-2 text-right">Stock actuel</th>
              <th className="px-3 py-2 text-right" title="Quantité minimale à garder en réserve">Stock tampon ⓘ</th>
              <th className="px-3 py-2 text-right">Conso / mois</th>
              <th className="px-3 py-2 text-right" title="Consommation prévue pendant le délai de livraison">Besoin livraison ⓘ</th>
              <th className="px-3 py-2 text-right">À commander</th>
              <th className="px-3 py-2">État</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {lignes.map((s) => {
              const e = etatsStock[s.etat];
              return (
                <tr key={`${s.article.id}-${s.taille}`} className="border-t border-pierre/60">
                  <td className="px-3 py-2">
                    <p className="font-medium">{s.article.nom}</p>
                    <p className="text-xs text-gris">
                      {s.article.categorie} · livré en {s.article.delai} j · par {s.article.lot}
                    </p>
                  </td>
                  <td className="px-3 py-2">{s.taille}</td>
                  <td className="px-3 py-2 text-right font-medium tabular-nums">{s.actuel}</td>
                  <td className="px-3 py-2 text-right">
                    <input
                      type="number"
                      min={0}
                      value={s.tampon}
                      onChange={(ev) => changerTampon(s.article, s.taille, Number(ev.target.value))}
                      className={`${classeChamp} w-20 text-right tabular-nums`}
                    />
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-ardoise">{formatNombre.format(s.consoMensuelle)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-ardoise">{s.besoinDelai}</td>
                  <td className="px-3 py-2 text-right text-base font-semibold tabular-nums">{s.aCommander || "—"}</td>
                  <td className="px-3 py-2">
                    <Pastille couleur={e.couleur} texte={e.texte} icone={e.icone}>
                      {e.libelle}
                    </Pastille>
                  </td>
                  <td className="px-3 py-2 text-right">
                    {s.aCommander > 0 && (
                      <button
                        type="button"
                        className="whitespace-nowrap text-xs text-bronze underline"
                        title="Enregistre la réception de la quantité proposée"
                        onClick={() =>
                          ajouterMouvement({
                            date: aujourdhui, type: "entree", articleId: s.article.id, taille: s.taille,
                            quantite: s.aCommander, salarieId: "", service: "", motif: "Commande fournisseur",
                          })
                        }
                      >
                        Marquer reçu
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------- Saisie façon formulaire Power Apps ----------

function Saisie({ donnees }: { donnees: Donnees }) {
  const [type, setType] = useState<Mouvement["type"]>("sortie");
  const [salarieId, setSalarieId] = useState("");
  const [articleId, setArticleId] = useState(donnees.articles[0]?.id ?? "");
  const [taille, setTaille] = useState("");
  const [quantite, setQuantite] = useState(1);
  const [date, setDate] = useState(dateDuJour());
  const [motif, setMotif] = useState("Dotation");
  const [confirmation, setConfirmation] = useState("");
  const [signature, setSignature] = useState<string | null>(null);
  const [pave, setPave] = useState(0); // change la clé du pavé pour l'effacer après chaque remise

  const article = donnees.articles.find((a) => a.id === articleId);
  const salarie = donnees.salaries.find((s) => s.id === salarieId);
  // Taille proposée : celle du salarié pour cette catégorie d'EPI, sinon la première.
  const tailleProposee =
    article && salarie && article.tailles.includes(salarie.tailles[article.categorie] ?? "")
      ? salarie.tailles[article.categorie]
      : article?.tailles[0] ?? "";
  const tailleChoisie = article?.tailles.includes(taille) ? taille : tailleProposee;

  const motifs =
    type === "sortie"
      ? ["Dotation", "Remplacement usure", "Perte", "Nouvel arrivant"]
      : ["Commande fournisseur", "Inventaire", "Retour salarié"];

  const valider = (e: React.FormEvent) => {
    e.preventDefault();
    if (!article || quantite <= 0 || (type === "sortie" && !salarie)) return;
    ajouterMouvement({
      date, type, articleId: article.id, taille: tailleChoisie, quantite,
      salarieId: type === "sortie" ? salarie!.id : "", service: type === "sortie" ? salarie!.service : "",
      motif,
    }, type === "sortie" && signature ? signature : undefined);
    setConfirmation(
      `${type === "sortie" ? "Sortie" : "Entrée"} enregistrée : ${quantite} × ${article.nom} (${tailleChoisie})${
        type === "sortie" ? ` pour ${salarie!.nom}${signature ? ", signée" : ""}` : ""
      }.`,
    );
    setQuantite(1);
    setSignature(null);
    setPave((n) => n + 1);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,36rem)_1fr]">
      <Carte>
        <form onSubmit={valider} className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {(["sortie", "entree"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setType(t);
                  setMotif(t === "sortie" ? "Dotation" : "Commande fournisseur");
                }}
                className={`rounded-sm border px-3 py-3 text-sm ${
                  type === t ? "border-bronze bg-bronze/10 font-medium" : "border-pierre text-ardoise"
                }`}
              >
                {t === "sortie" ? "↗ Sortie (remise à un salarié)" : "↙ Entrée (réception)"}
              </button>
            ))}
          </div>

          {type === "sortie" && (
            <label className="block text-sm">
              Salarié
              <select required value={salarieId} onChange={(e) => setSalarieId(e.target.value)} className={`${classeChamp} mt-1`}>
                <option value="">Choisir un salarié…</option>
                {donnees.salaries.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nom} — {s.service}
                  </option>
                ))}
              </select>
              {salarie && <span className="mt-1 block text-xs text-gris">Service : {salarie.service} · {salarie.poste}</span>}
            </label>
          )}

          <label className="block text-sm">
            Article
            <select value={articleId} onChange={(e) => { setArticleId(e.target.value); setTaille(""); }} className={`${classeChamp} mt-1`}>
              {donnees.articles.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nom}
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-3 gap-3">
            <label className="block text-sm">
              Taille
              <select value={tailleChoisie} onChange={(e) => setTaille(e.target.value)} className={`${classeChamp} mt-1`}>
                {article?.tailles.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              Quantité
              <input type="number" min={1} value={quantite} onChange={(e) => setQuantite(Number(e.target.value))} className={`${classeChamp} mt-1`} />
            </label>
            <label className="block text-sm">
              Date
              <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className={`${classeChamp} mt-1`} />
            </label>
          </div>

          <label className="block text-sm">
            Motif
            <select value={motif} onChange={(e) => setMotif(e.target.value)} className={`${classeChamp} mt-1`}>
              {motifs.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </label>

          {type === "sortie" && salarie && (
            <div className="text-sm">
              <p>Signature de {salarie.nom} <span className="text-gris">(facultatif, peut être faite plus tard)</span></p>
              <p className="mb-2 text-xs text-gris">
                En signant, le salarié reconnaît avoir reçu cet équipement et avoir été informé de ses conditions d&apos;utilisation.
              </p>
              <PaveSignature key={pave} onChange={setSignature} />
            </div>
          )}

          <button type="submit" className={`${classeBouton} w-full justify-center py-3`}>
            {type === "sortie" && signature ? "Enregistrer la remise signée" : "Enregistrer"}
          </button>
          {confirmation && <p className="text-sm text-[#006300]">✓ {confirmation}</p>}
        </form>
      </Carte>

      {salarie && (
        <Carte titre={`Équipements remis à ${salarie.nom}`}>
          <HistoriqueSalarie donnees={donnees} salarieId={salarie.id} />
        </Carte>
      )}
    </div>
  );
}

function HistoriqueSalarie({ donnees, salarieId }: { donnees: Donnees; salarieId: string }) {
  const sorties = donnees.mouvements.filter((m) => m.salarieId === salarieId).slice(0, 15);
  if (!sorties.length) return <p className="text-sm text-gris">Aucun équipement remis pour l&apos;instant.</p>;
  return (
    <ul className="divide-y divide-pierre/60 text-sm">
      {sorties.map((m) => (
        <li key={m.id} className="flex justify-between gap-3 py-2">
          <span>
            {m.quantite} × {donnees.articles.find((a) => a.id === m.articleId)?.nom ?? "Article supprimé"} ({m.taille})
          </span>
          <span className="text-gris">
            {formaterDate(m.date)} · {m.motif} · {m.signatureId ? <span className="text-[#006300]">✓ signée</span> : "non signée"}
          </span>
        </li>
      ))}
    </ul>
  );
}

// ---------- Historique ----------

function Historique({ donnees }: { donnees: Donnees }) {
  const [filtre, setFiltre] = useState("");
  const terme = filtre.toLowerCase();
  const nomArticle = (id: string) => donnees.articles.find((a) => a.id === id)?.nom ?? "Article supprimé";
  const nomSalarie = (id: string) => donnees.salaries.find((s) => s.id === id)?.nom ?? "";
  const mouvements = [...donnees.mouvements]
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .filter((m) =>
      !terme || [nomArticle(m.articleId), nomSalarie(m.salarieId), m.service, m.motif, m.taille].join(" ").toLowerCase().includes(terme),
    );

  const supprimer = (m: Mouvement) => {
    if (confirm("Supprimer ce mouvement ? Le stock sera recalculé.")) {
      modifier((d) => ({ ...d, mouvements: d.mouvements.filter((x) => x.id !== m.id) }));
    }
  };

  return (
    <div className="space-y-3">
      <input type="search" placeholder="Rechercher un salarié, un article, un service…" value={filtre} onChange={(e) => setFiltre(e.target.value)} className={`${classeChamp} max-w-md`} />
      <div className="overflow-x-auto rounded-sm border border-pierre/70 bg-white">
        <table className="w-full min-w-[48rem] text-sm">
          <thead className="bg-marbre text-left text-xs uppercase tracking-wide text-ardoise">
            <tr>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Article</th>
              <th className="px-3 py-2">Taille</th>
              <th className="px-3 py-2 text-right">Qté</th>
              <th className="px-3 py-2">Salarié</th>
              <th className="px-3 py-2">Service</th>
              <th className="px-3 py-2">Motif</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {mouvements.slice(0, 300).map((m) => (
              <tr key={m.id} className="border-t border-pierre/60">
                <td className="px-3 py-1.5 whitespace-nowrap">{formaterDate(m.date)}</td>
                <td className="px-3 py-1.5">{m.type === "sortie" ? "↗ Sortie" : "↙ Entrée"}</td>
                <td className="px-3 py-1.5">{nomArticle(m.articleId)}</td>
                <td className="px-3 py-1.5">{m.taille}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{m.quantite}</td>
                <td className="px-3 py-1.5">{nomSalarie(m.salarieId)}</td>
                <td className="px-3 py-1.5">{m.service}</td>
                <td className="px-3 py-1.5 text-ardoise">{m.motif}</td>
                <td className="px-3 py-1.5 text-right">
                  <button type="button" onClick={() => supprimer(m)} title="Supprimer" className="text-gris hover:text-[#b42318]">
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {mouvements.length > 300 && <p className="text-xs text-gris">300 derniers mouvements affichés sur {mouvements.length}.</p>}
    </div>
  );
}

// ---------- Catalogue ----------

function Catalogue({ donnees }: { donnees: Donnees }) {
  const maj = (id: string, champs: Partial<Article>) =>
    modifier((d) => ({ ...d, articles: d.articles.map((a) => (a.id === id ? { ...a, ...champs } : a)) }));

  const ajouter = () =>
    modifier((d) => ({
      ...d,
      articles: [
        ...d.articles,
        { id: nouvelId(), nom: "Nouvel article", categorie: categoriesEpi[0], tailles: ["Unique"], prix: 0, delai: 7, lot: 1, tampons: { Unique: 0 } },
      ],
    }));

  const supprimer = (a: Article) => {
    if (confirm(`Supprimer « ${a.nom} » du catalogue ? Son historique sera conservé.`)) {
      modifier((d) => ({ ...d, articles: d.articles.filter((x) => x.id !== a.id) }));
    }
  };

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-sm border border-pierre/70 bg-white">
        <table className="w-full min-w-[56rem] text-sm">
          <thead className="bg-marbre text-left text-xs uppercase tracking-wide text-ardoise">
            <tr>
              <th className="px-3 py-2">Article</th>
              <th className="px-3 py-2">Catégorie</th>
              <th className="px-3 py-2">Tailles (séparées par des virgules)</th>
              <th className="px-3 py-2">Prix HT</th>
              <th className="px-3 py-2">Délai (j)</th>
              <th className="px-3 py-2">Conditionnement</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {donnees.articles.map((a) => (
              <tr key={a.id} className="border-t border-pierre/60">
                <td className="px-2 py-1.5"><input value={a.nom} onChange={(e) => maj(a.id, { nom: e.target.value })} className={classeChamp} /></td>
                <td className="px-2 py-1.5">
                  <select value={a.categorie} onChange={(e) => maj(a.id, { categorie: e.target.value })} className={classeChamp}>
                    {categoriesEpi.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </td>
                <td className="px-2 py-1.5">
                  <ChampTailles article={a} onChange={(tailles) => maj(a.id, { tailles })} />
                </td>
                <td className="px-2 py-1.5"><input type="number" min={0} step="0.01" value={a.prix} onChange={(e) => maj(a.id, { prix: Number(e.target.value) })} className={`${classeChamp} w-24`} /></td>
                <td className="px-2 py-1.5"><input type="number" min={0} value={a.delai} onChange={(e) => maj(a.id, { delai: Number(e.target.value) })} className={`${classeChamp} w-20`} /></td>
                <td className="px-2 py-1.5"><input type="number" min={1} value={a.lot} onChange={(e) => maj(a.id, { lot: Number(e.target.value) })} className={`${classeChamp} w-20`} /></td>
                <td className="px-2 py-1.5 text-right">
                  <button type="button" onClick={() => supprimer(a)} title="Supprimer" className="text-gris hover:text-[#b42318]">✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button type="button" className={classeBoutonSecondaire} onClick={ajouter}>
        + Ajouter un article
      </button>
    </div>
  );
}

// Saisie libre, appliquée à la sortie du champ pour ne pas gêner la frappe des virgules.
function ChampTailles({ article, onChange }: { article: Article; onChange: (tailles: string[]) => void }) {
  const [texte, setTexte] = useState(article.tailles.join(", "));
  return (
    <input
      value={texte}
      onChange={(e) => setTexte(e.target.value)}
      onBlur={() => {
        const tailles = [...new Set(texte.split(",").map((t) => t.trim()).filter(Boolean))];
        onChange(tailles.length ? tailles : ["Unique"]);
        setTexte((tailles.length ? tailles : ["Unique"]).join(", "));
      }}
      className={classeChamp}
    />
  );
}
