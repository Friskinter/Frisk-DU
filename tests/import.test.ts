import { describe, expect, it } from "vitest";
import {
  construireDuerp,
  construireSalaries,
  convertirDate,
  convertirFrequence,
  convertirGravite,
  convertirMaitrise,
  convertirPenibilite,
  devinerCorrespondance,
  devinerEchelle,
  lireCsv,
  trouverEntete,
  type Tableau,
} from "@/lib/import";

const options = { echelleGravite: 4, echelleFrequence: 4, recopierUnites: true } as const;

describe("lecture CSV", () => {
  it("point-virgule, guillemets, retours à la ligne, BOM", () => {
    const csv = '﻿Unité;Risque;Mesures\r\nAtelier;"Coupure; plaie";"Gants ""anti-coupure""\nformation"\r\nBureau;Écran;';
    expect(lireCsv(csv)).toEqual([
      ["Unité", "Risque", "Mesures"],
      ["Atelier", "Coupure; plaie", 'Gants "anti-coupure"\nformation'],
      ["Bureau", "Écran", ""],
    ]);
  });

  it("virgule ou tabulation", () => {
    expect(lireCsv("a,b\n1,2")).toEqual([["a", "b"], ["1", "2"]]);
    expect(lireCsv("a\tb\n1\t2\n")).toEqual([["a", "b"], ["1", "2"]]);
  });
});

describe("reconnaissance des colonnes", () => {
  const tableau: Tableau = [
    ["DOCUMENT UNIQUE - SOCIÉTÉ X", null, null],
    ["Mis à jour le 01/01/2025"],
    ["Unité de travail", "Tâche", "Famille de risque", "Dommages", "Nb salariés", "G", "F", "Criticité", "Mesures de prévention existantes", "Mesures à mettre en place", "Pilote", "Délai", "Risque résiduel"],
  ];

  it("trouve la ligne d'en-tête sous un titre", () => {
    expect(trouverEntete(tableau, "duerp")).toBe(2);
  });

  it("associe chaque colonne au bon champ et ignore les colonnes calculées", () => {
    const c = devinerCorrespondance(tableau[2], "duerp");
    expect(Object.values(c)).toEqual([
      "unite", "activite", "danger", "risque", "effectif", "gravite", "frequence", "", "mesures", "action", "responsable", "echeance", "",
    ]);
  });

  it("salariés : nom et prénom séparés, poste, tailles", () => {
    const c = devinerCorrespondance(["NOM", "Prénom", "Fonction", "Service", "Pointure", "Taille gants"], "salaries");
    expect(Object.values(c)).toEqual(["nom", "prenom", "poste", "service", "pieds", "mains"]);
  });
});

describe("conversion des valeurs", () => {
  it("cotations sur d'autres échelles, en chiffres ou en mots", () => {
    expect(convertirGravite(3, 4)).toBe(3);
    expect(convertirGravite("G4", 4)).toBe(4);
    expect(convertirGravite("2 - Moyenne", 4)).toBe(2);
    expect([1, 2, 3].map((v) => convertirGravite(v, 3))).toEqual([1, 3, 4]);
    expect([1, 2, 3, 4, 5].map((v) => convertirGravite(v, 5))).toEqual([1, 2, 3, 3, 4]);
    expect([1, 5, 10].map((v) => convertirFrequence(v, 10))).toEqual([1, 2, 4]);
    expect(convertirGravite("Très grave", 4)).toBe(4);
    expect(convertirGravite("grave", 4)).toBe(3);
    expect(convertirFrequence("Occasionnelle", 4)).toBe(2);
    expect(convertirFrequence("quotidienne", 4)).toBe(4);
    expect(convertirGravite("?", 4)).toBeNull();
    expect(convertirGravite("", 4)).toBeNull();
  });

  it("échelle devinée d'après la plus grande valeur", () => {
    expect(devinerEchelle([1, 2, "3"])).toBe(4);
    expect(devinerEchelle([1, 5])).toBe(5);
    expect(devinerEchelle(["8", 2])).toBe(10);
    expect(devinerEchelle(["faible"])).toBe(4);
  });

  it("maîtrise, pénibilité, dates", () => {
    expect(convertirMaitrise("Très bonne")).toBe("tres-bonne");
    expect(convertirMaitrise("À améliorer")).toBe("partielle");
    expect(convertirMaitrise("Aucune")).toBe("insuffisante");
    expect(convertirMaitrise("x")).toBeNull();
    expect(convertirPenibilite("Manutention manuelle de charges")).toBe("manutention");
    expect(convertirPenibilite("Bruit")).toBe("bruit");
    expect(convertirPenibilite("Non")).toBe("");
    expect(convertirDate("31/12/2026")).toBe("2026-12-31");
    expect(convertirDate("5/3/26")).toBe("2026-03-05");
    expect(convertirDate("06/2027")).toBe("2027-06-01");
    expect(convertirDate(new Date(Date.UTC(2026, 11, 31)))).toBe("2026-12-31");
    expect(convertirDate("fin d'année")).toBe("");
  });
});

describe("construction des lignes", () => {
  const tableau: Tableau = [
    ["Unité", "Activité", "Danger", "Risque", "Gravité", "Fréquence", "Mesures", "Actions", "Responsable", "Échéance"],
    ["Quai", "Déchargement", "Manutention", "Lombalgie", 3, 4, "Transpalettes", "Acheter un transpalette électrique", "Direction", "31/12/2026"],
    [null, null, "Chute de hauteur", "Fracture", "4", "?", "", "", "", ""],
    ["", "", "", "", "", "", "", "", "", ""],
    ["Bureaux", null, null, null, null, null, null, null, null, null],
    [null, "Écran", "Travail sur écran", "TMS", "faible", "fréquente", "Écrans réglables", "", "", "bientôt"],
    ["Unité", "Activité", "Danger", "Risque", "Gravité", "Fréquence", "Mesures", "Actions", "Responsable", "Échéance"],
  ];
  const lignes = construireDuerp(tableau, 0, devinerCorrespondance(tableau[0], "duerp"), options);

  it("une ligne par risque, cellules fusionnées recopiées, intertitres d'unité reconnus", () => {
    expect(lignes.map((l) => [l.numero, l.ligne.unite, l.ligne.activite, l.ligne.danger])).toEqual([
      [2, "Quai", "Déchargement", "Manutention"],
      [3, "Quai", "Déchargement", "Chute de hauteur"],
      [6, "Bureaux", "Écran", "Travail sur écran"],
    ]);
  });

  it("cotations, maîtrise et actions", () => {
    expect(lignes[0].ligne).toMatchObject({ gravite: 3, frequence: 4, maitrise: "partielle", mesures: "Transpalettes" });
    expect(lignes[0].action).toMatchObject({ risqueId: lignes[0].ligne.id, intitule: "Acheter un transpalette électrique", responsable: "Direction", echeance: "2026-12-31" });
    expect(lignes[1].ligne).toMatchObject({ gravite: 4, frequence: 1, maitrise: "insuffisante" });
    expect(lignes[1].action).toBeNull();
    expect(lignes[1].avertissements).toEqual(["fréquence « ? » non reconnue : 1 par défaut"]);
    expect(lignes[2].ligne).toMatchObject({ gravite: 1, frequence: 3 });
    expect(lignes[2].avertissements).toEqual(["échéance « bientôt » non reconnue"]);
  });

  it("sans recopie, l'unité manquante est signalée", () => {
    const sans = construireDuerp(tableau, 0, devinerCorrespondance(tableau[0], "duerp"), { ...options, recopierUnites: false });
    expect(sans[1].ligne.unite).toBe("");
    expect(sans[1].avertissements).toContain("unité de travail absente");
  });

  it("colonnes de cotation absentes : à coter", () => {
    const t: Tableau = [["Unité", "Risque"], ["Atelier", "Coupure"]];
    const [l] = construireDuerp(t, 0, devinerCorrespondance(t[0], "duerp"), options);
    expect(l.avertissements).toEqual(["gravité à coter", "fréquence à coter"]);
  });

  it("salariés", () => {
    const t: Tableau = [["Nom", "Prénom", "Poste", "Pointure"], ["Martin", "Léa", "Cariste", 39], ["", "", "", ""], ["Durand", "", "", ""]];
    const s = construireSalaries(t, 0, devinerCorrespondance(t[0], "salaries"));
    expect(s.map((x) => [x.salarie.nom, x.salarie.poste, x.salarie.tailles, x.avertissements])).toEqual([
      ["Martin Léa", "Cariste", { Pieds: "39" }, []],
      ["Durand", "", {}, ["poste absent"]],
    ]);
  });
});

describe("fichier Excel réel", () => {
  it("lit le classeur, choisit la feuille du DUERP et importe les lignes", async () => {
    const { readFileSync } = await import("node:fs");
    const { default: lireClasseur } = await import("read-excel-file/universal");
    const contenu = readFileSync(`${process.cwd()}/tests/fichiers/duerp-exemple.xlsx`);
    const feuilles = await lireClasseur(contenu.buffer.slice(contenu.byteOffset, contenu.byteOffset + contenu.byteLength));
    expect(feuilles.map((f) => f.sheet)).toEqual(["Lisez-moi", "DUERP 2025"]);
    const tableau = feuilles[1].data as Tableau;
    const entete = trouverEntete(tableau, "duerp");
    const correspondance = devinerCorrespondance(tableau[entete], "duerp");
    const echelle = devinerEchelle(tableau.slice(entete + 1).map((l) => l[5]));
    expect(echelle).toBe(5);
    const lignes = construireDuerp(tableau, entete, correspondance, { echelleGravite: echelle, echelleFrequence: 5, recopierUnites: true });
    expect(lignes.map((l) => [l.ligne.unite, l.ligne.danger, l.ligne.gravite, l.ligne.frequence])).toEqual([
      ["Atelier", "Machines", 4, 3],
      ["Atelier", "Bruit", 3, 4],
      ["Atelier", "Poussières de bois", 4, 3],
      ["Bureau", "Écran", 1, 3],
    ]);
    expect(lignes[0].action?.echeance).toBe("2026-06-30");
    expect(lignes[1].action?.echeance).toBe("2026-03-31");
  });
});
