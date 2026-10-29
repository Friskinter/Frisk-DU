// DUERP express : un premier document unique en quelques minutes à partir de la bibliothèque par métier.
// Le client choisit son métier, ses unités de travail, coche les risques qui le concernent et les
// mesures déjà en place ; les mesures manquantes deviennent des actions du plan d'actions.
// Tout reste modifiable ensuite : l'évaluation est celle de l'employeur (art. R4121-1).

import { nouvelleAction } from "./actions";
import { decalerJours, niveauDe, nouvelId, risqueResiduel } from "./calculs";
import type { Metier, ModeleRisque } from "./bibliotheque";
import type { Action, Donnees, LigneDuerp, NiveauMaitrise, PrincipePrevention } from "./types";

// Mesures de prévention d'un modèle : la liste conseillée, découpée aux virgules hors parenthèses.
export function mesuresDe(m: Pick<ModeleRisque, "prevention">): string[] {
  const mesures: string[] = [];
  let profondeur = 0;
  let courant = "";
  for (const c of m.prevention) {
    if (c === "(") profondeur++;
    if (c === ")") profondeur = Math.max(0, profondeur - 1);
    if (c === "," && profondeur === 0) {
      mesures.push(courant);
      courant = "";
    } else courant += c;
  }
  mesures.push(courant);
  return mesures.map((x) => x.trim()).filter(Boolean).map((x) => x[0].toUpperCase() + x.slice(1));
}

// Unités de travail d'un ou plusieurs métiers, dans l'ordre de la bibliothèque.
export function unitesDe(...choisis: Metier[]) {
  return [...new Set(choisis.flatMap((m) => m.risques.map((r) => r.unite)))];
}

// Maîtrise déduite des mesures cochées : aucune, une partie, toutes. « Très bonne » reste un jugement
// de l'employeur, à saisir ensuite dans le DUERP.
export function maitriseDepuis(enPlace: number, total: number): NiveauMaitrise {
  if (enPlace <= 0 || total === 0) return "insuffisante";
  return enPlace >= total ? "bonne" : "partielle";
}

// Principe général de prévention (art. L4121-2) d'une mesure, d'après ses mots.
export function principeDe(mesure: string): PrincipePrevention {
  const m = mesure.toLowerCase();
  if (/substitu|moins dangereu|à l'eau|sans ammoniaque|sans produits|alternatives|électriques ou moins/.test(m)) return "substituer";
  if (/gant|masque|lunettes|chaussures|casque|harnais|genouill|protections? auditives|combinaison|tablier|visière|écran facial|vêtements|gilet|manchettes|pantalon/.test(m)) return "epi";
  if (/formation|formé|sensibilisation|habilitation|caces|certiphyto|autorisation|fimo|information/.test(m)) return "formation";
  if (/procédure|planning|rotation|alternance|organis|horaires|pauses|temps de|consignes|plan de|limit|interdiction|protocole|entretiens|réunions|groupes|répartition|effectif|suivi médical|vaccin|repérage|déclaration|signalement|travail à deux|à deux|binôme|privilégier|respect/.test(m)) return "organisation";
  return "collective";
}

// Délai conseillé selon le niveau du risque restant.
const delais: Record<string, number> = { critique: 30, important: 90, modere: 180, faible: 365 };

export type ChoixRisque = { cle: string; modele: ModeleRisque; inclus: boolean; enPlace: string[] };
export type ChoixAction = { cle: string; risqueCle: string; intitule: string; principe: PrincipePrevention; echeance: string; inclus: boolean };

export function cleRisque(metierId: string, i: number) {
  return `${metierId}|${i}`;
}

// Risques des métiers choisis (plusieurs métiers possibles), sans doublon d'un métier à l'autre.
export function risquesDe(choisis: Metier[]): ChoixRisque[] {
  const vus = new Set<string>();
  return choisis.flatMap((metier) =>
    metier.risques.flatMap((modele, i) => {
      const id = `${modele.unite}|${modele.activite}|${modele.danger}`.toLowerCase();
      if (vus.has(id)) return [];
      vus.add(id);
      return [{ cle: cleRisque(metier.id, i), modele, inclus: true, enPlace: [] }];
    }),
  );
}

// Ligne du DUERP correspondant au choix, avant enregistrement.
export function ligneDepuis(c: ChoixRisque, effectif: number): LigneDuerp {
  const mesures = mesuresDe(c.modele);
  const enPlace = mesures.filter((m) => c.enPlace.includes(m));
  return {
    id: nouvelId(),
    unite: c.modele.unite,
    activite: c.modele.activite,
    danger: c.modele.danger,
    risque: c.modele.risque,
    effectif: Math.max(1, effectif || 1),
    gravite: c.modele.gravite,
    frequence: c.modele.frequence,
    mesures: enPlace.join(" ; "),
    maitrise: maitriseDepuis(enPlace.length, mesures.length),
    penibilite: c.modele.penibilite ?? "",
    seuilPenibilite: c.modele.penibilite ? "a-evaluer" : "non",
  };
}

// Actions proposées : les mesures manquantes des risques retenus qui ne sont pas faibles.
export function actionsProposees(risques: ChoixRisque[], aujourdhui: string): ChoixAction[] {
  return risques
    .filter((c) => c.inclus)
    .flatMap((c) => {
      const niveau = niveauDe(risqueResiduel(ligneDepuis(c, 1))).code;
      if (niveau === "faible") return [];
      return mesuresDe(c.modele)
        .filter((m) => !c.enPlace.includes(m))
        .map((m, i) => ({
          cle: `${c.cle}|${i}`,
          risqueCle: c.cle,
          intitule: m,
          principe: principeDe(m),
          echeance: decalerJours(aujourdhui, delais[niveau] ?? 180),
          inclus: true,
        }));
    });
}

const memeRisque = (a: Pick<LigneDuerp, "unite" | "danger" | "activite">, b: Pick<LigneDuerp, "unite" | "danger" | "activite">) =>
  a.unite.trim().toLowerCase() === b.unite.trim().toLowerCase() &&
  a.danger === b.danger &&
  a.activite.trim().toLowerCase() === b.activite.trim().toLowerCase();

// Ajoute au document unique les risques et actions retenus. Un risque déjà présent (même unité,
// même activité, même danger) n'est pas ajouté une seconde fois.
export function appliquerExpress(
  d: Donnees,
  choix: { unites: { nom: string; effectif: number }[]; risques: ChoixRisque[]; actions: ChoixAction[]; responsable: string },
): { donnees: Donnees; risquesAjoutes: number; actionsAjoutees: number } {
  const effectifs = new Map(choix.unites.map((u) => [u.nom, u.effectif]));
  const retenues = new Set(choix.unites.map((u) => u.nom));
  const lignes: LigneDuerp[] = [];
  const parCle = new Map<string, string>();
  for (const c of choix.risques) {
    if (!c.inclus || !retenues.has(c.modele.unite)) continue;
    const ligne = ligneDepuis(c, effectifs.get(c.modele.unite) ?? 1);
    if (d.duerp.some((l) => memeRisque(l, ligne)) || lignes.some((l) => memeRisque(l, ligne))) continue;
    lignes.push(ligne);
    parCle.set(c.cle, ligne.id);
  }
  const actions: Action[] = choix.actions
    .filter((a) => a.inclus && parCle.has(a.risqueCle))
    .map((a) => nouvelleAction(parCle.get(a.risqueCle)!, { intitule: a.intitule, principe: a.principe, echeance: a.echeance, responsable: choix.responsable }));
  const unites = [...d.unites, ...[...retenues].filter((u) => !d.unites.some((x) => x.trim().toLowerCase() === u.trim().toLowerCase()))];
  return {
    donnees: { ...d, unites, duerp: [...d.duerp, ...lignes], actions: [...d.actions, ...actions] },
    risquesAjoutes: lignes.length,
    actionsAjoutees: actions.length,
  };
}
