import { describe, expect, it } from "vitest";
import {
  calculerStocks, criticiteBrute, decalerJours, niveauDe, risqueResiduel, stocksActuels,
} from "@/lib/calculs";
import { article, donnees, ligne, mouvement } from "./aides";

describe("cotation des risques", () => {
  it("criticité brute = gravité × fréquence", () => {
    expect(criticiteBrute(ligne({ gravite: 3, frequence: 4 }))).toBe(12);
  });

  it("le risque résiduel applique le coefficient de maîtrise", () => {
    expect(risqueResiduel(ligne({ gravite: 4, frequence: 4, maitrise: "insuffisante" }))).toBe(16);
    expect(risqueResiduel(ligne({ gravite: 4, frequence: 4, maitrise: "partielle" }))).toBe(12);
    expect(risqueResiduel(ligne({ gravite: 4, frequence: 4, maitrise: "bonne" }))).toBe(8);
    expect(risqueResiduel(ligne({ gravite: 4, frequence: 4, maitrise: "tres-bonne" }))).toBe(4);
  });

  it("classe les scores dans les bons niveaux, bornes comprises", () => {
    expect(niveauDe(1).code).toBe("faible");
    expect(niveauDe(3.9).code).toBe("faible");
    expect(niveauDe(4).code).toBe("modere");
    expect(niveauDe(8).code).toBe("important");
    expect(niveauDe(11.9).code).toBe("important");
    expect(niveauDe(12).code).toBe("critique");
    expect(niveauDe(16).code).toBe("critique");
  });
});

describe("dates", () => {
  it("décale les jours en franchissant les mois et les années", () => {
    expect(decalerJours("2026-12-30", 3)).toBe("2027-01-02");
    expect(decalerJours("2026-03-01", -1)).toBe("2026-02-28");
  });
});

describe("stocks d'EPI", () => {
  const aujourdhui = "2026-10-28";

  it("stock actuel = entrées − sorties, par article et par taille", () => {
    const a = article();
    const stocks = stocksActuels([
      mouvement({ articleId: a.id, type: "entree", quantite: 20 }),
      mouvement({ articleId: a.id, type: "sortie", quantite: 7 }),
      mouvement({ articleId: a.id, taille: "10", type: "entree", quantite: 5 }),
    ]);
    expect(stocks.get(`${a.id}|9`)).toBe(13);
    expect(stocks.get(`${a.id}|10`)).toBe(5);
  });

  it("à commander = tampon + besoin pendant la livraison − stock, arrondi au lot", () => {
    // 90 sorties sur 90 jours = 1 par jour ; livraison en 10 jours → besoin de 10.
    const a = article({ delai: 10, lot: 12, tampons: { "9": 10 } });
    const mouvements = [
      mouvement({ articleId: a.id, type: "entree", quantite: 100, date: "2026-07-01" }),
      ...Array.from({ length: 90 }, (_, i) =>
        mouvement({ articleId: a.id, type: "sortie", quantite: 1, date: decalerJours(aujourdhui, -i) }),
      ),
    ];
    const [s] = calculerStocks(donnees({ articles: [a], mouvements }), aujourdhui);
    expect(s.actuel).toBe(10);
    expect(s.besoinDelai).toBe(10);
    // 10 + 10 − 10 = 10, arrondi au lot de 12
    expect(s.aCommander).toBe(12);
    expect(s.etat).toBe("a-surveiller");
  });

  it("rien à commander quand le stock couvre le tampon et la livraison", () => {
    const a = article({ tampons: { "9": 5 } });
    const [s] = calculerStocks(
      donnees({ articles: [a], mouvements: [mouvement({ articleId: a.id, quantite: 50 })] }),
      aujourdhui,
    );
    expect(s.aCommander).toBe(0);
    expect(s.etat).toBe("ok");
  });

  it("signale une rupture quand le stock est à zéro", () => {
    const a = article();
    const [s] = calculerStocks(donnees({ articles: [a] }), aujourdhui);
    expect(s.etat).toBe("rupture");
    expect(s.aCommander).toBe(10);
  });
});
