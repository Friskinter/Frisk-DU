// Visites et audits terrain : grilles de contrôle (bibliothèque Frisk ou grilles de l'entreprise),
// visites remplies sur place, non-conformités transformées en actions du plan.

import { decalerJours, nouvelId } from "./calculs";
import type { Action, GrilleAudit, ReponseVisite, ResultatPoint, Visite } from "./types";

// Grille de la bibliothèque : thèmes et questions ; les identifiants des points sont stables.
function modele(id: string, nom: string, description: string, themes: Record<string, string[]>): GrilleAudit {
  return {
    id: `modele-${id}`,
    nom,
    description,
    points: Object.entries(themes).flatMap(([theme, questions]) => questions.map((question, n) => ({ id: `${id}-${theme.slice(0, 3).toLowerCase()}-${n + 1}`, theme, question }))),
  };
}

export const grillesModeles: GrilleAudit[] = [
  modele("generale", "Visite sécurité générale", "Tour de l'atelier ou de l'entrepôt : les points de base à vérifier chaque mois.", {
    Circulation: [
      "Les allées de circulation sont dégagées et leur marquage au sol est visible",
      "Le sol est en bon état, sans trou, sans produit répandu ni zone glissante",
      "L'éclairage est suffisant et toutes les lampes fonctionnent",
    ],
    Stockage: [
      "Les charges sont stables et rangées à leur place",
      "Rien n'est stocké devant les issues, les extincteurs ou les armoires électriques",
    ],
    Machines: [
      "Les protecteurs des machines sont en place et non neutralisés",
      "Les arrêts d'urgence sont accessibles et signalés",
    ],
    Incendie: [
      "Les extincteurs sont accessibles, signalés et vérifiés depuis moins d'un an",
      "Les issues de secours sont dégagées et s'ouvrent facilement",
    ],
    "EPI et hygiène": [
      "Les EPI obligatoires sont portés aux postes concernés",
      "La trousse de premiers secours est complète et les numéros d'urgence sont affichés",
    ],
    "Produits chimiques": [
      "Les produits sont étiquetés et rangés dans un local ou une armoire adaptés",
      "Aucun produit n'est transvasé dans un contenant alimentaire",
    ],
    Électricité: ["Les armoires électriques sont fermées et les câbles et prises en bon état"],
  }),
  modele("entrepot", "Entrepôt et quais", "Circulation des chariots, stockage en hauteur et opérations de quai.", {
    Quais: [
      "Les camions sont calés pendant le chargement et le déchargement",
      "Les niveleurs et les portes de quai fonctionnent et les bords de quai sont protégés",
      "Les consignes aux chauffeurs sont affichées et respectées (zone d'attente, EPI)",
    ],
    Chariots: [
      "Les caristes ont une autorisation de conduite et un CACES à jour",
      "La vérification de prise de poste des chariots est faite",
      "Les conducteurs portent la ceinture ou utilisent le dispositif de retenue",
      "Aucun chariot n'est laissé avec la fourche levée ou la clé sur le contact",
    ],
    Racks: [
      "Les charges maximales sont affichées sur les racks",
      "Les montants et les lisses ne sont ni pliés ni déformés ; les sabots de protection sont en place",
      "Les palettes stockées sont en bon état et ne débordent pas",
    ],
    Piétons: [
      "Les allées piétonnes sont marquées et respectées",
      "Les piétons portent un gilet haute visibilité dans les zones de circulation des engins",
    ],
  }),
  modele("incendie", "Incendie et évacuation", "Moyens de secours, évacuation et prévention des départs de feu.", {
    "Moyens de secours": [
      "Les extincteurs sont présents, accessibles, signalés et adaptés aux risques",
      "Les robinets d'incendie armés sont accessibles et vérifiés",
      "Les blocs de secours (éclairage de sécurité) s'allument en cas de coupure",
    ],
    Évacuation: [
      "Les plans d'évacuation et les consignes de sécurité incendie sont affichés",
      "Les issues de secours sont dégagées, signalées et déverrouillables sans clé",
      "Le point de rassemblement est signalé",
      "Le dernier exercice d'évacuation date de moins de six mois",
    ],
    Prévention: [
      "Les déchets combustibles sont évacués régulièrement",
      "Un permis de feu est délivré avant les travaux par points chauds",
      "Les produits inflammables sont stockés à l'écart des sources de chaleur",
    ],
  }),
  modele("atelier", "Atelier et maintenance", "Machines, outillage, soudure et consignation.", {
    Machines: [
      "Les protecteurs et les dispositifs de sécurité sont en place",
      "Les machines sont consignées avant toute intervention de maintenance",
      "Les notices et consignes d'utilisation sont disponibles au poste",
    ],
    Outillage: [
      "Les outils électroportatifs et leurs câbles sont en bon état",
      "Les meuleuses ont leur carter de protection",
      "L'établi et le poste de travail sont rangés",
    ],
    Soudure: [
      "Le poste de soudure dispose d'une aspiration des fumées",
      "Les bouteilles de gaz sont attachées, debout, avec leur chapeau ou leur détendeur",
      "Des écrans protègent les autres salariés des projections et du rayonnement",
    ],
    "Bruit et EPI": [
      "Les protections auditives sont portées dans les zones bruyantes",
      "Les lunettes et les gants adaptés sont disponibles et portés",
    ],
  }),
  modele("bureaux", "Bureaux et travail sur écran", "Postes de travail, ambiance et circulation dans les bureaux.", {
    "Poste de travail": [
      "Le siège est réglable et réglé (hauteur, dossier)",
      "Le haut de l'écran est à hauteur des yeux, à une longueur de bras",
      "L'écran est perpendiculaire aux fenêtres, sans reflet",
    ],
    Ambiance: [
      "L'éclairage et la température sont confortables",
      "Le bruit permet de travailler et de téléphoner sans gêne",
    ],
    Circulation: [
      "Aucun câble ne traverse les passages",
      "Les armoires hautes sont fixées au mur et les tiroirs se ferment",
      "Les escaliers ont une main courante et un éclairage suffisant",
    ],
  }),
];

export const resultatsPoint: { valeur: Exclude<ResultatPoint, "">; libelle: string; court: string; couleur: string; texte: string }[] = [
  { valeur: "conforme", libelle: "Conforme", court: "✓", couleur: "#0ca30c", texte: "#0b0b0b" },
  { valeur: "non-conforme", libelle: "Non conforme", court: "✗", couleur: "#d03b3b", texte: "#ffffff" },
  { valeur: "sans-objet", libelle: "Sans objet", court: "—", couleur: "#d9cfc1", texte: "#0b0b0b" },
];

export function nouvelleGrille(champs: Partial<GrilleAudit> = {}): GrilleAudit {
  return { id: nouvelId(), nom: "", description: "", points: [], ...champs };
}

// Copie modifiable d'une grille de la bibliothèque, avec ses propres identifiants.
export function copierGrille(grille: GrilleAudit): GrilleAudit {
  return { ...grille, id: nouvelId(), points: grille.points.map((p) => ({ ...p, id: nouvelId() })) };
}

export function nouvelleVisite(grille: GrilleAudit, aujourdhui: string, champs: Partial<Visite> = {}): Visite {
  return {
    id: nouvelId(),
    grille: grille.nom,
    date: aujourdhui,
    unite: "",
    auditeur: "",
    participants: "",
    reponses: grille.points.map((p) => ({ id: p.id, theme: p.theme, question: p.question, resultat: "", commentaire: "" })),
    synthese: "",
    clotureeLe: "",
    ...champs,
  };
}

// Taux de conformité : conformes sur points évalués (les « sans objet » ne comptent pas).
export function bilanVisite(v: Pick<Visite, "reponses">) {
  const compter = (r: ResultatPoint) => v.reponses.filter((x) => x.resultat === r).length;
  const conformes = compter("conforme");
  const nonConformes = compter("non-conforme");
  const sansObjet = compter("sans-objet");
  const evalues = conformes + nonConformes;
  return {
    conformes,
    nonConformes,
    sansObjet,
    restants: v.reponses.length - conformes - nonConformes - sansObjet,
    total: v.reponses.length,
    taux: evalues ? Math.round((conformes / evalues) * 100) : null,
  };
}

// Une non-conformité est traitée quand son action est réalisée.
export function nonConformitesOuvertes(visites: Visite[], actions: Action[]) {
  return visites.flatMap((v) =>
    v.reponses
      .filter((r) => r.resultat === "non-conforme")
      .map((r) => ({ visite: v, reponse: r, action: r.actionId ? actions.find((a) => a.id === r.actionId) : undefined }))
      .filter((x) => x.action?.statut !== "fait"),
  );
}

export function sansAction(visites: Visite[], actions: Action[]) {
  return nonConformitesOuvertes(visites, actions).filter((x) => !x.action);
}

// Action du plan proposée pour une non-conformité : à compléter (responsable, type de mesure).
export function actionPourNonConformite(v: Visite, r: ReponseVisite, aujourdhui: string, risqueId = ""): Action {
  return {
    id: nouvelId(),
    risqueId,
    intitule: r.commentaire ? `${r.question} : ${r.commentaire}` : `Corriger : ${r.question}`,
    principe: "",
    responsable: "",
    echeance: decalerJours(aujourdhui, 30),
    statut: "a-faire",
    cout: null,
    ressources: "",
    indicateur: "",
    realiseeLe: "",
    efficacite: "non-evaluee",
    commentaire: "",
    visiteId: v.id,
  };
}

export function grouperParTheme<T extends { theme: string }>(elements: T[]) {
  const groupes: { theme: string; elements: T[] }[] = [];
  for (const e of elements) {
    const groupe = groupes.find((g) => g.theme === e.theme);
    if (groupe) groupe.elements.push(e);
    else groupes.push({ theme: e.theme, elements: [e] });
  }
  return groupes;
}

export function derniereVisite(visites: Visite[]) {
  return [...visites].filter((v) => v.date).sort((a, b) => b.date.localeCompare(a.date))[0];
}
