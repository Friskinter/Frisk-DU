// Assistant de démarrage : les étapes pour mettre en place Frisk Plateforme dans une nouvelle entreprise.
// Chaque étape se coche d'elle-même d'après les données ; aucune saisie supplémentaire.

import { risqueResiduel } from "./calculs";
import type { Donnees } from "./types";

export type Etape = {
  code: string;
  titre: string;
  aide: string;
  lien: string;
  bouton: string;
  faite: boolean;
};

export const RISQUES_MINIMUM = 3;

// `versions` et `lienActif` viennent de la base : undefined tant qu'ils ne sont pas connus (l'étape
// est alors laissée de côté plutôt que présentée à tort comme à faire).
export function etapesDemarrage(d: Donnees, contexte: { versions?: number; lienActif?: boolean } = {}): Etape[] {
  const prioritaires = d.duerp.filter((l) => risqueResiduel(l) >= 8);
  const etapes: (Etape | null)[] = [
    {
      code: "fiche",
      titre: "Compléter la fiche de l'entreprise",
      aide: "Adresse, effectif et responsable figurent sur la page de garde du document unique ; l'effectif sert aussi au taux de fréquence.",
      lien: "/reglages",
      bouton: "Remplir la fiche",
      faite: !!(d.fiche?.adresse?.trim() && d.fiche?.effectif?.trim() && d.fiche?.responsable?.trim()),
    },
    {
      code: "unites",
      titre: "Définir les unités de travail",
      aide: "Les lieux, services ou métiers qui regroupent des salariés exposés aux mêmes risques : quai, atelier, bureaux, tournées…",
      lien: "/reglages",
      bouton: "Ajouter les unités",
      faite: d.unites.length > 0,
    },
    {
      code: "salaries",
      titre: "Enregistrer les salariés",
      aide: "Un par un, ou d'un coup depuis un fichier Excel. Ils servent aux EPI, aux formations, aux accueils et aux causeries.",
      lien: "/import?type=salaries",
      bouton: "Importer les salariés",
      faite: d.salaries.length > 0,
    },
    {
      code: "risques",
      titre: "Évaluer les premiers risques",
      aide: "Le DUERP express préremplit votre document unique et votre plan d'actions d'après votre métier, en quelques minutes. Vous pouvez aussi importer votre ancien document unique depuis Excel.",
      lien: "/duerp-express",
      bouton: "DUERP express",
      faite: d.duerp.length >= RISQUES_MINIMUM,
    },
    {
      code: "actions",
      titre: "Prévoir une action pour chaque risque prioritaire",
      aide: "Chaque risque important ou critique doit avoir au moins une action de prévention, avec un responsable et une échéance.",
      lien: "/actions",
      bouton: "Ouvrir le plan d'actions",
      faite: d.duerp.length >= RISQUES_MINIMUM && prioritaires.every((l) => d.actions.some((a) => a.risqueId === l.id)),
    },
    contexte.versions === undefined
      ? null
      : {
          code: "version",
          titre: "Figer la première version du document unique",
          aide: "Depuis le bouton « Versions » du DUERP. La version datée fait foi : elle est conservée 40 ans et tenue à disposition des salariés et de l'inspection du travail.",
          lien: "/duerp",
          bouton: "Figer une version",
          faite: contexte.versions > 0,
        },
    contexte.lienActif === undefined
      ? null
      : {
          code: "signalement",
          titre: "Activer le signalement par QR code",
          aide: "Imprimez l'affiche : vos salariés signalent accidents et situations dangereuses depuis leur téléphone, sans compte.",
          lien: "/accidents?signalement=1",
          bouton: "Activer le QR code",
          faite: contexte.lienActif,
        },
  ];
  return etapes.filter((e): e is Etape => e !== null);
}

// Pour aller plus loin, une fois les bases en place : ce qui n'a pas encore été commencé.
export function suggestionsDemarrage(d: Donnees) {
  return [
    { code: "exigences", titre: "Formations exigées par poste", lien: "/formations", faite: d.exigences.length > 0 },
    { code: "equipements", titre: "Équipements à vérifier (extincteurs, électricité…)", lien: "/verifications", faite: d.equipements.length > 0 },
    { code: "produits", titre: "Inventaire des produits chimiques", lien: "/produits", faite: d.produits.length > 0 },
    { code: "articles", titre: "Catalogue des EPI", lien: "/epi", faite: d.articles.length > 0 },
  ].filter((s) => !s.faite);
}
