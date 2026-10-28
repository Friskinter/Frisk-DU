import { grilleMaitrise, niveauxCriticite } from "./referentiel";
import type { Article, Donnees, LigneDuerp, Mouvement } from "./types";

export function nouvelId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function dateDuJour() {
  return versIso(new Date());
}

export function versIso(date: Date) {
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const j = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${m}-${j}`;
}

export function decalerJours(iso: string, jours: number) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + jours);
  return versIso(d);
}

export function formaterDate(iso: string) {
  if (!iso) return "";
  const [a, m, j] = iso.split("-");
  return `${j}/${m}/${a}`;
}

export const formatEuros = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

export const formatNombre = new Intl.NumberFormat("fr-FR", {
  maximumFractionDigits: 1,
});

// ---------- DUERP ----------

export function criticiteBrute(ligne: LigneDuerp) {
  return ligne.gravite * ligne.frequence;
}

export function coefficientMaitrise(ligne: LigneDuerp) {
  return grilleMaitrise.find((g) => g.valeur === ligne.maitrise)?.coefficient ?? 1;
}

export function risqueResiduel(ligne: LigneDuerp) {
  return criticiteBrute(ligne) * coefficientMaitrise(ligne);
}

export function niveauDe(score: number) {
  return [...niveauxCriticite].reverse().find((n) => score >= n.min)!;
}


// ---------- Stocks EPI ----------

export function cle(articleId: string, taille: string) {
  return `${articleId}|${taille}`;
}

export function stocksActuels(mouvements: Mouvement[]) {
  const stocks = new Map<string, number>();
  for (const m of mouvements) {
    const k = cle(m.articleId, m.taille);
    const signe = m.type === "entree" ? 1 : -1;
    stocks.set(k, (stocks.get(k) ?? 0) + signe * m.quantite);
  }
  return stocks;
}

export type LigneStock = {
  article: Article;
  taille: string;
  actuel: number;
  tampon: number;
  consoMensuelle: number;
  besoinDelai: number;
  aCommander: number;
  etat: "rupture" | "sous-tampon" | "a-surveiller" | "ok";
};

const JOURS_REFERENCE = 90;

// Quantité à commander = stock tampon + consommation prévue pendant la livraison − stock actuel,
// arrondie au conditionnement du fournisseur.
export function calculerStocks(donnees: Donnees, aujourdhui: string): LigneStock[] {
  const actuels = stocksActuels(donnees.mouvements);
  const debut = decalerJours(aujourdhui, -JOURS_REFERENCE);
  const sorties = new Map<string, number>();
  for (const m of donnees.mouvements) {
    if (m.type === "sortie" && m.date > debut && m.date <= aujourdhui) {
      const k = cle(m.articleId, m.taille);
      sorties.set(k, (sorties.get(k) ?? 0) + m.quantite);
    }
  }

  return donnees.articles.flatMap((article) =>
    article.tailles.map((taille) => {
      const k = cle(article.id, taille);
      const actuel = actuels.get(k) ?? 0;
      const tampon = article.tampons[taille] ?? 0;
      const consoJour = (sorties.get(k) ?? 0) / JOURS_REFERENCE;
      const besoinDelai = Math.ceil(consoJour * article.delai);
      const brut = Math.max(0, tampon + besoinDelai - actuel);
      const lot = Math.max(1, article.lot);
      const aCommander = brut === 0 ? 0 : Math.ceil(brut / lot) * lot;
      const etat: LigneStock["etat"] =
        actuel <= 0
          ? "rupture"
          : actuel < tampon
            ? "sous-tampon"
            : actuel < tampon + besoinDelai
              ? "a-surveiller"
              : "ok";
      return {
        article,
        taille,
        actuel,
        tampon,
        consoMensuelle: consoJour * 30,
        besoinDelai,
        aCommander,
        etat,
      };
    }),
  );
}

export const etatsStock: Record<
  LigneStock["etat"],
  { libelle: string; couleur: string; texte: string; icone: string }
> = {
  rupture: { libelle: "Rupture", couleur: "#d03b3b", texte: "#ffffff", icone: "✕" },
  "sous-tampon": { libelle: "Sous le tampon", couleur: "#ec835a", texte: "#0b0b0b", icone: "!" },
  "a-surveiller": { libelle: "À surveiller", couleur: "#fab219", texte: "#0b0b0b", icone: "~" },
  ok: { libelle: "Suffisant", couleur: "#0ca30c", texte: "#ffffff", icone: "✓" },
};

// ---------- Export ----------

export function telechargerCsv(nom: string, lignes: (string | number)[][]) {
  const contenu = lignes
    .map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))
    .join("\r\n");
  // BOM pour qu'Excel lise correctement les accents
  telecharger(nom, "﻿" + contenu, "text/csv;charset=utf-8");
}

export function telecharger(nom: string, contenu: string, type: string) {
  const url = URL.createObjectURL(new Blob([contenu], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nom;
  a.click();
  URL.revokeObjectURL(url);
}
